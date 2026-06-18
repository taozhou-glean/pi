import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
	type AgentSession,
	type AgentSessionEvent,
	type AgentSessionServices,
	type CreateAgentSessionResult,
	createAgentSessionFromServices,
	createAgentSessionServices,
	type SessionInfo,
	SessionManager,
} from "@earendil-works/pi-coding-agent";
import { app, BrowserWindow, dialog, ipcMain, Menu, type MenuItemConstructorOptions } from "electron";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const appName = "Pi Desktop";

app.setName(appName);

type DesktopMessage = {
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
	thinkingLevel?: string;
	isStreaming: boolean;
	pendingMessageCount: number;
	messageCount: number;
};

type DesktopSessionInfo = {
	path: string;
	id: string;
	name?: string;
	cwd: string;
	modified: string;
	messageCount: number;
	firstMessage: string;
};

let mainWindow: BrowserWindow | undefined;
let current: CreateAgentSessionResult | undefined;
let currentServices: AgentSessionServices | undefined;
const servicesByCwd = new Map<string, AgentSessionServices>();
const serviceCreationsByCwd = new Map<string, Promise<AgentSessionServices>>();
let sessionCreation: Promise<DesktopState> | undefined;
let unsubscribeSession: (() => void) | undefined;
let currentCwd = resolve(process.env.PI_DESKTOP_CWD || process.cwd());
let currentSessionDir: string | undefined;
const providerAllowlist = ["glean"];
const envSessionDir = "PI_CODING_AGENT_SESSION_DIR";
let isQuitting = false;

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

function serializeMessage(message: unknown): DesktopMessage {
	const typed = message as {
		role?: string;
		content?: unknown;
		timestamp?: number;
		toolCallId?: string;
		toolName?: string;
		isError?: boolean;
		errorMessage?: string;
	};
	return {
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
	return messages.map(serializeMessage);
}

function serializeSessionInfo(session: SessionInfo): DesktopSessionInfo {
	return {
		path: session.path,
		id: session.id,
		name: session.name,
		cwd: session.cwd,
		modified: session.modified.toISOString(),
		messageCount: session.messageCount,
		firstMessage: session.firstMessage,
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

function serializeState(): DesktopState {
	const session = getSession();
	const model = session.model;
	const hasRealModel = Boolean(model && model.provider !== "unknown" && model.id !== "unknown");
	return {
		cwd: currentCwd,
		sessionDir: getSession().sessionManager.getSessionDir(),
		sessionId: session.sessionId,
		sessionFile: session.sessionFile,
		sessionName: session.sessionManager.getSessionName(),
		model: hasRealModel && model ? { provider: model.provider, id: model.id } : undefined,
		thinkingLevel: session.thinkingLevel,
		isStreaming: session.isStreaming,
		pendingMessageCount: session.pendingMessageCount,
		messageCount: session.messages.length,
	};
}

function send(channel: string, payload: unknown): void {
	if (!mainWindow || mainWindow.isDestroyed()) return;
	mainWindow.webContents.send(channel, payload);
}

function publishState(): void {
	send("pi:state", serializeState());
}

function handleSessionEvent(event: AgentSessionEvent): void {
	send("pi:event", event);
	if (
		event.type === "message_update" ||
		event.type === "message_end" ||
		event.type === "agent_end" ||
		event.type === "agent_start" ||
		event.type === "queue_update" ||
		event.type === "thinking_level_changed" ||
		event.type === "session_info_changed"
	) {
		send("pi:messages", serializeVisibleMessages());
		publishState();
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
	unsubscribeSession = current.session.subscribe(handleSessionEvent);
	send("pi:messages", serializeVisibleMessages());
	publishState();
	return serializeState();
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

async function getGitStatus(): Promise<{
	isRepo: boolean;
	branch?: string;
	status: string[];
	diffStat?: string;
	error?: string;
}> {
	try {
		await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd: currentCwd });
		const [{ stdout: branchOut }, { stdout: statusOut }, { stdout: diffOut }] = await Promise.all([
			execFileAsync("git", ["branch", "--show-current"], { cwd: currentCwd }),
			execFileAsync("git", ["status", "--short"], { cwd: currentCwd }),
			execFileAsync("git", ["diff", "--stat"], { cwd: currentCwd }),
		]);
		return {
			isRepo: true,
			branch: branchOut.trim() || "detached",
			status: statusOut
				.split("\n")
				.map((line) => line.trimEnd())
				.filter(Boolean),
			diffStat: diffOut.trim(),
		};
	} catch (error) {
		return {
			isRepo: false,
			status: [],
			error: error instanceof Error ? error.message : String(error),
		};
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
		trafficLightPosition: process.platform === "darwin" ? { x: 16, y: 18 } : undefined,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: resolve(__dirname, "preload.cjs"),
		},
	});

	if (process.env.PI_DESKTOP_SMOKE === "1") {
		await mainWindow.webContents.session.clearStorageData({ storages: ["localstorage"] });
	}
	await mainWindow.loadFile(resolve(__dirname, "index.html"));
	mainWindow.show();
	mainWindow.focus();
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
						const modelMenuOpened = modelMenu.hidden === false;
						const modelMenuItemCount = modelMenu.querySelectorAll(".model-menu-item").length;
						const modelOptionCount = modelMenu.querySelectorAll(".model-menu-item[data-value]").length;
						const modelMenuHasActiveItem = modelMenu.querySelector(".model-menu-item.active") !== null;
						const modelMenuHasReasoning = modelMenu.textContent.includes("Reasoning");
						const modelButtonHasCaret = getComputedStyle(modelButton, "::after").content !== "none";
						const modelFilterInput = modelMenu.querySelector(".model-filter input");
						if (!modelFilterInput) {
							throw new Error("Model menu is missing its filter input");
						}
						modelFilterInput.value = "claude";
						modelFilterInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
						const visibleFilteredModels = Array.from(modelMenu.querySelectorAll(".model-menu-item[data-value]")).filter(
							(item) => !item.hidden && getComputedStyle(item).display !== "none",
						);
						const modelFilterReducedResults = visibleFilteredModels.length < modelOptionCount;
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
					const settingsDetails = document.querySelector(".sidebar-settings");
					const settingsSummary = settingsDetails.querySelector("summary");
					const beforeSettingsOpen = settingsDetails.open;
					settingsSummary.click();
					await new Promise((resolve) => setTimeout(resolve, 0));
					const afterSettingsOpen = settingsDetails.open;
					settingsSummary.click();
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
						content: [{ type: "text", text: "Show markdown" }],
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
							!pastedAttachmentRemoved
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
					modelText: document.querySelector("#composer-model")?.textContent,
					userMessageText: document.querySelector(".message.user .message-body")?.textContent,
					userMessageMetaHidden: userMessageMetaOpacity === "0",
					userMessageModelText,
					userMessageHasHeader,
					markdownHeading: document.querySelector(".message.assistant .markdown h3, .message.assistant .markdown h4, .message.assistant .markdown h5")?.textContent,
					markdownCode: document.querySelector(".message.assistant .markdown pre code")?.textContent,
					markdownTableHeader: document.querySelector(".message.assistant .markdown table th")?.textContent,
					markdownTableCell: document.querySelector(".message.assistant .markdown table tbody tr:nth-child(2) td:nth-child(2)")?.textContent,
					markdownTableRowCount: document.querySelectorAll(".message.assistant .markdown table tbody tr").length,
					markdownTableRendered: document.querySelector(".message.assistant .markdown table") !== null,
					markdownHorizontalRuleRendered: document.querySelector(".message.assistant .markdown hr") !== null,
					thinkingHidden: document.querySelector("#messages")?.textContent?.includes("Hidden reasoning should not render") === false,
					toolGroupText: document.querySelector(".tool-group summary")?.textContent,
					toolGroupCollapsed: document.querySelector(".tool-group")?.open === false,
					toolResultHiddenAsMessage: document.querySelector(".message.toolResult") === null,
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
										noStaticSessionMergeIcon: document.querySelector(".session-item-icon") === null,
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
						errorHasFrame: errorStyle.borderTopStyle !== "none" && errorStyle.paddingTop !== "0px",
						contextRowsAreFlat: contextRowStyle.borderLeftStyle === "none" && contextRowStyle.backgroundColor === "rgba(0, 0, 0, 0)",
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
ipcMain.handle("pi:get-messages", async () => {
	await ensureDesktopSession();
	return serializeVisibleMessages();
});
ipcMain.handle("pi:list-sessions", async () => {
	await ensureDesktopSession();
	return listDesktopSessions();
});
ipcMain.handle("pi:new-session", async () => createDesktopSession({ cwd: currentCwd, fresh: true }));
ipcMain.handle("pi:switch-session", async (_event, sessionPath: string) => createDesktopSession({ sessionPath }));
ipcMain.handle("pi:prompt", async (_event, payload: unknown) => {
	await ensureDesktopSession();
	const prompt = normalizePromptPayload(payload);
	await getSession().prompt(prompt.text, {
		images: prompt.images,
		streamingBehavior: getSession().isStreaming ? "followUp" : undefined,
	});
	return serializeState();
});
ipcMain.handle("pi:abort", async () => {
	await ensureDesktopSession();
	await getSession().abort();
	return serializeState();
});
ipcMain.handle("pi:choose-context", async (_event, kind: "files" | "folder" | "workspace") => {
	await ensureDesktopSession();
	if (kind === "workspace") {
		return [currentCwd];
	}
	const result = await dialog.showOpenDialog(mainWindow!, {
		defaultPath: currentCwd,
		properties:
			kind === "folder" ? ["openDirectory", "createDirectory"] : ["openFile", "multiSelections", "showHiddenFiles"],
	});
	return result.canceled ? [] : result.filePaths;
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
ipcMain.handle("pi:git-status", async () => {
	await ensureDesktopSession();
	return getGitStatus();
});

app.whenReady().then(async () => {
	installApplicationMenu();
	await createDesktopSession();
	await createWindow();
	app.focus({ steal: true });
	publishState();
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
	unsubscribeSession?.();
	current?.session.dispose();
	for (const services of servicesByCwd.values()) {
		services.mcpDisconnect?.().catch(() => {});
	}
	servicesByCwd.clear();
	serviceCreationsByCwd.clear();
});
