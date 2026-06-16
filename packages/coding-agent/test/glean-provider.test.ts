import { describe, expect, test } from "vitest";
import {
	createGleanProviderConfig,
	GLEAN_CLIENT_NAME,
	GLEAN_DEFAULT_BASE_URL,
	GLEAN_DEFAULT_MODEL_ID,
	GLEAN_OAUTH_SCOPES,
	getGleanAnthropicBaseUrl,
	getGleanGatewayBaseUrl,
	normalizeGleanBaseUrl,
} from "../src/core/glean-provider.ts";

describe("Glean provider", () => {
	test("normalizes tenant and gateway URLs", () => {
		expect(normalizeGleanBaseUrl("scio-prod-be.glean.com")).toBe(GLEAN_DEFAULT_BASE_URL);
		expect(normalizeGleanBaseUrl("https://scio-prod-be.glean.com/rest/api/v1")).toBe(GLEAN_DEFAULT_BASE_URL);
		expect(normalizeGleanBaseUrl("https://scio-prod-be.glean.com/rest/api/v1/openai/v1")).toBe(
			GLEAN_DEFAULT_BASE_URL,
		);
		expect(normalizeGleanBaseUrl("https://scio-prod-be.glean.com/rest/api/v1/anthropic")).toBe(
			GLEAN_DEFAULT_BASE_URL,
		);
		expect(normalizeGleanBaseUrl("https://scio-prod-be.glean.com/api/v1/openai/v1")).toBe(GLEAN_DEFAULT_BASE_URL);
		expect(normalizeGleanBaseUrl("https://scio-prod-be.glean.com/api/v1/openai")).toBe(GLEAN_DEFAULT_BASE_URL);
		expect(normalizeGleanBaseUrl("https://scio-prod-be.glean.com/api/v1/anthropic")).toBe(GLEAN_DEFAULT_BASE_URL);
		expect(getGleanGatewayBaseUrl("https://scio-prod-be.glean.com/rest/api/v1/")).toBe(
			`${GLEAN_DEFAULT_BASE_URL}/api/v1/openai/v1`,
		);
		expect(getGleanAnthropicBaseUrl("https://scio-prod-be.glean.com/rest/api/v1/")).toBe(
			`${GLEAN_DEFAULT_BASE_URL}/api/v1/anthropic`,
		);
	});

	test("registers Glimsy as a Glean OAuth-backed provider", () => {
		const config = createGleanProviderConfig();

		expect(config.name).toBe("Glean");
		expect(config.baseUrl).toBe(`${GLEAN_DEFAULT_BASE_URL}/api/v1/openai/v1`);
		expect(config.api).toBe("openai-responses");
		expect(config.authHeader).toBe(true);
		expect(config.oauth?.name).toBe("Glean");
		expect(config.oauth?.usesCallbackServer).toBe(true);
		expect(config.models?.length).toBeGreaterThan(1);
		expect(config.models?.[0].id).toBe(GLEAN_DEFAULT_MODEL_ID);
		expect(config.models?.map((model) => model.id)).toEqual(
			expect.arrayContaining([
				"gpt-5.5",
				"gpt-5.4-pro",
				"gpt-5.1-codex",
				"o3",
				"o4-mini",
				"gpt-4.1",
				"gpt-4o",
				"claude-opus-4-8",
				"claude-sonnet-4-6",
				"claude-haiku-4-5",
			]),
		);
		expect(config.models?.find((model) => model.id === "gpt-5.4")?.reasoning).toBe(true);
		expect(config.models?.find((model) => model.id === "gpt-4.1")?.reasoning).toBe(false);
		expect(config.models?.find((model) => model.id === "claude-sonnet-4-6")?.api).toBe("anthropic-messages");
		expect(config.models?.find((model) => model.id === "claude-sonnet-4-6")?.baseUrl).toBe(
			`${GLEAN_DEFAULT_BASE_URL}/api/v1/anthropic`,
		);
		expect(GLEAN_CLIENT_NAME).toBe("Glimsy");
		expect(GLEAN_OAUTH_SCOPES.split(" ").sort()).toEqual(["llm_proxy", "mcp", "offline_access"]);
	});

	test("derives model URLs from baseUrl instead of stale stored gatewayBaseUrl", () => {
		const config = createGleanProviderConfig();
		const openAIModel = config.models?.find((model) => model.id === GLEAN_DEFAULT_MODEL_ID);
		const anthropicModel = config.models?.find((model) => model.id === "claude-sonnet-4-6");
		expect(openAIModel).toBeDefined();
		expect(anthropicModel).toBeDefined();

		const updated = config.oauth?.modifyModels?.(
			[
				{
					...openAIModel!,
					api: "openai-responses",
					provider: "glean",
					baseUrl: "https://old.example.com",
				},
				{
					...anthropicModel!,
					api: "anthropic-messages",
					provider: "glean",
					baseUrl: "https://old.example.com",
				},
			],
			{
				access: "access",
				refresh: "refresh",
				expires: Date.now() + 1000,
				baseUrl: GLEAN_DEFAULT_BASE_URL,
				gatewayBaseUrl: `${GLEAN_DEFAULT_BASE_URL}/rest/api/v1/openai/v1`,
			},
		);

		expect(updated?.[0].baseUrl).toBe(`${GLEAN_DEFAULT_BASE_URL}/api/v1/openai/v1`);
		expect(updated?.[1].baseUrl).toBe(`${GLEAN_DEFAULT_BASE_URL}/api/v1/anthropic`);
	});
});
