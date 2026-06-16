import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai/oauth";
import type { ProviderConfigInput } from "./model-registry.ts";

export const GLEAN_PROVIDER_ID = "glean";
export const GLEAN_PROVIDER_NAME = "Glean";
export const GLEAN_CLIENT_NAME = "Glimsy";
export const GLEAN_DEFAULT_BASE_URL = "https://scio-prod-be.glean.com";
export const GLEAN_DEFAULT_MODEL_ID = "gpt-5.5";
export const GLEAN_OAUTH_SCOPES = "llm_proxy mcp offline_access";

const GLEAN_TEXT_MODEL_IDS = [
	GLEAN_DEFAULT_MODEL_ID,
	"gpt-5.4",
	"gpt-5.4-pro",
	"gpt-5.4-mini",
	"gpt-5.4-nano",
	"gpt-5.3-codex",
	"gpt-5.2",
	"gpt-5.2-pro",
	"gpt-5.2-chat-latest",
	"gpt-5.2-codex",
	"gpt-5.1",
	"gpt-5.1-chat-latest",
	"gpt-5.1-codex",
	"gpt-5.1-codex-max",
	"gpt-5.1-codex-mini",
	"gpt-5",
	"gpt-5-chat-latest",
	"gpt-5-pro",
	"gpt-5-codex",
	"gpt-5-mini",
	"gpt-5-nano",
	"o3",
	"o3-pro",
	"o3-mini",
	"o4-mini",
	"o3-deep-research",
	"o4-mini-deep-research",
	"o1",
	"o1-pro",
	"gpt-4.1",
	"gpt-4.1-mini",
	"gpt-4.1-nano",
	"gpt-4o",
	"gpt-4o-mini",
] as const;

const GLEAN_ANTHROPIC_MODEL_IDS = [
	"claude-opus-4-8",
	"claude-sonnet-4-6",
	"claude-opus-4-7",
	"claude-haiku-4-5",
	"claude-opus-4-6",
	"claude-opus-4-5",
	"claude-sonnet-4-5",
] as const;

const CALLBACK_HOST = "127.0.0.1";
const CALLBACK_PORT = 8053;
const CALLBACK_PATH = "/callback";
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;

type GleanCredentials = OAuthCredentials & {
	clientId?: string;
	baseUrl?: string;
	gatewayBaseUrl?: string;
	scopes?: string;
};

type CallbackServerInfo = {
	server: Server;
	cancelWait: () => void;
	waitForCode: () => Promise<{ code: string; state?: string } | null>;
};

type GleanClientRegistrationResponse = {
	client_id?: string;
};

type GleanTokenResponse = {
	access_token?: string;
	refresh_token?: string;
	expires_in?: number;
};

function base64Url(bytes: Buffer): string {
	return bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createPkce(): { verifier: string; challenge: string } {
	const verifier = base64Url(randomBytes(32));
	const challenge = base64Url(createHash("sha256").update(verifier).digest());
	return { verifier, challenge };
}

function createState(): string {
	return base64Url(randomBytes(24));
}

function normalizeUrlInput(input: string): URL {
	const value = input.trim();
	if (!value) {
		return new URL(GLEAN_DEFAULT_BASE_URL);
	}
	return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
}

export function normalizeGleanBaseUrl(input: string): string {
	const url = normalizeUrlInput(input);
	url.hash = "";
	url.search = "";
	url.pathname = url.pathname
		.replace(/\/+$/g, "")
		.replace(/\/rest\/api\/v1\/openai\/v1$/i, "")
		.replace(/\/rest\/api\/v1\/anthropic$/i, "")
		.replace(/\/rest\/api\/v1$/i, "")
		.replace(/\/api\/v1\/openai\/v1$/i, "")
		.replace(/\/api\/v1\/openai$/i, "")
		.replace(/\/api\/v1\/anthropic$/i, "");
	if (!url.pathname || url.pathname === "/") {
		url.pathname = "";
	}
	return url.toString().replace(/\/$/g, "");
}

export function getGleanGatewayBaseUrl(baseUrl: string): string {
	return `${normalizeGleanBaseUrl(baseUrl)}/api/v1/openai/v1`;
}

export function getGleanAnthropicBaseUrl(baseUrl: string): string {
	return `${normalizeGleanBaseUrl(baseUrl)}/api/v1/anthropic`;
}

function oauthSuccessHtml(message: string): string {
	return `<!doctype html><meta charset="utf-8"><title>Authentication complete</title><body style="font-family: system-ui; margin: 3rem;"><h1>Authentication complete</h1><p>${message}</p></body>`;
}

function oauthErrorHtml(message: string): string {
	return `<!doctype html><meta charset="utf-8"><title>Authentication failed</title><body style="font-family: system-ui; margin: 3rem;"><h1>Authentication failed</h1><p>${message}</p></body>`;
}

function parseAuthorizationInput(input: string): { code?: string; state?: string } {
	const value = input.trim();
	if (!value) {
		return {};
	}

	try {
		const url = new URL(value);
		return {
			code: url.searchParams.get("code") ?? undefined,
			state: url.searchParams.get("state") ?? undefined,
		};
	} catch {
		// Continue parsing as a raw query string or code.
	}

	if (value.includes("code=")) {
		const params = new URLSearchParams(value);
		return {
			code: params.get("code") ?? undefined,
			state: params.get("state") ?? undefined,
		};
	}

	return { code: value };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
	const response = await fetch(url, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(30_000),
	});
	const text = await response.text();
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} from ${url}: ${text}`);
	}
	return JSON.parse(text) as T;
}

async function postForm<T>(url: string, form: URLSearchParams): Promise<T> {
	const response = await fetch(url, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: form,
		signal: AbortSignal.timeout(30_000),
	});
	const text = await response.text();
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} from ${url}: ${text}`);
	}
	return JSON.parse(text) as T;
}

async function registerGleanClient(baseUrl: string): Promise<string> {
	const body = {
		client_name: GLEAN_CLIENT_NAME,
		redirect_uris: [REDIRECT_URI],
		grant_types: ["authorization_code", "refresh_token"],
		response_types: ["code"],
		token_endpoint_auth_method: "none",
		scope: GLEAN_OAUTH_SCOPES,
	};
	const response = await postJson<GleanClientRegistrationResponse>(`${baseUrl}/oauth/register`, body);
	if (!response.client_id) {
		throw new Error("Glean OAuth registration response did not include client_id.");
	}
	return response.client_id;
}

async function exchangeAuthorizationCode(
	baseUrl: string,
	clientId: string,
	code: string,
	verifier: string,
): Promise<GleanTokenResponse> {
	return postForm<GleanTokenResponse>(
		`${baseUrl}/oauth/token`,
		new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: REDIRECT_URI,
			code_verifier: verifier,
			client_id: clientId,
		}),
	);
}

function tokenResponseToCredentials(
	token: GleanTokenResponse,
	existing: Pick<GleanCredentials, "refresh" | "clientId" | "baseUrl" | "gatewayBaseUrl" | "scopes">,
): GleanCredentials {
	if (!token.access_token) {
		throw new Error("Glean OAuth token response did not include access_token.");
	}
	const refresh = token.refresh_token ?? existing.refresh;
	if (!refresh) {
		throw new Error("Glean OAuth token response did not include refresh_token; offline_access scope may be missing.");
	}
	const baseUrl = existing.baseUrl ?? GLEAN_DEFAULT_BASE_URL;
	const expiresInSeconds = typeof token.expires_in === "number" && token.expires_in > 0 ? token.expires_in : 3600;
	return {
		access: token.access_token,
		refresh,
		expires: Date.now() + expiresInSeconds * 1000,
		clientId: existing.clientId,
		baseUrl,
		gatewayBaseUrl: existing.gatewayBaseUrl ?? getGleanGatewayBaseUrl(baseUrl),
		scopes: existing.scopes ?? GLEAN_OAUTH_SCOPES,
	};
}

async function startCallbackServer(expectedState: string): Promise<CallbackServerInfo> {
	return new Promise((resolve, reject) => {
		let settleWait: ((value: { code: string; state?: string } | null) => void) | undefined;
		const waitForCodePromise = new Promise<{ code: string; state?: string } | null>((resolveWait) => {
			let settled = false;
			settleWait = (value) => {
				if (settled) return;
				settled = true;
				resolveWait(value);
			};
		});

		const server = createServer((req, res) => {
			try {
				const url = new URL(req.url || "", "http://localhost");
				if (url.pathname !== CALLBACK_PATH) {
					res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
					res.end(oauthErrorHtml("Callback route not found."));
					return;
				}

				const error = url.searchParams.get("error");
				if (error) {
					res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
					res.end(oauthErrorHtml(`Glean authentication failed: ${error}`));
					return;
				}

				const code = url.searchParams.get("code");
				const state = url.searchParams.get("state");
				if (!code || !state) {
					res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
					res.end(oauthErrorHtml("Missing code or state parameter."));
					return;
				}
				if (state !== expectedState) {
					res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
					res.end(oauthErrorHtml("State mismatch."));
					return;
				}

				res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
				res.end(oauthSuccessHtml("Glimsy authentication completed. You can close this window."));
				settleWait?.({ code, state });
			} catch {
				res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
				res.end("Internal error");
			}
		});

		server.on("error", reject);
		server.listen(CALLBACK_PORT, CALLBACK_HOST, () => {
			resolve({
				server,
				cancelWait: () => settleWait?.(null),
				waitForCode: () => waitForCodePromise,
			});
		});
	});
}

function buildAuthorizeUrl(baseUrl: string, clientId: string, challenge: string, state: string): string {
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: REDIRECT_URI,
		response_type: "code",
		code_challenge: challenge,
		code_challenge_method: "S256",
		scope: GLEAN_OAUTH_SCOPES,
		state,
	});
	return `${baseUrl}/oauth/authorize?${params.toString()}`;
}

function gleanModelSupportsReasoning(modelId: string): boolean {
	return /^(gpt-5|o[134]|o4)/.test(modelId);
}

function createGleanModel(modelId: string): NonNullable<ProviderConfigInput["models"]>[number] {
	return {
		id: modelId,
		name: `${modelId} (Glean)`,
		reasoning: gleanModelSupportsReasoning(modelId),
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 400000,
		maxTokens: 128000,
	};
}

function createGleanAnthropicModel(modelId: string): NonNullable<ProviderConfigInput["models"]>[number] {
	const forceAdaptiveThinking = /^(claude-opus-4-[678]|claude-sonnet-4-6)$/.test(modelId);
	const supportsTemperature = !/^claude-opus-4-[78]$/.test(modelId);
	return {
		id: modelId,
		name: `${modelId} (Glean)`,
		api: "anthropic-messages",
		baseUrl: getGleanAnthropicBaseUrl(GLEAN_DEFAULT_BASE_URL),
		reasoning: true,
		thinkingLevelMap: forceAdaptiveThinking
			? modelId === "claude-opus-4-6"
				? { xhigh: "max" }
				: { xhigh: "xhigh" }
			: undefined,
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: forceAdaptiveThinking ? 1000000 : 200000,
		maxTokens: modelId.startsWith("claude-opus-4-") && forceAdaptiveThinking ? 128000 : 64000,
		compat: {
			...(forceAdaptiveThinking ? { forceAdaptiveThinking: true } : {}),
			...(supportsTemperature ? {} : { supportsTemperature: false }),
		},
	};
}

async function waitForAuthorizationCode(callbacks: OAuthLoginCallbacks, serverInfo: CallbackServerInfo, state: string) {
	const serverCode = serverInfo.waitForCode();
	const manualCode = callbacks.onManualCodeInput
		? callbacks.onManualCodeInput().then((input) => parseAuthorizationInput(input))
		: new Promise<{ code?: string; state?: string }>(() => undefined);
	const result = await Promise.race([serverCode, manualCode]);
	if (!result?.code) {
		throw new Error("Login cancelled");
	}
	if (result.state && result.state !== state) {
		throw new Error("OAuth state mismatch.");
	}
	serverInfo.cancelWait();
	return result.code;
}

async function refreshGleanToken(credentials: GleanCredentials): Promise<GleanCredentials> {
	if (!credentials.clientId) {
		throw new Error("Stored Glean credentials are missing clientId. Run /login again.");
	}
	const baseUrl = normalizeGleanBaseUrl(credentials.baseUrl ?? GLEAN_DEFAULT_BASE_URL);
	const token = await postForm<GleanTokenResponse>(
		`${baseUrl}/oauth/token`,
		new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: credentials.refresh,
			client_id: credentials.clientId,
		}),
	);
	return tokenResponseToCredentials(token, {
		...credentials,
		baseUrl,
		gatewayBaseUrl: getGleanGatewayBaseUrl(baseUrl),
		scopes: GLEAN_OAUTH_SCOPES,
	});
}

export function createGleanProviderConfig(): ProviderConfigInput {
	const defaultGatewayBaseUrl = getGleanGatewayBaseUrl(GLEAN_DEFAULT_BASE_URL);
	return {
		name: GLEAN_PROVIDER_NAME,
		baseUrl: defaultGatewayBaseUrl,
		api: "openai-responses",
		authHeader: true,
		oauth: {
			name: GLEAN_PROVIDER_NAME,
			usesCallbackServer: true,
			async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
				const baseUrl = normalizeGleanBaseUrl(
					await callbacks.onPrompt({
						message: "Enter Glean base URL:",
						placeholder: GLEAN_DEFAULT_BASE_URL,
						allowEmpty: true,
					}),
				);
				callbacks.onProgress?.(`Registering ${GLEAN_CLIENT_NAME} OAuth client...`);
				const clientId = await registerGleanClient(baseUrl);
				const { verifier, challenge } = createPkce();
				const state = createState();
				const serverInfo = await startCallbackServer(state);
				try {
					callbacks.onAuth({
						url: buildAuthorizeUrl(baseUrl, clientId, challenge, state),
						instructions: `Authorize ${GLEAN_CLIENT_NAME} for scopes: ${GLEAN_OAUTH_SCOPES}`,
					});
					const code = await waitForAuthorizationCode(callbacks, serverInfo, state);
					callbacks.onProgress?.("Exchanging Glean authorization code...");
					const token = await exchangeAuthorizationCode(baseUrl, clientId, code, verifier);
					return tokenResponseToCredentials(token, {
						refresh: "",
						clientId,
						baseUrl,
						gatewayBaseUrl: getGleanGatewayBaseUrl(baseUrl),
						scopes: GLEAN_OAUTH_SCOPES,
					});
				} finally {
					serverInfo.cancelWait();
					serverInfo.server.close();
				}
			},
			refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
				return refreshGleanToken(credentials as GleanCredentials);
			},
			getApiKey(credentials: OAuthCredentials): string {
				return credentials.access;
			},
			modifyModels(models: Model<Api>[], credentials: OAuthCredentials): Model<Api>[] {
				const gleanCredentials = credentials as GleanCredentials;
				const tenantBaseUrl = gleanCredentials.baseUrl ?? GLEAN_DEFAULT_BASE_URL;
				const openAIBaseUrl = getGleanGatewayBaseUrl(tenantBaseUrl);
				const anthropicBaseUrl = getGleanAnthropicBaseUrl(tenantBaseUrl);
				return models.map((model) => {
					if (model.provider !== GLEAN_PROVIDER_ID) {
						return model;
					}
					return {
						...model,
						baseUrl: model.api === "anthropic-messages" ? anthropicBaseUrl : openAIBaseUrl,
					};
				});
			},
		},
		models: [
			...GLEAN_TEXT_MODEL_IDS.map(createGleanModel),
			...GLEAN_ANTHROPIC_MODEL_IDS.map(createGleanAnthropicModel),
		],
	};
}
