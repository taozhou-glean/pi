/**
 * Glean MCP client integration.
 *
 * Connects to the Glean MCP server over Streamable HTTP transport,
 * discovers available tools, and exposes them as pi ToolDefinitions.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Type } from "typebox";
import type { ExtensionContext, ToolDefinition } from "./extensions/types.ts";
import { GLEAN_CLIENT_NAME, GLEAN_DEFAULT_BASE_URL, normalizeGleanBaseUrl } from "./glean-provider.ts";

const MCP_PATH = "/mcp/default";
const GLEAN_METADATA_HEADER = "X-Glean-Metadata";
const GLEAN_METADATA_VALUE = "mdm";

export interface GleanMcpOptions {
	baseUrl?: string;
	accessToken: string;
}

interface McpToolSchema {
	type: "object";
	properties?: Record<string, object>;
	required?: string[];
	[key: string]: unknown;
}

interface McpTool {
	name: string;
	description?: string;
	inputSchema: McpToolSchema;
}

/**
 * Convert an MCP JSON Schema to a TypeBox schema.
 * We use Type.Unsafe to pass through the raw JSON Schema since MCP tools
 * use standard JSON Schema which TypeBox can represent via Unsafe.
 */
function mcpSchemaToTypebox(schema: McpToolSchema) {
	return Type.Unsafe<Record<string, unknown>>(schema);
}

/**
 * Create a pi ToolDefinition from an MCP tool descriptor and a connected client.
 */
function createMcpToolDefinition(tool: McpTool, client: Client): ToolDefinition {
	const parameters = mcpSchemaToTypebox(tool.inputSchema);

	return {
		name: `glean_${tool.name}`,
		label: `Glean: ${tool.name}`,
		description: tool.description ?? `Glean MCP tool: ${tool.name}`,
		promptSnippet: tool.description,
		parameters,

		async execute(
			_toolCallId: string,
			params: Record<string, unknown>,
			signal: AbortSignal | undefined,
			_onUpdate: undefined,
			_ctx: ExtensionContext,
		) {
			const result = await client.callTool(
				{ name: tool.name, arguments: params },
				undefined,
				signal ? { signal } : undefined,
			);

			const contentItems = result.content as Array<{
				type: string;
				text?: string;
				data?: string;
				mimeType?: string;
			}>;
			const textParts: string[] = [];
			for (const item of contentItems) {
				if (item.type === "text" && item.text) {
					textParts.push(item.text);
				}
			}

			const output = textParts.join("\n");
			return {
				content: [{ type: "text" as const, text: output || "(no output)" }],
				isError: result.isError === true,
				details: undefined,
			};
		},
	};
}

/**
 * Connect to the Glean MCP server, discover tools, and return ToolDefinitions.
 *
 * Returns an object with the tool definitions and a disconnect function.
 * Returns undefined if connection fails (non-fatal).
 */
export async function connectGleanMcp(options: GleanMcpOptions): Promise<
	| {
			tools: ToolDefinition[];
			disconnect: () => Promise<void>;
	  }
	| undefined
> {
	const baseUrl = normalizeGleanBaseUrl(options.baseUrl ?? GLEAN_DEFAULT_BASE_URL);
	const mcpUrl = new URL(MCP_PATH, baseUrl);

	const transport = new StreamableHTTPClientTransport(mcpUrl, {
		requestInit: {
			headers: {
				Authorization: `Bearer ${options.accessToken}`,
				[GLEAN_METADATA_HEADER]: GLEAN_METADATA_VALUE,
			},
		},
	});

	const client = new Client({
		name: GLEAN_CLIENT_NAME,
		version: "1.0.0",
	});

	try {
		await client.connect(transport);
	} catch {
		// Connection failure is non-fatal; the user may not have MCP access
		return undefined;
	}

	let mcpTools: McpTool[];
	try {
		const result = await client.listTools();
		mcpTools = result.tools as McpTool[];
	} catch {
		await client.close();
		return undefined;
	}

	const tools = mcpTools.map((tool) => createMcpToolDefinition(tool, client));

	return {
		tools,
		disconnect: async () => {
			try {
				await client.close();
			} catch {
				// Ignore close errors
			}
		},
	};
}
