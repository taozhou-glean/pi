import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
	type AgentSession,
	type AgentSessionEvent,
	type AgentSessionServices,
	type CreateAgentSessionResult,
	createAgentSessionFromServices,
	createAgentSessionServices,
	type ExtensionFactory,
	type SessionInfo,
	SessionManager,
} from "@earendil-works/pi-coding-agent";
import { app, BrowserWindow, dialog, ipcMain, Menu, type MenuItemConstructorOptions, shell } from "electron";
import * as pty from "node-pty";
import { parsePiDesktopSessionDeepLink, piDesktopSessionDeepLink } from "./deep-link";
import { type ParsedDiff, parseUnifiedDiff } from "./diff-parser";
import { type GithubPullRequestStatus, getGithubPullRequestStatus, githubFailureSignature } from "./github-pr";
import {
	latestTurnDiff,
	persistedMessageEntryIds,
	type QueuedPromptEntry,
	queuedPromptEntryType,
	type ResponseFeedbackRating,
	replayQueuedPrompts,
	replayResponseFeedback,
	responseFeedbackEntryType,
	turnDiffEntryType,
} from "./session-persistence";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const appName = "Pi Desktop";

app.setName(appName);

type DesktopMessage = {
	entryId?: string;
	feedback?: ResponseFeedbackRating;
	role: string;
	text: string;
	content: DesktopContent[];
	timestamp?: number;
	toolCalls?: DesktopToolCall[];
	toolCallId?: string;
	toolName?: string;
	isError?: boolean;
	errorMessage?: string;
};

type DesktopContent =
	| { type: "text"; text: string }
	| { type: "thinking"; text: string }
	| { type: "image"; data: string; mimeType: string }
	| DesktopToolCall;

type DesktopPromptImage = { type: "image"; data: string; mimeType: string };

type DesktopPromptPayload = {
	text: string;
	images?: DesktopPromptImage[];
};

type DesktopQueuedPrompt = DesktopPromptPayload & {
	id: string;
	createdAt: number;
};

type DesktopQueuedPromptSummary = {
	id: string;
	text: string;
	imageCount: number;
	createdAt: number;
};

type DesktopClarificationRequest = {
	id: string;
	sessionId: string;
	question: string;
	options: string[];
	createdAt: number;
};

type DesktopClarificationResolution = {
	answer?: string;
	reason: "answered" | "rejected" | "timeout" | "aborted";
};

type PendingDesktopClarification = DesktopClarificationRequest & {
	resolve: (resolution: DesktopClarificationResolution) => void;
	timer: NodeJS.Timeout;
	abortSignal?: AbortSignal;
	abortHandler?: () => void;
};

type DesktopPermissionMode = "ask" | "acceptEdits" | "bypassPermissions";

type DesktopPermissionRequest = {
	id: string;
	sessionId: string;
	toolCallId: string;
	toolName: string;
	toolInput: unknown;
	reason: string;
	createdAt: number;
};

type DesktopPermissionReply = "allowOnce" | "allowAlways" | "reject" | "timeout";

type DesktopPermissionState = {
	mode: DesktopPermissionMode;
	grants: string[];
};

type PendingDesktopPermission = DesktopPermissionRequest & {
	resolve: (reply: DesktopPermissionReply) => void;
	timer: NodeJS.Timeout;
	abortSignal?: AbortSignal;
	abortHandler?: () => void;
};

type DesktopContextSelection =
	| { type: "path"; path: string; name: string }
	| { type: "image"; path: string; name: string; data: string; mimeType: string };

type DesktopToolCall = {
	type: "toolCall";
	id: string;
	name: string;
	input?: unknown;
};

type DesktopState = {
	cwd: string;
	sessionDir?: string;
	sessionId?: string;
	sessionFile?: string;
	sessionName?: string;
	model?: { provider: string; id: string };
	contextUsage?: {
		tokens: number | null;
		contextWindow: number;
		percent: number | null;
	};
	lastTurnDiff?: ParsedDiff;
	thinkingLevel?: string;
	availableThinkingLevels?: string[];
	authRequired: boolean;
	availableModelCount: number;
	isStreaming: boolean;
	pendingMessageCount: number;
	queuedPrompts: DesktopQueuedPromptSummary[];
	permissionMode: DesktopPermissionMode;
	permissionRequests: DesktopPermissionRequest[];
	clarificationRequests: DesktopClarificationRequest[];
	messageCount: number;
	todos: DesktopTodo[];
};

type DesktopGitStatus = {
	isRepo: boolean;
	branch?: string;
	status: string[];
	diffStat?: string;
	additions?: number;
	deletions?: number;
	error?: string;
};

type DesktopEnvironmentStatus = {
	git: DesktopGitStatus;
	pullRequest: GithubPullRequestStatus;
	monitoring: boolean;
};

type DesktopPrMonitor = {
	timer: NodeJS.Timeout;
	lastFailureSignature?: string;
	tickInFlight?: Promise<void>;
};

type DesktopTodoStatus = "pending" | "in_progress" | "completed" | "cancelled";

type DesktopTodo = {
	content: string;
	status: DesktopTodoStatus;
};

type DesktopLoginResult = {
	state: DesktopState;
	message: string;
};

type DesktopCurrentUser = {
	name?: string;
	email?: string;
	photoUrl?: string;
	endpoint?: string;
};

type DesktopDiffScope = "working-tree" | "staged" | "last-turn";

type DesktopTurnSnapshot = {
	baseRef?: string;
	diff?: ParsedDiff;
	untrackedPaths: Set<string>;
};

type DesktopGleanAuth = {
	endpoint: string;
	accessToken: string;
};

type DesktopSessionInfo = {
	path: string;
	id: string;
	name?: string;
	cwd: string;
	modified: string;
	messageCount: number;
	firstMessage: string;
	isRunning?: boolean;
};

let mainWindow: BrowserWindow | undefined;
let current: CreateAgentSessionResult | undefined;
let currentServices: AgentSessionServices | undefined;
const servicesByCwd = new Map<string, AgentSessionServices>();
const serviceCreationsByCwd = new Map<string, Promise<AgentSessionServices>>();
let sessionCreation: Promise<DesktopState> | undefined;
let loginInFlight: Promise<DesktopLoginResult> | undefined;
let unsubscribeSession: (() => void) | undefined;
let currentCwd = resolve(process.env.PI_DESKTOP_CWD || process.cwd());
let currentSessionDir: string | undefined;
const providerAllowlist = ["glean"];
const envSessionDir = "PI_CODING_AGENT_SESSION_DIR";
const desktopPermissionStateEntryType = "cowork_permission_state";
const desktopTodoStateEntryType = "cowork_todo_state";
const turnSnapshotsBySessionId = new Map<string, DesktopTurnSnapshot>();
const todosBySessionId = new Map<string, DesktopTodo[]>();
const queuedPromptsBySessionKey = new Map<string, DesktopQueuedPrompt[]>();
const queuedPromptDrains = new Set<string>();
const pendingClarificationsById = new Map<string, PendingDesktopClarification>();
const clarificationTimeoutMs = 5 * 60_000;
const permissionModesBySessionId = new Map<string, DesktopPermissionMode>();
const permissionGrantsBySessionId = new Map<string, Set<string>>();
const pendingPermissionsById = new Map<string, PendingDesktopPermission>();
const permissionTimeoutMs = 5 * 60_000;
let prMonitor: DesktopPrMonitor | undefined;
const prMonitorIntervalMs = 60_000;
let focusedTerminalId: string | undefined;
let isQuitting = false;
let pendingSessionSnapshot: NodeJS.Timeout | undefined;
let didRegisterProtocolHandler = false;
const pendingDeepLinkUrls: string[] = [];

function getSession(): AgentSession {
	if (!current?.session) {
		throw new Error("Desktop session has not been initialized");
	}
	return current.session;
}

async function getOrCreateDesktopServices(cwd: string): Promise<AgentSessionServices> {
	const resolvedCwd = resolve(cwd);
	const cached = servicesByCwd.get(resolvedCwd);
	if (cached) return cached;

	const existingCreation = serviceCreationsByCwd.get(resolvedCwd);
	if (existingCreation) return existingCreation;

	const creation = createAgentSessionServices({
		cwd: resolvedCwd,
		providerAllowlist,
		resourceLoaderOptions: {
			extensionFactories: [desktopPermissionExtension, desktopTodoExtension, desktopClarificationExtension],
		},
	})
		.then((services) => {
			if (isQuitting) {
				services.mcpDisconnect?.().catch(() => {});
			} else {
				servicesByCwd.set(resolvedCwd, services);
			}
			return services;
		})
		.finally(() => {
			serviceCreationsByCwd.delete(resolvedCwd);
		});
	serviceCreationsByCwd.set(resolvedCwd, creation);
	return creation;
}

function warmDesktopServices(cwds: Iterable<string>): void {
	for (const cwd of new Set(Array.from(cwds, (entry) => resolve(entry)))) {
		if (cwd === currentServices?.cwd || servicesByCwd.has(cwd) || serviceCreationsByCwd.has(cwd)) {
			continue;
		}
		getOrCreateDesktopServices(cwd).catch((error) => {
			console.warn(`Failed to warm desktop services for ${cwd}:`, error);
		});
	}
}

function expandTilde(path: string): string {
	if (path === "~") return homedir();
	if (path.startsWith("~/")) return resolve(homedir(), path.slice(2));
	return resolve(path);
}

function resolveSessionDir(settingsSessionDir: string | undefined): string | undefined {
	const envValue = process.env[envSessionDir];
	if (envValue?.trim()) {
		return expandTilde(envValue.trim());
	}
	return settingsSessionDir;
}

function textFromContent(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.map((part) => {
			if (!part || typeof part !== "object") return "";
			const typed = part as { type?: string; text?: string; content?: string; name?: string };
			if (typed.type === "text") return typed.text ?? "";
			if (typed.type === "thinking") return "";
			if (typed.type === "toolCall") return "";
			if (typed.type === "image") return "[image]";
			return typed.text ?? typed.content ?? "";
		})
		.filter(Boolean)
		.join("\n");
}

function normalizeContent(content: unknown): DesktopContent[] {
	if (typeof content === "string") return [{ type: "text", text: content }];
	if (!Array.isArray(content)) return [];
	const blocks: DesktopContent[] = [];
	for (const part of content) {
		if (!part || typeof part !== "object") continue;
		const typed = part as {
			type?: string;
			text?: string;
			content?: string;
			thinking?: string;
			data?: string;
			mimeType?: string;
			id?: string;
			name?: string;
			input?: unknown;
			arguments?: unknown;
			args?: unknown;
		};
		if (typed.type === "text") {
			blocks.push({ type: "text", text: typed.text ?? typed.content ?? "" });
		} else if (typed.type === "thinking") {
			blocks.push({ type: "thinking", text: typed.thinking ?? typed.text ?? "" });
		} else if (typed.type === "image") {
			blocks.push({ type: "image", data: typed.data ?? "", mimeType: typed.mimeType ?? "image/png" });
		} else if (typed.type === "toolCall") {
			blocks.push({
				type: "toolCall",
				id: typed.id ?? "",
				name: typed.name ?? "tool",
				input: typed.input ?? typed.arguments ?? typed.args,
			});
		}
	}
	return blocks;
}

function toolCallsFromContent(content: unknown): DesktopToolCall[] {
	if (!Array.isArray(content)) return [];
	const calls: DesktopToolCall[] = [];
	for (const part of content) {
		if (!part || typeof part !== "object") continue;
		const typed = part as {
			type?: string;
			id?: string;
			name?: string;
			input?: unknown;
			arguments?: unknown;
			args?: unknown;
		};
		if (typed.type === "toolCall" && typed.name) {
			calls.push({
				type: "toolCall",
				id: typed.id ?? "",
				name: typed.name,
				input: typed.input ?? typed.arguments ?? typed.args,
			});
		}
	}
	return calls;
}

function serializeMessage(message: unknown, entryId?: string, feedback?: ResponseFeedbackRating): DesktopMessage {
	const typed = message as {
		entryId?: unknown;
		id?: unknown;
		role?: string;
		content?: unknown;
		timestamp?: number;
		toolCallId?: string;
		toolName?: string;
		isError?: boolean;
		errorMessage?: string;
	};
	const messageEntryId =
		entryId ??
		(typeof typed.entryId === "string" ? typed.entryId : typeof typed.id === "string" ? typed.id : undefined);
	return {
		entryId: messageEntryId,
		feedback,
		role: typed.role ?? "unknown",
		text: textFromContent(typed.content),
		content: normalizeContent(typed.content),
		timestamp: typed.timestamp,
		toolCalls: toolCallsFromContent(typed.content),
		toolCallId: typed.toolCallId,
		toolName: typed.toolName,
		isError: typed.isError,
		errorMessage: typed.errorMessage,
	};
}

function serializeVisibleMessages(): DesktopMessage[] {
	const session = getSession();
	const messages = session.messages.slice();
	const streamingMessage = session.agent.state.streamingMessage;
	if (streamingMessage && !messages.includes(streamingMessage)) {
		messages.push(streamingMessage);
	}
	const entryIdsByMessage = persistedMessageEntryIds(session.sessionManager.getBranch());
	const feedbackByEntryId = replayResponseFeedback(session.sessionManager.getBranch());
	return messages.map((message) => {
		const entryId = typeof message === "object" && message !== null ? entryIdsByMessage.get(message) : undefined;
		return serializeMessage(message, entryId, entryId ? feedbackByEntryId[entryId] : undefined);
	});
}

function sessionQueueKey(session: AgentSession): string {
	return session.sessionFile ? resolve(session.sessionFile) : session.sessionId;
}

function hydrateQueuedPrompts(session: AgentSession): void {
	const key = sessionQueueKey(session);
	const prompts = replayQueuedPrompts(session.sessionManager.getBranch());
	if (prompts.length > 0) {
		queuedPromptsBySessionKey.set(key, prompts);
	} else {
		queuedPromptsBySessionKey.delete(key);
	}
}

function getQueuedPrompts(session = getSession()): DesktopQueuedPrompt[] {
	return queuedPromptsBySessionKey.get(sessionQueueKey(session)) ?? [];
}

function summarizeQueuedPrompts(session = getSession()): DesktopQueuedPromptSummary[] {
	return getQueuedPrompts(session).map((prompt) => ({
		id: prompt.id,
		text: prompt.text,
		imageCount: prompt.images?.length ?? 0,
		createdAt: prompt.createdAt,
	}));
}

function persistQueuedPromptEntry(entry: QueuedPromptEntry): void {
	getSession().sessionManager.appendCustomEntry(queuedPromptEntryType, entry);
}

function queuePrompt(prompt: DesktopPromptPayload): DesktopQueuedPrompt {
	const session = getSession();
	const queuedPrompt: DesktopQueuedPrompt = {
		...prompt,
		id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
		createdAt: Date.now(),
	};
	queuedPromptsBySessionKey.set(sessionQueueKey(session), [...getQueuedPrompts(session), queuedPrompt]);
	persistQueuedPromptEntry({ action: "enqueue", prompt: queuedPrompt });
	publishState();
	sendSessionStatus(session);
	return queuedPrompt;
}

function removeQueuedPrompt(id: string): DesktopQueuedPrompt | undefined {
	const session = getSession();
	const queuedPrompts = getQueuedPrompts(session);
	const queuedPrompt = queuedPrompts.find((prompt) => prompt.id === id);
	if (!queuedPrompt) return undefined;
	const nextQueuedPrompts = queuedPrompts.filter((prompt) => prompt.id !== id);
	if (nextQueuedPrompts.length > 0) {
		queuedPromptsBySessionKey.set(sessionQueueKey(session), nextQueuedPrompts);
	} else {
		queuedPromptsBySessionKey.delete(sessionQueueKey(session));
	}
	persistQueuedPromptEntry({ action: "remove", id });
	publishState();
	sendSessionStatus(session);
	return queuedPrompt;
}

function clarificationRequestsForSession(sessionId: string): DesktopClarificationRequest[] {
	return Array.from(pendingClarificationsById.values())
		.filter((request) => request.sessionId === sessionId)
		.map((request) => ({
			id: request.id,
			sessionId: request.sessionId,
			question: request.question,
			options: request.options,
			createdAt: request.createdAt,
		}));
}

function settleClarificationRequest(
	request: PendingDesktopClarification,
	resolution: DesktopClarificationResolution,
): void {
	clearTimeout(request.timer);
	if (request.abortSignal && request.abortHandler) {
		request.abortSignal.removeEventListener("abort", request.abortHandler);
	}
	pendingClarificationsById.delete(request.id);
	request.resolve(resolution);
	if (current?.session.sessionId === request.sessionId) publishState();
}

function resolveClarificationRequest(id: string, resolution: DesktopClarificationResolution): boolean {
	const request = pendingClarificationsById.get(id);
	if (!request) return false;
	settleClarificationRequest(request, resolution);
	return true;
}

function permissionModeForSession(sessionId: string): DesktopPermissionMode {
	return permissionModesBySessionId.get(sessionId) ?? "bypassPermissions";
}

function isDesktopPermissionMode(value: unknown): value is DesktopPermissionMode {
	return value === "ask" || value === "acceptEdits" || value === "bypassPermissions";
}

function hydrateDesktopPermissionState(session: AgentSession): void {
	let mode: DesktopPermissionMode = "bypassPermissions";
	let grants = new Set<string>();
	for (const entry of session.sessionManager.getBranch()) {
		if (entry.type !== "custom" || entry.customType !== desktopPermissionStateEntryType) continue;
		const data = entry.data as Partial<DesktopPermissionState> | undefined;
		if (isDesktopPermissionMode(data?.mode)) mode = data.mode;
		if (Array.isArray(data?.grants)) {
			grants = new Set(
				data.grants
					.filter((grant): grant is string => typeof grant === "string")
					.map((grant) => grant.toLowerCase()),
			);
		}
	}
	permissionModesBySessionId.set(session.sessionId, mode);
	permissionGrantsBySessionId.set(session.sessionId, grants);
}

function persistDesktopPermissionState(sessionId: string): void {
	const session = getSession();
	if (session.sessionId !== sessionId) return;
	const data: DesktopPermissionState = {
		mode: permissionModeForSession(sessionId),
		grants: Array.from(permissionGrantsBySessionId.get(sessionId) ?? []).sort(),
	};
	session.sessionManager.appendCustomEntry(desktopPermissionStateEntryType, data);
}

function permissionRequestsForSession(sessionId: string): DesktopPermissionRequest[] {
	return Array.from(pendingPermissionsById.values())
		.filter((request) => request.sessionId === sessionId)
		.map((request) => ({
			id: request.id,
			sessionId: request.sessionId,
			toolCallId: request.toolCallId,
			toolName: request.toolName,
			toolInput: request.toolInput,
			reason: request.reason,
			createdAt: request.createdAt,
		}));
}

function settlePermissionRequest(request: PendingDesktopPermission, reply: DesktopPermissionReply): void {
	clearTimeout(request.timer);
	if (request.abortSignal && request.abortHandler) {
		request.abortSignal.removeEventListener("abort", request.abortHandler);
	}
	pendingPermissionsById.delete(request.id);
	request.resolve(reply);
	if (current?.session.sessionId === request.sessionId) publishState();
}

function resolvePermissionRequest(id: string, reply: DesktopPermissionReply): boolean {
	const request = pendingPermissionsById.get(id);
	if (!request) return false;
	if (reply === "allowAlways") {
		const grants = permissionGrantsBySessionId.get(request.sessionId) ?? new Set<string>();
		grants.add(request.toolName.toLowerCase());
		permissionGrantsBySessionId.set(request.sessionId, grants);
		persistDesktopPermissionState(request.sessionId);
	}
	settlePermissionRequest(request, reply);
	return true;
}

function hydrateLastTurnDiff(session: AgentSession): void {
	const diff = latestTurnDiff(session.sessionManager.getBranch());
	if (diff) {
		turnSnapshotsBySessionId.set(session.sessionId, { diff, untrackedPaths: new Set<string>() });
	} else {
		turnSnapshotsBySessionId.delete(session.sessionId);
	}
}

function normalizeDesktopTodos(value: unknown): DesktopTodo[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter(
			(item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item),
		)
		.map((item) => {
			const content = String(item.content ?? item.title ?? item.text ?? "").trim();
			const rawStatus = typeof item.status === "string" ? item.status.toLowerCase() : "pending";
			const status: DesktopTodoStatus = ["pending", "in_progress", "completed", "cancelled"].includes(rawStatus)
				? (rawStatus as DesktopTodoStatus)
				: "pending";
			return { content, status };
		})
		.filter((item) => item.content.length > 0);
}

function hydrateDesktopTodos(session: AgentSession): void {
	let todos: DesktopTodo[] = [];
	for (const entry of session.sessionManager.getBranch()) {
		if (entry.type !== "custom" || entry.customType !== desktopTodoStateEntryType) continue;
		const data = entry.data as { todos?: unknown } | undefined;
		todos = normalizeDesktopTodos(data?.todos);
	}
	todosBySessionId.set(session.sessionId, todos);
}

const todoParametersSchema = {
	type: "object",
	properties: {
		todos: {
			type: "array",
			items: {
				type: "object",
				properties: {
					content: { type: "string", description: "Todo item text" },
					status: { type: "string", description: "One of pending, in_progress, completed, cancelled" },
				},
				required: ["content", "status"],
			},
		},
	},
	required: ["todos"],
} as never;

const emptyParametersSchema = {
	type: "object",
	properties: {},
} as never;

const clarificationParametersSchema = {
	type: "object",
	properties: {
		question: { type: "string" },
		options: { type: "array", items: { type: "string" } },
	},
	required: ["question"],
	additionalProperties: false,
} as never;

const desktopPermissionExtension: ExtensionFactory = (pi) => {
	const autoAllowedTools = new Set(["ask_clarifying_question", "todoread", "todowrite"]);
	pi.on("session_start", async (_event, context) => {
		const sessionId = context.sessionManager.getSessionId();
		let mode: DesktopPermissionMode = "bypassPermissions";
		let grants = new Set<string>();
		for (const entry of context.sessionManager.getBranch()) {
			if (entry.type !== "custom" || entry.customType !== desktopPermissionStateEntryType) continue;
			const data = entry.data as Partial<DesktopPermissionState> | undefined;
			if (isDesktopPermissionMode(data?.mode)) mode = data.mode;
			if (Array.isArray(data?.grants)) {
				grants = new Set(
					data.grants
						.filter((grant): grant is string => typeof grant === "string")
						.map((grant) => grant.toLowerCase()),
				);
			}
		}
		permissionModesBySessionId.set(sessionId, mode);
		permissionGrantsBySessionId.set(sessionId, grants);
	});
	pi.on("tool_call", async (event, context) => {
		const sessionId = context.sessionManager.getSessionId();
		const mode = permissionModeForSession(sessionId);
		const normalizedTool = event.toolName.toLowerCase();
		if (
			mode === "bypassPermissions" ||
			autoAllowedTools.has(normalizedTool) ||
			permissionGrantsBySessionId.get(sessionId)?.has(normalizedTool)
		) {
			return undefined;
		}
		const isEditTool = ["edit", "write", "multiedit", "apply_patch"].includes(normalizedTool);
		if (mode === "acceptEdits" && isEditTool) return undefined;

		const requestId = `permission-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const reply = await new Promise<DesktopPermissionReply>((resolveReply) => {
			const request: PendingDesktopPermission = {
				id: requestId,
				sessionId,
				toolCallId: event.toolCallId,
				toolName: event.toolName,
				toolInput: event.input,
				reason: mode === "acceptEdits" ? "This non-edit tool requires approval." : "This tool requires approval.",
				createdAt: Date.now(),
				resolve: resolveReply,
				timer: setTimeout(() => {
					const pending = pendingPermissionsById.get(requestId);
					if (pending) settlePermissionRequest(pending, "timeout");
				}, permissionTimeoutMs),
			};
			pendingPermissionsById.set(requestId, request);
			if (context.signal) {
				request.abortSignal = context.signal;
				request.abortHandler = () => settlePermissionRequest(request, "reject");
				if (context.signal.aborted) {
					settlePermissionRequest(request, "reject");
				} else {
					context.signal.addEventListener("abort", request.abortHandler, { once: true });
				}
			}
			if (current?.session.sessionId === sessionId) publishState();
		});
		if (reply === "reject") return { block: true, reason: "User denied this action." };
		if (reply === "timeout") return { block: true, reason: "Permission request timed out." };
		return undefined;
	});
};

const desktopClarificationExtension: ExtensionFactory = (pi) => {
	pi.registerTool({
		name: "ask_clarifying_question",
		label: "Ask Question",
		description: "Ask the user a clarifying question and wait up to 5 minutes for a response.",
		parameters: clarificationParametersSchema,
		async execute(_toolCallId, params, signal, _onUpdate, context) {
			const rawQuestion = (params as { question?: unknown }).question;
			const question = typeof rawQuestion === "string" ? rawQuestion.trim() : "";
			if (!question) {
				return {
					content: [{ type: "text", text: "No clarification question was provided." }],
					details: { resolution: "invalid" },
				};
			}
			const rawOptions = (params as { options?: unknown }).options;
			const options = Array.from(
				new Set(
					(Array.isArray(rawOptions) ? rawOptions : [])
						.map((option) => (typeof option === "string" ? option.trim() : ""))
						.filter((option) => option.length > 0),
				),
			).slice(0, 8);
			const sessionId = context.sessionManager.getSessionId();
			const requestId = `clarification-${Date.now()}-${Math.random().toString(36).slice(2)}`;
			const resolution = await new Promise<DesktopClarificationResolution>((resolveResolution) => {
				const request: PendingDesktopClarification = {
					id: requestId,
					sessionId,
					question,
					options,
					createdAt: Date.now(),
					resolve: resolveResolution,
					timer: setTimeout(() => {
						const pending = pendingClarificationsById.get(requestId);
						if (pending) settleClarificationRequest(pending, { reason: "timeout" });
					}, clarificationTimeoutMs),
				};
				pendingClarificationsById.set(requestId, request);
				if (signal) {
					request.abortSignal = signal;
					request.abortHandler = () => settleClarificationRequest(request, { reason: "aborted" });
					if (signal.aborted) {
						settleClarificationRequest(request, { reason: "aborted" });
					} else {
						signal.addEventListener("abort", request.abortHandler, { once: true });
					}
				}
				if (current?.session.sessionId === sessionId) publishState();
			});
			const text =
				resolution.reason === "answered" && resolution.answer
					? resolution.answer
					: resolution.reason === "rejected"
						? "The user declined to answer this clarification."
						: resolution.reason === "timeout"
							? "No response was received within 5 minutes. Proceed with best judgment."
							: "The clarification request was cancelled.";
			return {
				content: [{ type: "text", text }],
				details: { question, resolution: resolution.reason },
			};
		},
	});
};

const desktopTodoExtension: ExtensionFactory = (pi) => {
	pi.registerTool({
		name: "todoread",
		label: "TodoRead",
		description: "Read the current task plan.",
		promptSnippet: "Read the current task plan.",
		parameters: emptyParametersSchema,
		async execute(_toolCallId, _params, _signal, _onUpdate, context) {
			const todos = todosBySessionId.get(context.sessionManager.getSessionId()) ?? [];
			const text = todos.length
				? todos.map((todo, index) => `${index + 1}. [${todo.status}] ${todo.content}`).join("\n")
				: "No todos";
			return { content: [{ type: "text", text }], details: { todos } };
		},
	});

	pi.registerTool({
		name: "todowrite",
		label: "TodoWrite",
		description: "Replace the visible task plan. Send the full ordered list every time.",
		promptSnippet: "Publish and update a visible task plan.",
		promptGuidelines: [
			"For multi-step work, use todowrite to publish the current plan and keep item status current.",
			"Use todoread before resuming work when the current plan is unclear.",
		],
		parameters: todoParametersSchema,
		async execute(_toolCallId, params, _signal, _onUpdate, context) {
			const todos = normalizeDesktopTodos((params as { todos?: unknown }).todos);
			const sessionId = context.sessionManager.getSessionId();
			todosBySessionId.set(sessionId, todos);
			pi.appendEntry(desktopTodoStateEntryType, { todos });
			const completed = todos.filter((todo) => todo.status === "completed").length;
			return {
				content: [{ type: "text", text: `Plan updated: ${completed}/${todos.length} complete.` }],
				details: { todos },
			};
		},
	});
};

function serializeSessionInfo(session: SessionInfo): DesktopSessionInfo {
	return {
		path: session.path,
		id: session.id,
		name: session.name,
		cwd: session.cwd,
		modified: session.modified.toISOString(),
		messageCount: session.messageCount,
		firstMessage: session.firstMessage,
		isRunning: current?.session.sessionId === session.id ? isSessionRunning(current.session) : undefined,
	};
}

function normalizePromptPayload(payload: unknown): DesktopPromptPayload {
	if (typeof payload === "string") {
		return { text: payload, images: [] };
	}
	if (!payload || typeof payload !== "object") {
		return { text: "", images: [] };
	}
	const typed = payload as { text?: unknown; images?: unknown };
	const images = Array.isArray(typed.images)
		? typed.images
				.filter((image): image is DesktopPromptImage =>
					Boolean(
						image &&
							typeof image === "object" &&
							(image as { type?: unknown }).type === "image" &&
							typeof (image as { data?: unknown }).data === "string" &&
							typeof (image as { mimeType?: unknown }).mimeType === "string",
					),
				)
				.map((image) => ({ type: "image" as const, data: image.data, mimeType: image.mimeType }))
		: [];
	return { text: typeof typed.text === "string" ? typed.text : "", images };
}

function imageMimeTypeForPath(path: string): string | undefined {
	switch (extname(path).toLowerCase()) {
		case ".png":
			return "image/png";
		case ".jpg":
		case ".jpeg":
			return "image/jpeg";
		case ".gif":
			return "image/gif";
		case ".webp":
			return "image/webp";
		case ".bmp":
			return "image/bmp";
		default:
			return undefined;
	}
}

async function serializeContextSelections(paths: string[]): Promise<DesktopContextSelection[]> {
	return Promise.all(
		paths.map(async (path) => {
			const mimeType = imageMimeTypeForPath(path);
			if (!mimeType) return { type: "path" as const, path, name: basename(path) };
			const data = (await readFile(path)).toString("base64");
			return { type: "image" as const, path, name: basename(path), data, mimeType };
		}),
	);
}

function normalizeGleanBaseUrl(baseUrl: string): string {
	const url = new URL(baseUrl);
	return `${url.protocol}//${url.host}`;
}

function maybeString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value : undefined;
}

async function fetchImageDataUrl(url: string, endpoint: string, accessToken: string): Promise<string | undefined> {
	if (url.startsWith("data:")) return url;
	if (!/^https?:\/\//i.test(url)) return undefined;
	const imageUrl = new URL(url);
	const endpointUrl = new URL(endpoint);
	const headers = imageUrl.origin === endpointUrl.origin ? { Authorization: `Bearer ${accessToken}` } : undefined;
	const response = await fetch(imageUrl.href, { headers });
	if (!response.ok) return undefined;
	const contentType = response.headers.get("content-type") || "image/png";
	if (!contentType.startsWith("image/")) return undefined;
	const bytes = Buffer.from(await response.arrayBuffer());
	return `data:${contentType};base64,${bytes.toString("base64")}`;
}

async function getGleanAuth(): Promise<DesktopGleanAuth | undefined> {
	await ensureDesktopSession();
	const authStorage = getSession().modelRegistry.authStorage;
	const credential = authStorage.get("glean") as { type?: string; baseUrl?: unknown } | undefined;
	const baseUrl = credential?.type === "oauth" ? maybeString(credential.baseUrl) : undefined;
	const accessToken = await authStorage.getApiKey("glean", { includeFallback: false });
	if (!baseUrl || !accessToken) return undefined;
	return { endpoint: normalizeGleanBaseUrl(baseUrl), accessToken };
}

async function fetchCurrentGleanUser(): Promise<DesktopCurrentUser | undefined> {
	const auth = await getGleanAuth();
	if (!auth) return undefined;
	const { accessToken, endpoint } = auth;
	const response = await fetch(`${endpoint}/api/v1/people?clientVersion=pi-desktop-${app.getVersion()}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ includeFields: ["PEOPLE_DETAILS", "PEOPLE_PROFILE_SETTINGS"] }),
	});
	if (!response.ok) throw new Error(`Unable to load current user (${response.status})`);
	const result = (await response.json()) as {
		results?: Array<{ name?: unknown; metadata?: Record<string, unknown> }>;
	};
	const person = result.results?.[0];
	const metadata = person?.metadata;
	const rawPhotoUrl = maybeString(metadata?.photoUrl) ?? maybeString(metadata?.uneditedPhotoUrl);
	const photoUrl = rawPhotoUrl?.startsWith("/") ? new URL(rawPhotoUrl, endpoint).href : rawPhotoUrl;
	return {
		endpoint,
		name:
			maybeString(person?.name) ??
			[maybeString(metadata?.firstName), maybeString(metadata?.lastName)].filter(Boolean).join(" "),
		email: maybeString(metadata?.email),
		photoUrl: photoUrl ? await fetchImageDataUrl(photoUrl, endpoint, accessToken).catch(() => photoUrl) : undefined,
	};
}

function serializeState(): DesktopState {
	const session = getSession();
	const model = session.model;
	const hasRealModel = Boolean(
		model && model.provider !== "unknown" && model.id !== "unknown" && session.modelRegistry.hasConfiguredAuth(model),
	);
	const availableModelCount = session.modelRegistry.getAvailable().length;
	return {
		cwd: currentCwd,
		sessionDir: getSession().sessionManager.getSessionDir(),
		sessionId: session.sessionId,
		sessionFile: session.sessionFile,
		sessionName: session.sessionManager.getSessionName(),
		model: hasRealModel && model ? { provider: model.provider, id: model.id } : undefined,
		contextUsage: session.getContextUsage(),
		lastTurnDiff: turnSnapshotsBySessionId.get(session.sessionId)?.diff,
		thinkingLevel: session.thinkingLevel,
		availableThinkingLevels: session.getAvailableThinkingLevels(),
		authRequired: availableModelCount === 0,
		availableModelCount,
		isStreaming: session.isStreaming,
		pendingMessageCount: session.pendingMessageCount + getQueuedPrompts(session).length,
		queuedPrompts: summarizeQueuedPrompts(session),
		permissionMode: permissionModeForSession(session.sessionId),
		permissionRequests: permissionRequestsForSession(session.sessionId),
		clarificationRequests: clarificationRequestsForSession(session.sessionId),
		messageCount: session.messages.length,
		todos: todosBySessionId.get(session.sessionId) ?? [],
	};
}

function serializeSessionExport(): { exportedAt: string; state: DesktopState; messages: DesktopMessage[] } {
	return {
		exportedAt: new Date().toISOString(),
		state: serializeState(),
		messages: serializeVisibleMessages(),
	};
}

function safeExportFileName(value: string | undefined): string {
	const normalized = (value || "pi-desktop-chat")
		.trim()
		.replace(/[^a-z0-9._-]+/gi, "-")
		.replace(/^-+|-+$/g, "");
	return `${normalized || "pi-desktop-chat"}.json`;
}

async function getSessionLogText(): Promise<string> {
	const sessionFile = getSession().sessionFile;
	if (sessionFile && existsSync(sessionFile)) return readFile(sessionFile, "utf8");
	return JSON.stringify(serializeSessionExport(), null, 2);
}

function pastedTextTempFileName(): string {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	return `pasted-text-${timestamp}.txt`;
}

async function writePastedTextTempFile(text: string): Promise<DesktopContextSelection> {
	const dir = await mkdtemp(join(tmpdir(), "pi-desktop-paste-"));
	const path = join(dir, pastedTextTempFileName());
	await writeFile(path, text, "utf8");
	return { type: "path", path, name: basename(path) };
}

function send(channel: string, payload: unknown): void {
	if (!mainWindow || mainWindow.isDestroyed()) return;
	mainWindow.webContents.send(channel, payload);
}

function publishState(): void {
	send("pi:state", serializeState());
}

function publishSessionSnapshot(): void {
	send("pi:messages", serializeVisibleMessages());
	publishState();
}

function isSessionRunning(session = getSession()): boolean {
	return session.isStreaming || session.pendingMessageCount > 0 || getQueuedPrompts(session).length > 0;
}

function sendSessionStatus(session = getSession(), isRunning = isSessionRunning(session)): void {
	send("pi:event", {
		type: "desktop_session_status",
		path: session.sessionFile,
		id: session.sessionId,
		isRunning,
	});
}

function scheduleSessionSnapshot(): void {
	if (pendingSessionSnapshot) return;
	pendingSessionSnapshot = setTimeout(() => {
		pendingSessionSnapshot = undefined;
		publishSessionSnapshot();
	}, 50);
}

function flushSessionSnapshot(): void {
	if (pendingSessionSnapshot) {
		clearTimeout(pendingSessionSnapshot);
		pendingSessionSnapshot = undefined;
	}
	publishSessionSnapshot();
}

function handleSessionEvent(event: AgentSessionEvent): void {
	send("pi:event", event);
	if (
		event.type === "agent_start" ||
		event.type === "agent_end" ||
		event.type === "queue_update" ||
		event.type === "tool_execution_start" ||
		event.type === "tool_execution_end"
	) {
		sendSessionStatus();
	}
	if (event.type === "agent_end" && !event.willRetry) {
		captureLastTurnDiff().catch(() => {});
		setTimeout(() => {
			startNextQueuedPrompt().catch((error) => {
				const message = error instanceof Error ? error.message : String(error);
				send("pi:event", { type: "desktop_error", message });
			});
		}, 0);
	}
	if (event.type === "message_update" || event.type === "tool_execution_update") {
		scheduleSessionSnapshot();
		return;
	}
	if (
		event.type === "message_end" ||
		event.type === "agent_end" ||
		event.type === "agent_start" ||
		event.type === "queue_update" ||
		event.type === "thinking_level_changed" ||
		event.type === "session_info_changed" ||
		event.type === "tool_execution_start" ||
		event.type === "tool_execution_end" ||
		event.type === "compaction_end"
	) {
		flushSessionSnapshot();
	}
}

async function ensureDesktopSession(): Promise<DesktopState> {
	if (sessionCreation) return sessionCreation;
	if (current) return serializeState();
	return createDesktopSession({ cwd: currentCwd });
}

async function createDesktopSession(
	options: { cwd?: string; sessionPath?: string; fresh?: boolean } = {},
): Promise<DesktopState> {
	sessionCreation = createDesktopSessionInner(options);
	try {
		return await sessionCreation;
	} finally {
		sessionCreation = undefined;
	}
}

async function createDesktopSessionInner(
	options: { cwd?: string; sessionPath?: string; fresh?: boolean } = {},
): Promise<DesktopState> {
	let targetCwd = resolve(options.cwd ?? currentCwd);
	if (options.sessionPath) {
		const opened = SessionManager.open(options.sessionPath);
		targetCwd = resolve(opened.getCwd());
	}
	const previousServices = currentServices;

	unsubscribeSession?.();
	unsubscribeSession = undefined;
	current?.session.dispose();
	current = undefined;

	let sessionManager: SessionManager;
	currentCwd = targetCwd;

	currentServices = previousServices?.cwd === currentCwd ? previousServices : servicesByCwd.get(currentCwd);
	if (!currentServices) {
		currentServices = await getOrCreateDesktopServices(currentCwd);
	}
	currentSessionDir = resolveSessionDir(currentServices.settingsManager.getSessionDir());
	if (options.sessionPath) {
		sessionManager = SessionManager.open(options.sessionPath, currentSessionDir, currentCwd);
	} else {
		sessionManager = options.fresh
			? SessionManager.create(currentCwd, currentSessionDir)
			: SessionManager.continueRecent(currentCwd, currentSessionDir);
	}

	current = await createAgentSessionFromServices({
		services: currentServices,
		sessionManager,
		sessionStartEvent: { type: "session_start", reason: "startup" },
	});
	hydrateQueuedPrompts(current.session);
	hydrateDesktopPermissionState(current.session);
	hydrateLastTurnDiff(current.session);
	hydrateDesktopTodos(current.session);
	unsubscribeSession = current.session.subscribe(handleSessionEvent);
	flushSessionSnapshot();
	return serializeState();
}

async function forkDesktopSession(entryId: string): Promise<DesktopState> {
	await ensureDesktopSession();
	const source = getSession();
	if (source.isStreaming) {
		throw new Error("Wait for the current response to finish before branching this chat.");
	}
	const sourceFile = source.sessionFile;
	if (!sourceFile) {
		throw new Error("This chat has not been persisted yet.");
	}
	const sourceEntry = source.sessionManager.getEntry(entryId);
	if (!sourceEntry || sourceEntry.type !== "message" || sourceEntry.message.role !== "assistant") {
		throw new Error("The selected response is no longer available for branching.");
	}
	const sessionManager = SessionManager.open(sourceFile, source.sessionManager.getSessionDir(), currentCwd);
	const forkedPath = sessionManager.createBranchedSession(entryId);
	if (!forkedPath) {
		throw new Error("Could not create a persisted branch for this chat.");
	}
	return createDesktopSession({ sessionPath: forkedPath });
}

async function listDesktopSessions(): Promise<DesktopSessionInfo[]> {
	const sessions = await SessionManager.listAll(currentSessionDir);
	const serialized = sessions.map(serializeSessionInfo);
	const session = getSession();
	if (session.sessionFile && !serialized.some((entry) => entry.path === session.sessionFile)) {
		const activeSession = sessions.find((entry) => entry.path === session.sessionFile);
		serialized.unshift(
			activeSession
				? serializeSessionInfo(activeSession)
				: {
						path: session.sessionFile,
						id: session.sessionId,
						name: session.sessionManager.getSessionName(),
						cwd: currentCwd,
						modified: new Date().toISOString(),
						messageCount: session.messages.length,
						firstMessage: "Current session",
					},
		);
	}
	warmDesktopServices(serialized.map((entry) => entry.cwd));
	return serialized;
}

async function findDesktopSessionById(sessionId: string): Promise<DesktopSessionInfo | undefined> {
	await ensureDesktopSession();
	if (current?.session.sessionId === sessionId) {
		const session = current.session;
		return {
			path: session.sessionFile ?? session.sessionId,
			id: session.sessionId,
			name: session.sessionManager.getSessionName(),
			cwd: currentCwd,
			modified: new Date().toISOString(),
			messageCount: session.messages.length,
			firstMessage: "Current session",
			isRunning: isSessionRunning(session),
		};
	}
	const configuredSessions = await SessionManager.listAll(currentSessionDir);
	const configuredMatch = configuredSessions.find((session) => session.id === sessionId);
	if (configuredMatch) return serializeSessionInfo(configuredMatch);
	if (!currentSessionDir) return undefined;
	const defaultMatch = (await SessionManager.listAll()).find((session) => session.id === sessionId);
	return defaultMatch ? serializeSessionInfo(defaultMatch) : undefined;
}

async function showPiDesktopSession(sessionId: string): Promise<void> {
	await ensureDesktopSession();
	if (current?.session.sessionId !== sessionId) {
		const session = await findDesktopSessionById(sessionId);
		if (!session || !session.path) throw new Error(`Pi Desktop chat ${sessionId} was not found on this device.`);
		await createDesktopSession({ sessionPath: session.path });
	}
	if (!mainWindow || mainWindow.isDestroyed()) {
		await createWindow();
	} else {
		mainWindow.show();
		mainWindow.focus();
	}
	publishState();
}

function openPiDesktopSessionLink(url: string): boolean {
	const sessionId = parsePiDesktopSessionDeepLink(url);
	if (!sessionId) return false;
	if (!app.isReady()) {
		pendingDeepLinkUrls.push(url);
		return true;
	}
	void showPiDesktopSession(sessionId).catch((error) => {
		const message = error instanceof Error ? error.message : String(error);
		console.error("Failed to open Pi Desktop session link", message);
		if (mainWindow && !mainWindow.isDestroyed()) {
			send("pi:event", { type: "desktop_error", message });
		}
	});
	return true;
}

function drainPendingDeepLinks(): void {
	for (const url of pendingDeepLinkUrls.splice(0)) {
		openPiDesktopSessionLink(url);
	}
}

function registerPiDesktopProtocolHandler(): void {
	if (didRegisterProtocolHandler) return;
	didRegisterProtocolHandler = true;
	app.setAsDefaultProtocolClient("pi");
	app.on("open-url", (event, url) => {
		if (openPiDesktopSessionLink(url)) event.preventDefault();
	});
	app.on("second-instance", (_event, argv) => {
		for (const value of argv) {
			if (openPiDesktopSessionLink(value)) break;
		}
	});
}

async function getGitStatus(): Promise<DesktopGitStatus> {
	try {
		await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd: currentCwd });
		const [{ stdout: branchOut }, { stdout: statusOut }, { stdout: diffOut }, { stdout: numStatOut }] =
			await Promise.all([
				execFileAsync("git", ["branch", "--show-current"], { cwd: currentCwd }),
				execFileAsync("git", ["status", "--short"], { cwd: currentCwd }),
				execFileAsync("git", ["diff", "--stat"], { cwd: currentCwd }),
				execFileAsync("git", ["diff", "--numstat"], { cwd: currentCwd }),
			]);
		const lineChanges = numStatOut
			.split("\n")
			.filter(Boolean)
			.reduce(
				(total, line) => {
					const [additions, deletions] = line.split("\t");
					return {
						additions: total.additions + (Number(additions) || 0),
						deletions: total.deletions + (Number(deletions) || 0),
					};
				},
				{ additions: 0, deletions: 0 },
			);
		return {
			isRepo: true,
			branch: branchOut.trim() || "detached",
			status: statusOut
				.split("\n")
				.map((line) => line.trimEnd())
				.filter(Boolean),
			diffStat: diffOut.trim(),
			...lineChanges,
		};
	} catch (error) {
		return {
			isRepo: false,
			status: [],
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function prFixPrompt(status: Extract<GithubPullRequestStatus, { kind: "ready" }>): DesktopPromptPayload {
	const failures = status.checks
		.filter((check) => check.state === "failed")
		.map((check) => `- ${check.name}${check.detailsUrl ? `: ${check.detailsUrl}` : ""}`)
		.join("\n");
	return {
		text: [
			`PR check monitor detected failing checks on #${status.number}: ${status.url}`,
			"",
			failures,
			"",
			"Use the locally installed gh CLI to inspect the failing run logs and identify the root cause.",
			"Implement the fixes, run targeted local verification, and summarize the result.",
			"Follow the workspace instructions for commit and push permissions; do not create a new pull request.",
		].join("\n"),
	};
}

async function getEnvironmentStatus(pullRequest?: GithubPullRequestStatus): Promise<DesktopEnvironmentStatus> {
	const [git, resolvedPullRequest] = await Promise.all([
		getGitStatus(),
		pullRequest ? Promise.resolve(pullRequest) : getGithubPullRequestStatus(currentCwd),
	]);
	return {
		git,
		pullRequest: resolvedPullRequest,
		monitoring: Boolean(prMonitor),
	};
}

function publishEnvironmentStatus(status: DesktopEnvironmentStatus): void {
	send("pi:environment-status", status);
	send("pi:event", { type: "desktop_environment_status", status });
}

async function runPrMonitorTick(monitor: DesktopPrMonitor): Promise<void> {
	if (monitor.tickInFlight) return monitor.tickInFlight;
	monitor.tickInFlight = (async () => {
		const pullRequest = await getGithubPullRequestStatus(currentCwd);
		const status = await getEnvironmentStatus(pullRequest);
		publishEnvironmentStatus(status);
		const signature = githubFailureSignature(pullRequest);
		if (!signature) {
			if (pullRequest.kind === "ready") monitor.lastFailureSignature = undefined;
			return;
		}
		if (
			signature === monitor.lastFailureSignature ||
			getSession().isStreaming ||
			getSession().pendingMessageCount > 0 ||
			getQueuedPrompts().length > 0
		) {
			return;
		}
		monitor.lastFailureSignature = signature;
		try {
			await submitPrompt(prFixPrompt(pullRequest as Extract<GithubPullRequestStatus, { kind: "ready" }>));
		} catch (error) {
			monitor.lastFailureSignature = undefined;
			throw error;
		}
	})()
		.catch((error) => {
			const message = error instanceof Error ? error.message : String(error);
			send("pi:event", { type: "desktop_error", message });
		})
		.finally(() => {
			monitor.tickInFlight = undefined;
		});
	return monitor.tickInFlight;
}

async function setPrMonitor(enabled: boolean): Promise<DesktopEnvironmentStatus> {
	if (!enabled) {
		if (prMonitor) clearInterval(prMonitor.timer);
		prMonitor = undefined;
		return getEnvironmentStatus();
	}
	if (!prMonitor) {
		prMonitor = {
			timer: undefined as unknown as NodeJS.Timeout,
		};
		prMonitor.timer = setInterval(() => {
			if (prMonitor) void runPrMonitorTick(prMonitor);
		}, prMonitorIntervalMs);
		await runPrMonitorTick(prMonitor);
	}
	return getEnvironmentStatus();
}

async function fixPrChecks(): Promise<DesktopEnvironmentStatus> {
	const pullRequest = await getGithubPullRequestStatus(currentCwd);
	if (pullRequest.kind !== "ready") throw new Error(pullRequest.message);
	if (pullRequest.state.toUpperCase() !== "OPEN") throw new Error("This pull request is not open.");
	if (pullRequest.failedCount === 0) throw new Error("This pull request has no failing checks.");
	const prompt = prFixPrompt(pullRequest);
	if (getSession().isStreaming || getSession().pendingMessageCount > 0) {
		queuePrompt(prompt);
	} else {
		await submitPrompt(prompt);
	}
	if (prMonitor) prMonitor.lastFailureSignature = githubFailureSignature(pullRequest);
	return getEnvironmentStatus(pullRequest);
}

async function getUntrackedPaths(cwd: string): Promise<string[]> {
	const { stdout } = await execFileAsync("git", ["ls-files", "--others", "--exclude-standard"], {
		cwd,
		timeout: 10_000,
	});
	return stdout
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

async function getUntrackedDiff(cwd: string, context: number, paths: string[]): Promise<string> {
	const chunks: string[] = [];
	for (const filePath of paths) {
		try {
			const { stdout } = await execFileAsync(
				"git",
				["diff", "--no-index", `--unified=${context}`, "--", "/dev/null", filePath],
				{
					cwd,
					maxBuffer: 10 * 1024 * 1024,
				},
			);
			chunks.push(stdout);
		} catch (error) {
			const stdout = typeof error === "object" && error && "stdout" in error ? String(error.stdout) : "";
			if (stdout) chunks.push(stdout);
		}
	}
	return chunks.join("\n");
}

async function getDesktopDiff(scope: DesktopDiffScope = "working-tree", context = 3): Promise<ParsedDiff> {
	await ensureDesktopSession();
	const session = getSession();
	const unifiedContext = Number.isFinite(context) ? Math.max(0, Math.min(20, Math.trunc(context))) : 3;
	const unified = `--unified=${unifiedContext}`;
	const snapshot = turnSnapshotsBySessionId.get(session.sessionId);
	if (scope === "last-turn" && snapshot?.diff && !snapshot.baseRef) {
		return snapshot.diff;
	}
	const args =
		scope === "staged"
			? ["diff", "--cached", unified]
			: scope === "last-turn" && snapshot?.baseRef
				? ["diff", unified, snapshot.baseRef]
				: ["diff", unified];
	try {
		const [{ stdout: trackedDiff }, untrackedPaths] = await Promise.all([
			execFileAsync("git", args, {
				cwd: currentCwd,
				maxBuffer: 10 * 1024 * 1024,
				timeout: 15_000,
			}),
			scope === "staged" ? Promise.resolve<string[]>([]) : getUntrackedPaths(currentCwd),
		]);
		const scopedUntrackedPaths =
			scope === "last-turn" && snapshot
				? untrackedPaths.filter((filePath) => !snapshot.untrackedPaths.has(filePath))
				: untrackedPaths;
		const untrackedDiff = await getUntrackedDiff(currentCwd, unifiedContext, scopedUntrackedPaths);
		return parseUnifiedDiff([trackedDiff, untrackedDiff].filter(Boolean).join("\n"));
	} catch (error) {
		console.error("[desktop] getDiff failed:", error instanceof Error ? error.message : error);
		return { files: [], totalAdditions: 0, totalDeletions: 0 };
	}
}

async function captureLastTurnBase(): Promise<void> {
	await ensureDesktopSession();
	const session = getSession();
	const snapshot: DesktopTurnSnapshot = { untrackedPaths: new Set<string>() };
	turnSnapshotsBySessionId.set(session.sessionId, snapshot);
	publishState();
	try {
		snapshot.untrackedPaths = new Set(await getUntrackedPaths(currentCwd));
		const { stdout } = await execFileAsync("git", ["stash", "create"], {
			cwd: currentCwd,
		});
		const sha = stdout.trim();
		if (sha) {
			snapshot.baseRef = sha;
			return;
		}
		const { stdout: headSha } = await execFileAsync("git", ["rev-parse", "HEAD"], {
			cwd: currentCwd,
		});
		snapshot.baseRef = headSha.trim();
	} catch {
		snapshot.baseRef = undefined;
		snapshot.untrackedPaths = new Set();
	}
}

async function captureLastTurnDiff(): Promise<void> {
	await ensureDesktopSession();
	const session = getSession();
	const snapshot = turnSnapshotsBySessionId.get(session.sessionId);
	if (!snapshot) return;
	snapshot.diff = await getDesktopDiff("last-turn", 0);
	snapshot.baseRef = undefined;
	session.sessionManager.appendCustomEntry(turnDiffEntryType, snapshot.diff);
	publishState();
}

async function submitPrompt(prompt: DesktopPromptPayload): Promise<void> {
	await captureLastTurnBase();
	await getSession().prompt(prompt.text, { images: prompt.images });
}

async function startNextQueuedPrompt(): Promise<void> {
	await ensureDesktopSession();
	const session = getSession();
	const key = sessionQueueKey(session);
	if (queuedPromptDrains.has(key)) return;
	if (session.isStreaming || session.pendingMessageCount > 0) return;
	const queuedPrompt = getQueuedPrompts(session)[0];
	if (!queuedPrompt) return;
	queuedPromptDrains.add(key);
	try {
		await submitPrompt(queuedPrompt);
		removeQueuedPrompt(queuedPrompt.id);
	} finally {
		queuedPromptDrains.delete(key);
	}
}

async function createWindow(): Promise<void> {
	mainWindow = new BrowserWindow({
		width: 1280,
		height: 860,
		minWidth: 900,
		minHeight: 620,
		title: "Pi Desktop",
		backgroundColor: "#111110",
		titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
		trafficLightPosition: process.platform === "darwin" ? { x: 16, y: 17 } : undefined,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			webviewTag: true,
			preload: resolve(__dirname, "preload.cjs"),
		},
	});

	mainWindow.webContents.on("will-attach-webview", (_event, webPreferences) => {
		webPreferences.nodeIntegration = false;
		webPreferences.contextIsolation = true;
		webPreferences.webSecurity = true;
		webPreferences.allowRunningInsecureContent = false;
	});
	mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
		callback(
			permission === "clipboard-read" ||
				permission === "clipboard-write" ||
				permission === "clipboard-sanitized-write",
		);
	});
	mainWindow.webContents.setWindowOpenHandler((details) => {
		if (/^https?:\/\//i.test(details.url)) {
			shell.openExternal(details.url).catch((error) => {
				console.warn(`Failed to open external URL ${details.url}:`, error);
			});
		}
		return { action: "deny" };
	});
	mainWindow.webContents.on("will-navigate", (event, url) => {
		if (url !== mainWindow?.webContents.getURL()) {
			event.preventDefault();
		}
	});
	mainWindow.webContents.on("before-input-event", (event, input) => {
		if (!focusedTerminalId || input.type !== "keyDown" || input.alt) return;
		const isCommand = process.platform === "darwin" ? input.meta && !input.control : input.control && !input.meta;
		if (!isCommand) return;
		let delta = 0;
		if (input.key === "+" || input.key === "=" || input.code === "Equal" || input.code === "NumpadAdd") {
			delta = 1;
		} else if (input.key === "-" || input.key === "_" || input.code === "Minus" || input.code === "NumpadSubtract") {
			delta = -1;
		}
		if (delta === 0) return;
		event.preventDefault();
		send("pi:terminal-zoom", { delta, terminalId: focusedTerminalId });
	});

	if (process.env.PI_DESKTOP_SMOKE === "1") {
		await mainWindow.webContents.session.clearStorageData({ storages: ["localstorage"] });
	}
	await mainWindow.loadFile(resolve(__dirname, "index.html"));
	mainWindow.show();
	mainWindow.focus();
	mainWindow.on("closed", () => {
		focusedTerminalId = undefined;
	});
	if (process.env.PI_DESKTOP_SMOKE === "1") {
		const result = await mainWindow.webContents.executeJavaScript(`
				(async () => {
					await new Promise((resolve) => setTimeout(resolve, 250));
					const state = await window.piDesktop.getState();
						const sessions = await window.piDesktop.listSessions();
						const git = await window.piDesktop.gitStatus();
						window.__piDesktopTest.renderState(state);
						window.__piDesktopTest.sessions = sessions;
						window.__piDesktopTest.renderSessionList();
						window.__piDesktopTest.renderState({
							...state,
							model: undefined,
							authRequired: true,
							availableModelCount: 0,
						});
						await new Promise((resolve) => setTimeout(resolve, 0));
						const loginScreenVisible = document.querySelector("#login-screen")?.hidden === false;
						const loginButtonText = document.querySelector("#login-button")?.textContent;
						const loginApiAvailable = typeof window.piDesktop.login === "function";
						const composerHiddenForLogin = document.querySelector("#composer")?.hidden === true;
						const messagesHiddenForLogin = document.querySelector("#messages")?.hidden === true;
						const authRequiredClassApplied = document.querySelector("#app")?.classList.contains("auth-required") === true;
						const composerDisplayForLogin = getComputedStyle(document.querySelector("#composer")).display;
						const messagesDisplayForLogin = getComputedStyle(document.querySelector("#messages")).display;
						const sidebarDisplayForLogin = getComputedStyle(document.querySelector(".sidebar")).display;
						const inspectorDisplayForLogin = getComputedStyle(document.querySelector(".inspector")).display;
						const topbarDisplayForLogin = getComputedStyle(document.querySelector(".topbar")).display;
						const loginPanelRect = document.querySelector(".login-panel").getBoundingClientRect();
						const mainVisibleRect = document.querySelector(".main").getBoundingClientRect();
						const appVisibleRect = document.querySelector("#app").getBoundingClientRect();
						const loginPanelVisible =
							loginPanelRect.top >= mainVisibleRect.top &&
							loginPanelRect.bottom <= mainVisibleRect.bottom &&
							loginPanelRect.left >= mainVisibleRect.left &&
							loginPanelRect.right <= mainVisibleRect.right;
						const loginUsesFullWindow =
							Math.abs(mainVisibleRect.left - appVisibleRect.left) <= 1 &&
							Math.abs(mainVisibleRect.right - appVisibleRect.right) <= 1;
						const smokeState = {
							...state,
							model: state.model ?? { provider: "glean", id: "smoke-model" },
							authRequired: false,
							availableModelCount: Math.max(state.availableModelCount ?? 0, 1),
						};
						window.__piDesktopTest.renderState(smokeState);
						await new Promise((resolve) => setTimeout(resolve, 0));
						if (
							!loginScreenVisible ||
							loginButtonText !== "Sign in with Glean" ||
							!loginApiAvailable ||
							!composerHiddenForLogin ||
							!messagesHiddenForLogin ||
							!authRequiredClassApplied ||
							composerDisplayForLogin !== "none" ||
							messagesDisplayForLogin !== "none" ||
							sidebarDisplayForLogin !== "none" ||
							inspectorDisplayForLogin !== "none" ||
							topbarDisplayForLogin !== "none" ||
							!loginUsesFullWindow ||
							!loginPanelVisible
						) {
							throw new Error("Login screen did not render for unauthenticated state");
						}
						const expectedProjectCount = new Set(sessions.map((session) => session.cwd)).size;
						const renderedProjectCount = document.querySelectorAll(".session-group-heading").length;
						const renderedSessionCount = document.querySelectorAll(".session-item").length;
						const paginationCount = document.querySelectorAll(".session-pagination").length;
						const projectCounts = sessions.reduce((counts, session) => {
							counts.set(session.cwd, (counts.get(session.cwd) ?? 0) + 1);
							return counts;
						}, new Map());
						const projectsNeedingPagination = Array.from(projectCounts.values()).filter((count) => count > 5).length;
						if (renderedProjectCount !== expectedProjectCount) {
							throw new Error("Sidebar did not render every project group");
						}
						if (renderedSessionCount >= sessions.length && projectsNeedingPagination > 0) {
							throw new Error("Sidebar rendered all sessions instead of paginating within projects");
						}
						if (paginationCount !== projectsNeedingPagination) {
							throw new Error("Sidebar pagination controls do not match projects needing pagination");
						}
							const app = document.querySelector("#app");
						const leftResizer = document.querySelector("#left-resizer");
						const leftToggle = document.querySelector("#toggle-left-panel");
						const newChatButton = document.querySelector("[data-new-session]");
						const rightToggle = document.querySelector("#toggle-right-panel");
						const rect = (element) => {
							const bounds = element.getBoundingClientRect();
							return {
								left: Math.round(bounds.left),
								top: Math.round(bounds.top),
								right: Math.round(bounds.right),
								bottom: Math.round(bounds.bottom),
							};
						};
						const sameRect = (a, b) =>
							Math.abs(a.left - b.left) <= 1 &&
							Math.abs(a.top - b.top) <= 1 &&
							Math.abs(a.right - b.right) <= 1 &&
							Math.abs(a.bottom - b.bottom) <= 1;
						const isHitTarget = (element) => {
							const bounds = element.getBoundingClientRect();
							const target = document.elementFromPoint(
								Math.round(bounds.left + bounds.width / 2),
								Math.round(bounds.top + bounds.height / 2),
							);
							return target === element || element.contains(target);
						};
						const leftToggleLabel = leftToggle.getAttribute("aria-label");
						const defaultRightCollapsed = app.classList.contains("right-collapsed");
						const topbarHeight = Math.round(document.querySelector(".topbar").getBoundingClientRect().height);
					const addButton = document.querySelector("#composer-add");
					const addMenu = document.querySelector("#composer-add-menu");
					const modelButton = document.querySelector("#composer-model");
					const modelMenu = document.querySelector("#composer-model-menu");
					addButton.click();
					await new Promise((resolve) => setTimeout(resolve, 0));
					const addMenuOpened = addMenu.hidden === false;
					const addMenuCommandCount = addMenu.querySelectorAll(".composer-command").length;
						const addMenuSwitchCount = addMenu.querySelectorAll(".menu-switch").length;
						const addMenuSeparatorCount = addMenu.querySelectorAll(".composer-menu-separator").length;
						const addMenuContextActions = Array.from(addMenu.querySelectorAll("[data-context-kind]")).map(
							(button) => button.getAttribute("data-context-kind"),
						);
						const addMenuUnsupportedItemsPresent = ["Plan mode", "Pursue goal", "Create", "Plugins"].some((label) =>
							addMenu.textContent.includes(label),
						);
						const chooseContextAvailable = typeof window.piDesktop.chooseContext === "function";
						addButton.click();
						modelButton.click();
						await new Promise((resolve) => setTimeout(resolve, 0));
						const modelMenuItemCount = modelMenu.querySelectorAll(".model-menu-item").length;
						const modelOptionCount = modelMenu.querySelectorAll(".model-menu-item[data-value]").length;
						const hasModelOptions = modelOptionCount > 0;
						const modelMenuOpened = hasModelOptions ? modelMenu.hidden === false : true;
						const modelMenuHasActiveItem = hasModelOptions ? modelMenu.querySelector(".model-menu-item.active") !== null : true;
						const modelMenuHasReasoning = hasModelOptions ? modelMenu.textContent.includes("Reasoning") : true;
						const modelButtonHasCaret = getComputedStyle(modelButton, "::after").content !== "none";
						const modelFilterInput = modelMenu.querySelector(".model-filter input");
						if (hasModelOptions && !modelFilterInput) {
							throw new Error("Model menu is missing its filter input");
						}
						if (modelFilterInput) {
							modelFilterInput.value = "claude";
							modelFilterInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
						}
						const visibleFilteredModels = Array.from(modelMenu.querySelectorAll(".model-menu-item[data-value]")).filter(
							(item) => !item.hidden && getComputedStyle(item).display !== "none",
						);
						const modelFilterReducedResults = hasModelOptions ? visibleFilteredModels.length < modelOptionCount : true;
						const modelFilterMatchesQuery = visibleFilteredModels.every((item) =>
							item.textContent.toLowerCase().includes("claude"),
						);
						const modelFilterHidesNonMatches = Array.from(
							modelMenu.querySelectorAll(".model-menu-item[data-value][hidden]"),
						).every((item) => getComputedStyle(item).display === "none");
						if (addMenuCommandCount !== 2 || addMenuSwitchCount !== 0 || addMenuSeparatorCount !== 0) {
							throw new Error("Add menu should only show the two supported context actions");
						}
						if (addMenuUnsupportedItemsPresent) {
							throw new Error("Add menu still shows unsupported actions");
						}
						if (!modelFilterReducedResults || !modelFilterMatchesQuery || !modelFilterHidesNonMatches) {
							throw new Error("Model menu filter did not narrow results to matching models");
						}
						modelButton.click();
					const settingsTrigger = document.querySelector("#sidebar-settings-trigger");
					const settingsPopover = document.querySelector("#sidebar-settings-popover");
					const beforeSettingsOpen = settingsPopover.hidden === false;
					settingsTrigger.click();
					await new Promise((resolve) => setTimeout(resolve, 0));
					const afterSettingsOpen = settingsPopover.hidden === false;
					const settingsExpandedState = settingsTrigger.getAttribute("aria-expanded");
					const settingsPopoverHasControls =
						settingsPopover.querySelector("#cwd-input") !== null &&
						settingsPopover.querySelector("#model-select") !== null &&
						settingsPopover.querySelector("#theme-select") !== null &&
						settingsPopover.querySelector("#settings-logout") !== null;
					const settingsLogoutText = settingsPopover.querySelector("#settings-logout")?.textContent?.trim();
					const settingsTriggerRect = rect(settingsTrigger);
					const settingsPopoverRect = rect(settingsPopover);
					const settingsInputRect = rect(settingsPopover.querySelector("#cwd-input"));
					const settingsActionRect = rect(settingsPopover.querySelector("#settings-logout"));
					const settingsPopoverFloatsAbove = settingsPopoverRect.bottom <= settingsTriggerRect.top - 4;
					const settingsPopoverCompact = settingsPopoverRect.right - settingsPopoverRect.left <= 320;
					const settingsControlsCompact =
						settingsInputRect.bottom - settingsInputRect.top <= 36 &&
						settingsActionRect.bottom - settingsActionRect.top <= 36;
					document.body.click();
					await new Promise((resolve) => setTimeout(resolve, 0));
					const settingsClosedOnOutsideClick = settingsPopover.hidden === true;
					if (
						!afterSettingsOpen ||
						settingsExpandedState !== "true" ||
						!settingsPopoverHasControls ||
						settingsLogoutText !== "Logout" ||
						!settingsPopoverFloatsAbove ||
						!settingsPopoverCompact ||
						!settingsControlsCompact ||
						!settingsClosedOnOutsideClick
					) {
						throw new Error("Settings popover did not behave as expected");
					}
					leftToggle.focus();
					await new Promise((resolve) => setTimeout(resolve, 0));
					const focusedControlShadow = getComputedStyle(leftToggle).boxShadow;
					const beforeGrid = getComputedStyle(app).gridTemplateColumns;
				leftResizer.dispatchEvent(new PointerEvent("pointerdown", { clientX: 300, pointerId: 1, bubbles: true }));
				window.dispatchEvent(new PointerEvent("pointermove", { clientX: 360, pointerId: 1, bubbles: true }));
				window.dispatchEvent(new PointerEvent("pointerup", { clientX: 360, pointerId: 1, bubbles: true }));
				await new Promise((resolve) => setTimeout(resolve, 0));
					const afterGrid = getComputedStyle(app).gridTemplateColumns;
					const beforeToggleCollapsed = app.classList.contains("left-collapsed");
						const leftToggleExpandedRect = rect(leftToggle);
						const newChatExpandedRect = rect(newChatButton);
						leftToggle.click();
						await new Promise((resolve) => setTimeout(resolve, 0));
						const afterToggleCollapsed = app.classList.contains("left-collapsed");
						const leftToggleCollapsedRect = rect(leftToggle);
						const newChatCollapsedRect = rect(newChatButton);
						const titleCollapsedRect = rect(document.querySelector(".topbar-title"));
						leftToggle.click();
					const beforeRightToggleCollapsed = app.classList.contains("right-collapsed");
						const rightToggleCollapsedRect = rect(rightToggle);
						rightToggle.click();
						await new Promise((resolve) => setTimeout(resolve, 0));
						const afterRightToggleCollapsed = app.classList.contains("right-collapsed");
						const rightToggleExpandedRect = rect(rightToggle);
						if (!sameRect(leftToggleExpandedRect, leftToggleCollapsedRect)) {
							throw new Error("Left panel toggle moved between expanded and collapsed states");
						}
						if (!sameRect(newChatExpandedRect, newChatCollapsedRect)) {
							throw new Error("New chat button moved between expanded and collapsed left panel states");
						}
						if (newChatCollapsedRect.right > titleCollapsedRect.left) {
							throw new Error("Collapsed header title overlaps fixed left controls");
						}
						if (!sameRect(rightToggleCollapsedRect, rightToggleExpandedRect)) {
							throw new Error("Right panel toggle moved between collapsed and expanded states");
						}
						if (!isHitTarget(leftToggle)) {
							throw new Error("Left panel toggle is not the topmost pointer target");
						}
						if (!isHitTarget(newChatButton)) {
							throw new Error("New chat button is not the topmost pointer target");
						}
						if (!isHitTarget(rightToggle)) {
							throw new Error("Right panel toggle is not the topmost pointer target");
						}
						if (getComputedStyle(document.querySelector(".topbar")).webkitAppRegion === "drag") {
							throw new Error("Topbar drag region covers fixed header controls");
						}
						const threePanelComposerHintDisplay = getComputedStyle(document.querySelector("#composer-hint")).display;
						rightToggle.click();
				window.__piDesktopTest.renderMessages([
					{
						role: "user",
						text: "Show markdown",
						content: [
							{
								type: "text",
								text: "Show markdown\\n\\nUse this path as context:\\n- /tmp/selected.log",
							},
							{
								type: "image",
								data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
								mimeType: "image/png",
							},
						],
						timestamp: Date.now(),
					},
					{
						role: "assistant",
						text: "",
						content: [{ type: "thinking", text: "Hidden reasoning should not render" }],
						timestamp: Date.now(),
					},
					{
						role: "assistant",
						text: "",
						content: [
							{
								type: "text",
								text:
									"### Heading\\n\\n- one\\n- two\\n\\n\`\`\`ts\\nconst value = 1;\\n\`\`\`\\n\\n---\\n\\n| Layer | Runs where | Does what |\\n|-------|------------|-----------|\\n| UI | Renderer process | Text input and markdown rendering |\\n| IPC bridge | preload.ts | Exposes window.piDesktop.* |",
							},
							{ type: "toolCall", id: "call_1", name: "read", input: { path: "README.md" } },
						],
						toolCalls: [{ type: "toolCall", id: "call_1", name: "read", input: { path: "README.md" } }],
						timestamp: Date.now(),
					},
					{
						role: "toolResult",
						text: "file contents",
						content: [{ type: "text", text: "file contents" }],
						toolCallId: "call_1",
						toolName: "read",
						isError: false,
						timestamp: Date.now(),
					},
						{
							role: "assistant",
							text: "Done",
							content: [{ type: "text", text: "Done" }],
							timestamp: Date.now(),
						},
						{
							role: "error",
							text: "OpenAI API error (400): request failed",
							content: [{ type: "text", text: "OpenAI API error (400): request failed" }],
							timestamp: Date.now(),
						},
					]);
					await new Promise((resolve) => setTimeout(resolve, 0));
					const composerHeight = Math.round(document.querySelector(".composer-shell").getBoundingClientRect().height);
					const composerShellOverflow = getComputedStyle(document.querySelector(".composer-shell")).overflow;
					const defaultMessageTimeOpacity = getComputedStyle(document.querySelector(".message-time")).opacity;
					const userMessageMeta = document.querySelector(".message.user .message-hover-meta");
					const userMessageMetaOpacity = getComputedStyle(userMessageMeta).opacity;
					const userMessageModelText = document.querySelector(".message.user .message-model")?.textContent;
					const userMessageHasHeader = document.querySelector(".message.user .message-header") !== null;
					const mainRect = document.querySelector(".main").getBoundingClientRect();
					const assistantRect = document.querySelector(".message.assistant").getBoundingClientRect();
					const userRect = document.querySelector(".message.user").getBoundingClientRect();
					const composerRect = document.querySelector(".composer-shell").getBoundingClientRect();
					const mainStyle = getComputedStyle(document.querySelector(".main"));
					const mainLeft = Math.round(mainRect.left);
					const mainRight = Math.round(mainRect.right);
					const assistantLeft = Math.round(assistantRect.left);
					const assistantRight = Math.round(assistantRect.right);
					const userRight = Math.round(userRect.right);
					const userWidth = Math.round(userRect.width);
					const composerRight = Math.round(composerRect.right);
					const composerWidth = Math.round(composerRect.width);
					const assistantLeftGap = assistantLeft - mainLeft;
					const composerLeftGap = Math.round(composerRect.left) - mainLeft;
					const userRightGap = mainRight - userRight;
					const composerRightGap = mainRight - composerRight;
					const assistantContainedInMain = assistantRight <= mainRight + 1;
				const prompt = document.querySelector("#prompt");
				const defaultPromptHeight = Math.round(prompt.getBoundingClientRect().height);
				prompt.value = "line one\\nline two\\nline three\\nline four\\nline five";
				prompt.dispatchEvent(new InputEvent("input", { bubbles: true }));
				await new Promise((resolve) => setTimeout(resolve, 0));
					const grownPromptHeight = Math.round(prompt.getBoundingClientRect().height);
						const textareaResize = getComputedStyle(prompt).resize;
						const slashCommands = window.__piDesktopTest.getSlashCommands();
						const slashHasSupportedCommands =
							slashCommands.includes("new") &&
							slashCommands.includes("model") &&
							slashCommands.includes("compact") &&
							slashCommands.includes("name") &&
							slashCommands.includes("session") &&
							slashCommands.includes("copy") &&
							slashCommands.includes("reload") &&
							slashCommands.includes("quit");
						const slashHidesUnsupportedPiCommands =
							!slashCommands.includes("share") &&
							!slashCommands.includes("login") &&
							!slashCommands.includes("fork");
						prompt.value = "/";
						prompt.dispatchEvent(new InputEvent("input", { bubbles: true }));
						await new Promise((resolve) => setTimeout(resolve, 0));
						const slashMenuOpen = document.querySelector(".slash-command-menu")?.hidden === false;
						const slashMenuShowsNew = document.querySelector(".slash-command-menu")?.textContent?.includes("/new") === true;
						prompt.value = "/sha";
						prompt.dispatchEvent(new InputEvent("input", { bubbles: true }));
						await new Promise((resolve) => setTimeout(resolve, 0));
						const slashMenuHidesUnsupported = document.querySelector(".slash-command-menu")?.hidden === true;
						prompt.value = "/model opus";
						prompt.dispatchEvent(new InputEvent("input", { bubbles: true }));
						await new Promise((resolve) => setTimeout(resolve, 0));
						const slashModelSearchOpen = hasModelOptions ? document.querySelector(".slash-command-menu")?.hidden === false : true;
						const slashModelSearchShowsMatch =
							hasModelOptions
								? document.querySelector(".slash-command-menu")?.textContent?.toLowerCase().includes("opus") === true
								: true;
						prompt.value = "/session";
						prompt.dispatchEvent(new InputEvent("input", { bubbles: true }));
						document.querySelector("#composer").requestSubmit();
						await new Promise((resolve) => setTimeout(resolve, 50));
						const slashSessionNotice = Array.from(document.querySelectorAll(".message.notice")).some((message) =>
							message.textContent.includes("Session") && message.textContent.includes("CWD:"),
						);
						prompt.value = "/share";
						prompt.dispatchEvent(new InputEvent("input", { bubbles: true }));
						document.querySelector("#composer").requestSubmit();
						await new Promise((resolve) => setTimeout(resolve, 50));
						const slashUnknownRejected = Array.from(document.querySelectorAll(".message.error")).some((message) =>
							message.textContent.includes("Unknown command: /share"),
						);
						prompt.value = "";
						prompt.dispatchEvent(new InputEvent("input", { bubbles: true }));
						if (
							!slashHasSupportedCommands ||
							!slashHidesUnsupportedPiCommands ||
							!slashMenuOpen ||
							!slashMenuShowsNew ||
							!slashMenuHidesUnsupported ||
							!slashModelSearchOpen ||
							!slashModelSearchShowsMatch ||
							!slashSessionNotice ||
							!slashUnknownRejected
						) {
							throw new Error("Slash command palette did not match supported desktop commands");
						}
						const pastedImageFile = new File(
							[new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
							"paste.png",
							{ type: "image/png" },
						);
						const pasteData = new DataTransfer();
						pasteData.items.add(pastedImageFile);
						const pasteEvent = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
						Object.defineProperty(pasteEvent, "clipboardData", { value: pasteData });
						prompt.dispatchEvent(pasteEvent);
						await new Promise((resolve) => setTimeout(resolve, 0));
						const pastedAttachmentCount = document.querySelectorAll(".composer-attachment").length;
						const pastedAttachmentPreviewed = document.querySelector(".composer-attachment img") !== null;
						const sendEnabledWithPastedImage = document.querySelector("#send").disabled === false;
						document.querySelector(".composer-attachment-preview")?.click();
						await new Promise((resolve) => setTimeout(resolve, 0));
						const largePreviewOpened =
							document.querySelector(".image-preview-overlay")?.hidden === false &&
							document.querySelector(".image-preview-dialog img") !== null;
						const previewImage = document.querySelector(".image-preview-dialog img");
						const initialZoomLabel = document.querySelector(".image-preview-zoom-label")?.textContent;
						document.querySelectorAll(".image-preview-zoom-button")[1]?.click();
						await new Promise((resolve) => setTimeout(resolve, 0));
						const zoomedInLabel = document.querySelector(".image-preview-zoom-label")?.textContent;
						const zoomedInScale = previewImage?.style.getPropertyValue("--preview-zoom");
						document.querySelectorAll(".image-preview-zoom-button")[0]?.click();
						await new Promise((resolve) => setTimeout(resolve, 0));
						const zoomedOutLabel = document.querySelector(".image-preview-zoom-label")?.textContent;
						const zoomedOutScale = previewImage?.style.getPropertyValue("--preview-zoom");
						document.querySelector(".image-preview-close")?.click();
						await new Promise((resolve) => setTimeout(resolve, 0));
						const largePreviewClosed = document.querySelector(".image-preview-overlay")?.hidden === true;
						document.querySelector(".composer-attachment-remove")?.click();
						await new Promise((resolve) => setTimeout(resolve, 0));
						const pastedAttachmentRemoved = document.querySelectorAll(".composer-attachment").length === 0;
						window.__piDesktopTest.applyContextSelections([
							{
								type: "image",
								path: "/tmp/selected.png",
								name: "selected.png",
								data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
								mimeType: "image/png",
							},
						]);
						await new Promise((resolve) => setTimeout(resolve, 0));
						const selectedImageAttachmentCount = document.querySelectorAll(".composer-attachment").length;
						const selectedImageAttachmentPreviewed = document.querySelector(".composer-attachment img") !== null;
						const sendEnabledWithSelectedImage = document.querySelector("#send").disabled === false;
						document.querySelector(".composer-attachment-remove")?.click();
						await new Promise((resolve) => setTimeout(resolve, 0));
						const selectedImageAttachmentRemoved = document.querySelectorAll(".composer-attachment").length === 0;
						window.__piDesktopTest.applyContextSelections(
							[{ type: "path", path: "/tmp/selected.log", name: "selected.log" }],
							{ attachPathChips: true },
						);
						await new Promise((resolve) => setTimeout(resolve, 0));
						const selectedFileAttachmentCount = document.querySelectorAll(".composer-file-attachment").length;
						const selectedFileAttachmentName = document.querySelector(".composer-file-name")?.textContent;
						const selectedFileAttachmentType = document.querySelector(".composer-file-type")?.textContent;
						const sendEnabledWithSelectedFile = document.querySelector("#send").disabled === false;
						document.querySelector(".composer-file-remove")?.click();
						await new Promise((resolve) => setTimeout(resolve, 0));
						const selectedFileAttachmentRemoved = document.querySelectorAll(".composer-file-attachment").length === 0;
						if (
							pastedAttachmentCount !== 1 ||
							!pastedAttachmentPreviewed ||
							!sendEnabledWithPastedImage ||
							!largePreviewOpened ||
							initialZoomLabel !== "100%" ||
							zoomedInLabel !== "125%" ||
							zoomedInScale !== "1.25" ||
							zoomedOutLabel !== "100%" ||
							zoomedOutScale !== "1" ||
							!largePreviewClosed ||
							!pastedAttachmentRemoved ||
							selectedImageAttachmentCount !== 1 ||
							!selectedImageAttachmentPreviewed ||
							!sendEnabledWithSelectedImage ||
							!selectedImageAttachmentRemoved ||
							selectedFileAttachmentCount !== 1 ||
							selectedFileAttachmentName !== "selected.log" ||
							selectedFileAttachmentType !== "LOG" ||
							!sendEnabledWithSelectedFile ||
							!selectedFileAttachmentRemoved
						) {
							throw new Error("Composer image paste preview did not behave as expected");
						}
							const errorStyle = getComputedStyle(document.querySelector(".message.error"));
							const contextRowStyle = getComputedStyle(document.querySelector(".context-summary div"));
							const sendButtonBg = getComputedStyle(document.querySelector("#send")).backgroundColor;
							const activeSessionStyle = getComputedStyle(document.querySelector(".session-item.active"));
							const responsiveBeforeCollapsed = app.classList.contains("left-collapsed");
							const originalInnerWidth = window.innerWidth;
							Object.defineProperty(window, "innerWidth", { value: 900, configurable: true });
							window.dispatchEvent(new Event("resize"));
							await new Promise((resolve) => setTimeout(resolve, 0));
							const responsiveAutoCollapsed = app.classList.contains("left-collapsed");
							Object.defineProperty(window, "innerWidth", { value: originalInnerWidth, configurable: true });
							window.dispatchEvent(new Event("resize"));
							const userMessageText = document.querySelector(".message.user .message-body")?.textContent;
							const markdownHeading = document.querySelector(
								".message.assistant .markdown h3, .message.assistant .markdown h4, .message.assistant .markdown h5",
							)?.textContent;
							const markdownCode = document.querySelector(".message.assistant .markdown pre code")?.textContent;
							const markdownTableHeader = document.querySelector(".message.assistant .markdown table th")?.textContent;
							const markdownTableCell = document.querySelector(
								".message.assistant .markdown table tbody tr:nth-child(2) td:nth-child(2)",
							)?.textContent;
							const markdownTableRowCount = document.querySelectorAll(".message.assistant .markdown table tbody tr").length;
							const markdownTableRendered = document.querySelector(".message.assistant .markdown table") !== null;
							const markdownHorizontalRuleRendered = document.querySelector(".message.assistant .markdown hr") !== null;
							const thinkingHidden =
								document.querySelector("#messages")?.textContent?.includes("Hidden reasoning should not render") === false;
							const toolGroupText = document.querySelector(".tool-group summary")?.textContent;
							const toolGroupCollapsed = document.querySelector(".tool-group")?.open === false;
							const toolResultHiddenAsMessage = document.querySelector(".message.toolResult") === null;
							const noStaticSessionMergeIcon = document.querySelector(".session-item-icon") === null;
							const renderedAttachmentCount = document.querySelectorAll(".message.user .message-image-tile").length;
							const renderedFileChipCount = document.querySelectorAll(".message.user .message-file-chip").length;
							const renderedFileChipName = document.querySelector(".message.user .message-file-chip-name")?.textContent;
							const userBubbleExcludesImage = document.querySelector(".message.user .message-user-bubble img") === null;
							const userBubbleExcludesFileContext =
								document.querySelector(".message.user .message-user-bubble")?.textContent?.includes("Use this path as context") ===
								false;
							document.querySelector(".message.user .message-image-tile")?.click();
							await new Promise((resolve) => setTimeout(resolve, 0));
							const renderedAttachmentPreviewOpened =
								document.querySelector(".image-preview-overlay")?.hidden === false &&
								document.querySelector(".image-preview-dialog img") !== null;
							document.querySelector(".image-preview-close")?.click();
							await new Promise((resolve) => setTimeout(resolve, 0));
							if (
								renderedAttachmentCount !== 1 ||
								renderedFileChipCount !== 1 ||
								renderedFileChipName !== "selected.log" ||
								!userBubbleExcludesImage ||
								!userBubbleExcludesFileContext ||
								!renderedAttachmentPreviewOpened
							) {
								throw new Error("Rendered user image attachment did not match expected tile behavior");
							}
							const overflowMessages = Array.from({ length: 48 }, (_, index) => ({
								role: index % 2 === 0 ? "user" : "assistant",
								text: \`Scroll test \${index}\\n\\nLine one\\n\\nLine two\\n\\nLine three\`,
								content: [{ type: "text", text: \`Scroll test \${index}\\n\\nLine one\\n\\nLine two\\n\\nLine three\` }],
								timestamp: Date.now() + index,
							}));
							const messagePane = document.querySelector("#messages");
							const isAtMessageBottom = () => messagePane.scrollHeight - messagePane.scrollTop - messagePane.clientHeight <= 32;
							window.__piDesktopTest.renderMessages(overflowMessages);
							await new Promise((resolve) => setTimeout(resolve, 0));
							messagePane.scrollTop = messagePane.scrollHeight;
							messagePane.dispatchEvent(new Event("scroll"));
							await new Promise((resolve) => setTimeout(resolve, 0));
							window.__piDesktopTest.renderMessages([
								...overflowMessages,
								{
									role: "assistant",
									text: "Streaming bottom update",
									content: [{ type: "text", text: "Streaming bottom update\\n\\nStill following." }],
									timestamp: Date.now(),
								},
							]);
							await new Promise((resolve) => setTimeout(resolve, 0));
							const autoFollowStayedAtBottom = isAtMessageBottom();
							messagePane.scrollTop = Math.max(0, messagePane.scrollHeight - messagePane.clientHeight - 220);
							messagePane.dispatchEvent(new Event("scroll"));
							await new Promise((resolve) => setTimeout(resolve, 0));
							const scrolledUpTop = messagePane.scrollTop;
							window.__piDesktopTest.renderMessages([
								...overflowMessages,
								{
									role: "assistant",
									text: "Streaming scrolled-up update\\n\\nMore content\\n\\nMore content\\n\\nMore content",
									content: [
										{
											type: "text",
											text: "Streaming scrolled-up update\\n\\nMore content\\n\\nMore content\\n\\nMore content",
										},
									],
									timestamp: Date.now(),
								},
							]);
							await new Promise((resolve) => setTimeout(resolve, 0));
							const scrollHeldWhileStreaming = Math.abs(messagePane.scrollTop - scrolledUpTop) <= 1;
							messagePane.scrollTop = messagePane.scrollHeight;
							messagePane.dispatchEvent(new Event("scroll"));
							await new Promise((resolve) => setTimeout(resolve, 0));
							window.__piDesktopTest.renderMessages([
								...overflowMessages,
								{
									role: "assistant",
									text: "Streaming resumed update",
									content: [{ type: "text", text: "Streaming resumed update\\n\\nBack at the bottom." }],
									timestamp: Date.now(),
								},
							]);
							await new Promise((resolve) => setTimeout(resolve, 0));
							const autoFollowResumedAtBottom = isAtMessageBottom();
							if (!autoFollowStayedAtBottom || !scrollHeldWhileStreaming || !autoFollowResumedAtBottom) {
								throw new Error("Streaming message scroll follow behavior did not match expectations");
							}
							return {
						title: document.querySelector("#session-title")?.textContent,
						documentTitle: document.title,
						cwd: state.cwd,
					sessionDir: state.sessionDir,
					sessionId: state.sessionId,
							sessionCount: sessions.length,
							expectedProjectCount,
							renderedProjectCount,
							renderedSessionCount,
							paginationCount,
							projectsNeedingPagination,
							loginScreenVisible,
							loginButtonText,
							loginApiAvailable,
							composerHiddenForLogin,
							messagesHiddenForLogin,
							authRequiredClassApplied,
							composerDisplayForLogin,
							messagesDisplayForLogin,
							sidebarDisplayForLogin,
							inspectorDisplayForLogin,
							topbarDisplayForLogin,
							loginUsesFullWindow,
							loginPanelVisible,
					modelText: document.querySelector("#composer-model")?.textContent,
					userMessageText,
					userMessageMetaHidden: userMessageMetaOpacity === "0",
					userMessageModelText,
					userMessageHasHeader,
					markdownHeading,
					markdownCode,
					markdownTableHeader,
					markdownTableCell,
					markdownTableRowCount,
					markdownTableRendered,
					markdownHorizontalRuleRendered,
					thinkingHidden,
					toolGroupText,
						toolGroupCollapsed,
						toolResultHiddenAsMessage,
						renderedAttachmentCount,
						renderedFileChipCount,
						renderedFileChipName,
						userBubbleExcludesImage,
						userBubbleExcludesFileContext,
						renderedAttachmentPreviewOpened,
					gitBranch: git.branch,
						gitIsRepo: git.isRepo,
						resizeChanged: beforeGrid !== afterGrid,
									leftToggleChanged: beforeToggleCollapsed !== afterToggleCollapsed,
										leftToggleLabel,
										leftToggleSticky: sameRect(leftToggleExpandedRect, leftToggleCollapsedRect),
										newChatSticky: sameRect(newChatExpandedRect, newChatCollapsedRect),
										leftToggleHitTarget: isHitTarget(leftToggle),
										newChatHitTarget: isHitTarget(newChatButton),
										leftToggleExpandedRect,
										leftToggleCollapsedRect,
										newChatExpandedRect,
										newChatCollapsedRect,
										titleCollapsedRect,
										defaultRightCollapsed,
											settingsToggleChanged: beforeSettingsOpen !== afterSettingsOpen,
											settingsExpandedState,
											settingsPopoverHasControls,
											settingsLogoutText,
											settingsPopoverFloatsAbove,
											settingsPopoverCompact,
											settingsControlsCompact,
											settingsClosedOnOutsideClick,
										noStaticSessionMergeIcon,
												addMenuOpened,
												addMenuCommandCount,
												addMenuSwitchCount,
												addMenuSeparatorCount,
												addMenuContextActions,
												addMenuUnsupportedItemsPresent,
												chooseContextAvailable,
												modelMenuOpened,
												modelMenuItemCount,
												modelMenuHasActiveItem,
												modelMenuHasReasoning,
												modelButtonHasCaret,
												modelFilterReducedResults,
												modelFilterMatchesQuery,
												modelFilterHidesNonMatches,
										rightToggleChanged: beforeRightToggleCollapsed !== afterRightToggleCollapsed,
										rightToggleSticky: sameRect(rightToggleCollapsedRect, rightToggleExpandedRect),
										rightToggleHitTarget: isHitTarget(rightToggle),
										rightToggleCollapsedRect,
										rightToggleExpandedRect,
								threePanelComposerHintDisplay,
								topbarHeight,
									topbarIsDragRegion: getComputedStyle(document.querySelector(".topbar")).webkitAppRegion === "drag",
									focusedControlHasRing: focusedControlShadow !== "none",
									sendButtonIsNeutral: sendButtonBg !== "rgb(87, 213, 195)",
										activeSessionHasNoHeavyShadow: activeSessionStyle.boxShadow === "none",
										composerHeight,
										composerShellAllowsMenus: composerShellOverflow === "visible",
										assistantLeftGap,
										composerLeftGap,
										userRightGap,
										composerRightGap,
										userAlignedToComposerRight: Math.abs(userRightGap - composerRightGap) <= 1,
										userBubbleIsNotFullWidth: userWidth < composerWidth,
										assistantContainedInMain,
										mainClipsOverflow: mainStyle.overflow === "hidden" && mainStyle.contain.includes("paint"),
						promptAutosized: grownPromptHeight > defaultPromptHeight,
						defaultMessageTimeOpacity,
						textareaResize,
						slashHasSupportedCommands,
						slashHidesUnsupportedPiCommands,
						slashMenuOpen,
						slashMenuShowsNew,
						slashMenuHidesUnsupported,
						slashModelSearchOpen,
						slashModelSearchShowsMatch,
						slashSessionNotice,
						slashUnknownRejected,
						pastedAttachmentCount,
						pastedAttachmentPreviewed,
						sendEnabledWithPastedImage,
						largePreviewOpened,
						initialZoomLabel,
						zoomedInLabel,
						zoomedInScale,
						zoomedOutLabel,
						zoomedOutScale,
						largePreviewClosed,
						pastedAttachmentRemoved,
						selectedImageAttachmentCount,
						selectedImageAttachmentPreviewed,
						sendEnabledWithSelectedImage,
						selectedImageAttachmentRemoved,
						selectedFileAttachmentCount,
						selectedFileAttachmentName,
						selectedFileAttachmentType,
						sendEnabledWithSelectedFile,
						selectedFileAttachmentRemoved,
						errorHasFrame: errorStyle.borderTopStyle !== "none" && errorStyle.paddingTop !== "0px",
						contextRowsAreFlat: contextRowStyle.borderLeftStyle === "none" && contextRowStyle.backgroundColor === "rgba(0, 0, 0, 0)",
						autoFollowStayedAtBottom,
						scrollHeldWhileStreaming,
						autoFollowResumedAtBottom,
						responsiveBeforeCollapsed,
						responsiveAutoCollapsed,
						beforeGrid,
						afterGrid,
					};
			})()
		`);
		console.log(`PI_DESKTOP_SMOKE_RESULT ${JSON.stringify(result)}`);
		app.quit();
	}
	mainWindow.on("closed", () => {
		mainWindow = undefined;
	});
}

function installApplicationMenu(): void {
	const template: MenuItemConstructorOptions[] = [
		{
			label: appName,
			submenu: [
				{ role: "about", label: `About ${appName}` },
				{ type: "separator" },
				{ role: "services" },
				{ type: "separator" },
				{ role: "hide", label: `Hide ${appName}` },
				{ role: "hideOthers" },
				{ role: "unhide" },
				{ type: "separator" },
				{ role: "quit", label: `Quit ${appName}` },
			],
		},
		{
			label: "File",
			submenu: [{ role: "close" }],
		},
		{
			label: "Edit",
			submenu: [
				{ role: "undo" },
				{ role: "redo" },
				{ type: "separator" },
				{ role: "cut" },
				{ role: "copy" },
				{ role: "paste" },
				{ role: "selectAll" },
			],
		},
		{
			label: "View",
			submenu: [
				{ role: "reload" },
				{ role: "toggleDevTools" },
				{ type: "separator" },
				{ role: "resetZoom" },
				{ role: "zoomIn" },
				{ role: "zoomOut" },
				{ type: "separator" },
				{ role: "togglefullscreen" },
			],
		},
		{
			label: "Window",
			submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }],
		},
		{
			label: "Help",
			submenu: [],
		},
	];
	Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle("pi:init", async () => ensureDesktopSession());
ipcMain.handle("pi:get-state", async () => {
	await ensureDesktopSession();
	return serializeState();
});
ipcMain.handle("pi:get-current-user", async () => fetchCurrentGleanUser());
ipcMain.handle("pi:get-glean-auth", async () => getGleanAuth());
ipcMain.handle("pi:get-messages", async () => {
	await ensureDesktopSession();
	return serializeVisibleMessages();
});
ipcMain.handle("pi:get-session-log", async () => {
	await ensureDesktopSession();
	return getSessionLogText();
});
ipcMain.handle("pi:export-session", async () => {
	await ensureDesktopSession();
	const exportPayload = serializeSessionExport();
	const result = await dialog.showSaveDialog(mainWindow!, {
		defaultPath: safeExportFileName(exportPayload.state.sessionName || exportPayload.state.sessionId),
		filters: [{ name: "JSON", extensions: ["json"] }],
		title: "Export Pi Desktop chat",
	});
	if (result.canceled || !result.filePath) return { canceled: true };
	await writeFile(result.filePath, JSON.stringify(exportPayload, null, 2), "utf8");
	return { canceled: false, filePath: result.filePath };
});
ipcMain.handle("pi:show-item-in-folder", (_event, filePath: string) => {
	if (typeof filePath !== "string" || !filePath) return;
	shell.showItemInFolder(filePath);
});
ipcMain.handle("pi:get-session-deep-link", async () => {
	await ensureDesktopSession();
	return piDesktopSessionDeepLink(getSession().sessionId);
});
ipcMain.handle("pi:list-sessions", async () => {
	await ensureDesktopSession();
	return listDesktopSessions();
});
ipcMain.handle("pi:new-session", async () => createDesktopSession({ cwd: currentCwd, fresh: true }));
ipcMain.handle("pi:switch-session", async (_event, sessionPath: string) => createDesktopSession({ sessionPath }));
ipcMain.handle("pi:fork-session", async (_event, entryId: string) => forkDesktopSession(entryId));
ipcMain.handle("pi:set-response-feedback", async (_event, entryId: string, rating: unknown) => {
	await ensureDesktopSession();
	if (rating !== null && rating !== "positive" && rating !== "negative") {
		throw new Error(`Unsupported response feedback: ${String(rating)}`);
	}
	const session = getSession();
	const entry = session.sessionManager.getEntry(entryId);
	const isOnCurrentBranch = session.sessionManager.getBranch().some((candidate) => candidate.id === entryId);
	if (!isOnCurrentBranch || !entry || entry.type !== "message" || entry.message.role !== "assistant") {
		throw new Error("The selected assistant response is no longer active in this chat.");
	}
	session.sessionManager.appendCustomEntry(responseFeedbackEntryType, { entryId, rating });
	const messages = serializeVisibleMessages();
	send("pi:messages", messages);
	return messages;
});
ipcMain.handle("pi:prompt", async (_event, payload: unknown) => {
	await ensureDesktopSession();
	const prompt = normalizePromptPayload(payload);
	if (getSession().isStreaming || getSession().pendingMessageCount > 0 || getQueuedPrompts().length > 0) {
		queuePrompt(prompt);
	} else {
		await submitPrompt(prompt);
	}
	const next = serializeState();
	send("pi:state", next);
	return next;
});
ipcMain.handle("pi:queue-prompt", async (_event, payload: unknown) => {
	await ensureDesktopSession();
	const prompt = normalizePromptPayload(payload);
	if (getSession().isStreaming || getSession().pendingMessageCount > 0 || getQueuedPrompts().length > 0) {
		queuePrompt(prompt);
	} else {
		await submitPrompt(prompt);
	}
	const next = serializeState();
	send("pi:state", next);
	return next;
});
ipcMain.handle("pi:steer-prompt", async (_event, payload: unknown) => {
	await ensureDesktopSession();
	const prompt = normalizePromptPayload(payload);
	if (getSession().isStreaming || getSession().pendingMessageCount > 0) {
		await getSession().steer(prompt.text, prompt.images);
	} else {
		await submitPrompt(prompt);
	}
	const next = serializeState();
	send("pi:state", next);
	return next;
});
ipcMain.handle("pi:take-queued-prompt", async (_event, id: string) => {
	await ensureDesktopSession();
	const queuedPrompt = removeQueuedPrompt(id);
	const next = serializeState();
	send("pi:state", next);
	return { state: next, prompt: queuedPrompt };
});
ipcMain.handle("pi:steer-queued-prompt", async (_event, id: string) => {
	await ensureDesktopSession();
	const queuedPrompt = getQueuedPrompts().find((prompt) => prompt.id === id);
	if (!queuedPrompt) return serializeState();
	if (getSession().isStreaming || getSession().pendingMessageCount > 0) {
		await getSession().steer(queuedPrompt.text, queuedPrompt.images);
	} else {
		await submitPrompt(queuedPrompt);
	}
	removeQueuedPrompt(id);
	const next = serializeState();
	send("pi:state", next);
	return next;
});
ipcMain.handle("pi:resolve-clarification", async (_event, id: string, answer: unknown) => {
	await ensureDesktopSession();
	const trimmed = typeof answer === "string" ? answer.trim() : "";
	if (!trimmed) throw new Error("Clarification answer cannot be empty.");
	resolveClarificationRequest(id, { answer: trimmed, reason: "answered" });
	const next = serializeState();
	send("pi:state", next);
	return next;
});
ipcMain.handle("pi:reject-clarification", async (_event, id: string) => {
	await ensureDesktopSession();
	resolveClarificationRequest(id, { reason: "rejected" });
	const next = serializeState();
	send("pi:state", next);
	return next;
});
ipcMain.handle("pi:set-permission-mode", async (_event, mode: unknown) => {
	await ensureDesktopSession();
	if (!isDesktopPermissionMode(mode)) {
		throw new Error(`Unsupported permission mode: ${String(mode)}`);
	}
	const sessionId = getSession().sessionId;
	permissionModesBySessionId.set(sessionId, mode);
	persistDesktopPermissionState(sessionId);
	if (mode === "bypassPermissions") {
		for (const request of Array.from(pendingPermissionsById.values())) {
			if (request.sessionId === sessionId) settlePermissionRequest(request, "allowOnce");
		}
	}
	const next = serializeState();
	send("pi:state", next);
	return next;
});
ipcMain.handle("pi:resolve-permission", async (_event, id: string, reply: unknown) => {
	await ensureDesktopSession();
	if (reply !== "allowOnce" && reply !== "allowAlways" && reply !== "reject") {
		throw new Error(`Unsupported permission reply: ${String(reply)}`);
	}
	resolvePermissionRequest(id, reply);
	const next = serializeState();
	send("pi:state", next);
	return next;
});
ipcMain.handle("pi:abort", async () => {
	await ensureDesktopSession();
	await getSession().abort();
	const next = serializeState();
	send("pi:state", next);
	return next;
});
ipcMain.handle("pi:create-temp-text-file", async (_event, text: string) => {
	if (typeof text !== "string" || text.length === 0) throw new Error("No text provided.");
	return writePastedTextTempFile(text);
});
ipcMain.handle("pi:choose-context", async (_event, kind: "files" | "folder" | "workspace") => {
	await ensureDesktopSession();
	if (kind === "workspace") {
		return [{ type: "path", path: currentCwd, name: basename(currentCwd) }];
	}
	const result = await dialog.showOpenDialog(mainWindow!, {
		defaultPath: currentCwd,
		properties:
			kind === "folder" ? ["openDirectory", "createDirectory"] : ["openFile", "multiSelections", "showHiddenFiles"],
	});
	if (result.canceled) return [];
	if (kind === "folder") return result.filePaths.map((path) => ({ type: "path", path, name: basename(path) }));
	return serializeContextSelections(result.filePaths);
});
ipcMain.handle("pi:set-cwd", async (_event, cwd: string) => {
	if (!existsSync(cwd)) throw new Error(`Path does not exist: ${cwd}`);
	return createDesktopSession({ cwd });
});
ipcMain.handle("pi:list-models", async () => {
	await ensureDesktopSession();
	const models = await getSession().modelRegistry.getAvailable();
	return models.map((model) => ({
		provider: model.provider,
		id: model.id,
		contextWindow: model.contextWindow,
	}));
});
ipcMain.handle("pi:set-model", async (_event, provider: string, id: string) => {
	await ensureDesktopSession();
	const model = getSession().modelRegistry.find(provider, id);
	if (!model) throw new Error(`Unknown model: ${provider}/${id}`);
	await getSession().setModel(model);
	return serializeState();
});
ipcMain.handle("pi:set-thinking-level", async (_event, level: string) => {
	await ensureDesktopSession();
	getSession().setThinkingLevel(level as never);
	return serializeState();
});
ipcMain.handle("pi:compact", async (_event, customInstructions?: string) => {
	await ensureDesktopSession();
	await getSession().compact(
		typeof customInstructions === "string" ? customInstructions.trim() || undefined : undefined,
	);
	return serializeState();
});
ipcMain.handle("pi:set-session-name", async (_event, name: string) => {
	await ensureDesktopSession();
	const trimmed = name.trim();
	if (!trimmed) throw new Error("Usage: /name <chat name>");
	getSession().setSessionName(trimmed);
	return serializeState();
});
ipcMain.handle("pi:reload-session", async () => {
	await ensureDesktopSession();
	await getSession().reload();
	return serializeState();
});
async function loginDesktopSession(): Promise<DesktopLoginResult> {
	await ensureDesktopSession();
	const session = getSession();
	const provider =
		session.modelRegistry.authStorage.getOAuthProviders().find((candidate) => candidate.id === "glean") ??
		session.modelRegistry.authStorage.getOAuthProviders()[0];
	if (!provider) throw new Error("No OAuth login provider is available.");
	try {
		await session.modelRegistry.authStorage.login(provider.id as never, {
			onAuth: (info) => {
				shell.openExternal(info.url).catch(() => {});
			},
			onDeviceCode: (info) => {
				shell.openExternal(info.verificationUri).catch(() => {});
			},
			onPrompt: async () => "",
			onProgress: () => {},
			onManualCodeInput: () => new Promise<string>(() => {}),
			onSelect: async (prompt) => prompt.options[0]?.id,
		});
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "EADDRINUSE") {
			throw new Error("Glean login is already in progress. Complete the browser login or restart Pi Desktop.");
		}
		throw error;
	}
	session.modelRegistry.refresh();
	const availableModels = await session.modelRegistry.getAvailable();
	if (availableModels.length > 0 && (!session.model || !session.modelRegistry.hasConfiguredAuth(session.model))) {
		await session.setModel(availableModels[0]!);
	}
	return { state: serializeState(), message: `Logged in to ${provider.name}` };
}

ipcMain.handle("pi:login", async (): Promise<DesktopLoginResult> => {
	if (!loginInFlight) {
		loginInFlight = loginDesktopSession().finally(() => {
			loginInFlight = undefined;
		});
	}
	return loginInFlight;
});
ipcMain.handle("pi:logout", async () => {
	await ensureDesktopSession();
	const session = getSession();
	const provider = session.model?.provider;
	if (!provider) throw new Error("No model provider is selected.");
	session.modelRegistry.authStorage.logout(provider);
	session.modelRegistry.refresh();
	return {
		state: serializeState(),
		message: `Logged out of ${provider}. Environment variables and models.json config are unchanged.`,
	};
});
ipcMain.handle("pi:quit", () => {
	app.quit();
});
ipcMain.handle("pi:git-status", async () => {
	await ensureDesktopSession();
	return getGitStatus();
});
ipcMain.handle("pi:environment-status", async () => {
	await ensureDesktopSession();
	return getEnvironmentStatus();
});
ipcMain.handle("pi:set-pr-monitor", async (_event, enabled: boolean) => {
	await ensureDesktopSession();
	const status = await setPrMonitor(enabled === true);
	publishEnvironmentStatus(status);
	return status;
});
ipcMain.handle("pi:fix-pr-checks", async () => {
	await ensureDesktopSession();
	const status = await fixPrChecks();
	publishEnvironmentStatus(status);
	return status;
});
ipcMain.handle("pi:get-diff", async (_event, scope?: DesktopDiffScope, context?: number) =>
	getDesktopDiff(scope, context),
);

// Terminal (PTY) management
const terminalProcesses = new Map<string, pty.IPty>();

ipcMain.handle("pi:terminal-create", (_event, terminalId = "default") => {
	if (terminalProcesses.has(terminalId)) return;
	const userShell = process.env.SHELL || "/bin/zsh";
	const shellName = basename(userShell);
	const shellArgs = shellName === "zsh" || shellName === "bash" ? ["-i"] : [];
	const ptyProcess = pty.spawn(userShell, shellArgs, {
		name: "xterm-256color",
		cols: 80,
		rows: 24,
		cwd: currentCwd,
		env: process.env as Record<string, string>,
	});
	terminalProcesses.set(terminalId, ptyProcess);
	ptyProcess.onData((data) => {
		send("pi:terminal-data", { data, terminalId });
	});
	ptyProcess.onExit(({ exitCode, signal }) => {
		if (terminalProcesses.get(terminalId) !== ptyProcess) return;
		send("pi:terminal-data", {
			data: `\r\n[terminal exited: code ${exitCode}${signal ? `, signal ${signal}` : ""}]\r\n`,
			terminalId,
		});
		terminalProcesses.delete(terminalId);
		if (focusedTerminalId === terminalId) focusedTerminalId = undefined;
	});
});

ipcMain.on("pi:terminal-write", (_event, terminalId: string, data: string) => {
	terminalProcesses.get(terminalId)?.write(data);
});

ipcMain.on("pi:terminal-resize", (_event, terminalId: string, cols: number, rows: number) => {
	if (!Number.isFinite(cols) || !Number.isFinite(rows) || cols <= 0 || rows <= 0) return;
	terminalProcesses.get(terminalId)?.resize(cols, rows);
});

ipcMain.on("pi:terminal-focus", (_event, terminalId: string, focused: boolean) => {
	focusedTerminalId = focused ? terminalId : focusedTerminalId === terminalId ? undefined : focusedTerminalId;
});

function destroyTerminals(terminalId?: string): void {
	if (terminalId) {
		terminalProcesses.get(terminalId)?.kill();
		terminalProcesses.delete(terminalId);
		if (focusedTerminalId === terminalId) focusedTerminalId = undefined;
		return;
	}
	for (const terminalProcess of terminalProcesses.values()) {
		terminalProcess.kill();
	}
	terminalProcesses.clear();
	focusedTerminalId = undefined;
}

ipcMain.handle("pi:terminal-destroy", (_event, terminalId?: string) => {
	destroyTerminals(terminalId);
});

ipcMain.on("pi:terminal-destroy-all", () => {
	destroyTerminals();
});

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
	app.quit();
}
registerPiDesktopProtocolHandler();
for (const value of process.argv) {
	openPiDesktopSessionLink(value);
}

app.whenReady().then(async () => {
	installApplicationMenu();
	await createDesktopSession();
	await createWindow();
	app.focus({ steal: true });
	publishState();
	drainPendingDeepLinks();
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});

app.on("activate", async () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		await createWindow();
		publishState();
	}
});

app.on("before-quit", () => {
	isQuitting = true;
	if (prMonitor) {
		clearInterval(prMonitor.timer);
		prMonitor = undefined;
	}
	if (pendingSessionSnapshot) {
		clearTimeout(pendingSessionSnapshot);
		pendingSessionSnapshot = undefined;
	}
	destroyTerminals();
	unsubscribeSession?.();
	current?.session.dispose();
	for (const services of servicesByCwd.values()) {
		services.mcpDisconnect?.().catch(() => {});
	}
	servicesByCwd.clear();
	serviceCreationsByCwd.clear();
});
