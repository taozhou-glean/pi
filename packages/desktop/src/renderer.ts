import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";

type DesktopState = {
	cwd: string;
	sessionDir?: string;
	sessionId?: string;
	sessionFile?: string;
	sessionName?: string;
	model?: { provider: string; id: string };
	thinkingLevel?: string;
	authRequired: boolean;
	availableModelCount: number;
	isStreaming: boolean;
	pendingMessageCount: number;
	messageCount: number;
};

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

type DesktopToolCall = {
	type: "toolCall";
	id: string;
	name: string;
	input?: unknown;
};

type DesktopToolExecutionEndEvent = {
	type: "tool_execution_end";
	toolCallId?: string;
	isError?: boolean;
};

type DesktopModel = {
	provider: string;
	id: string;
	contextWindow?: number;
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

type GitStatus = {
	isRepo: boolean;
	branch?: string;
	status: string[];
	diffStat?: string;
	error?: string;
};

type DesktopLogoutResult = {
	state: DesktopState;
	message: string;
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

type ComposerImageAttachment = {
	id: string;
	data: string;
	mimeType: string;
	name: string;
	objectUrl: string;
};

type ComposerFileAttachment = {
	id: string;
	path: string;
	name: string;
};

type DesktopContextSelection =
	| { type: "path"; path: string; name?: string }
	| { type: "image"; path: string; name: string; data: string; mimeType: string };

type PiDesktopApi = {
	init(): Promise<DesktopState>;
	getState(): Promise<DesktopState>;
	getCurrentUser(): Promise<DesktopCurrentUser | undefined>;
	getMessages(): Promise<DesktopMessage[]>;
	getSessionLog(): Promise<string>;
	getSessionDeepLink(): Promise<string>;
	listSessions(): Promise<DesktopSessionInfo[]>;
	newSession(): Promise<DesktopState>;
	switchSession(sessionPath: string): Promise<DesktopState>;
	prompt(
		message: string | { text: string; images?: Array<{ type: "image"; data: string; mimeType: string }> },
	): Promise<DesktopState>;
	abort(): Promise<DesktopState>;
	chooseContext(kind: "files" | "folder" | "workspace"): Promise<DesktopContextSelection[]>;
	setCwd(cwd: string): Promise<DesktopState>;
	listModels(): Promise<DesktopModel[]>;
	setModel(provider: string, id: string): Promise<DesktopState>;
	compact(customInstructions?: string): Promise<DesktopState>;
	setSessionName(name: string): Promise<DesktopState>;
	reloadSession(): Promise<DesktopState>;
	login(): Promise<DesktopLoginResult>;
	logout(): Promise<DesktopLogoutResult>;
	quit(): Promise<void>;
	gitStatus(): Promise<GitStatus>;
	terminalCreate(): Promise<void>;
	terminalWrite(data: string): void;
	terminalResize(cols: number, rows: number): void;
	terminalDestroy(): Promise<void>;
	onTerminalData(handler: (data: string) => void): () => void;
	onState(handler: (state: DesktopState) => void): () => void;
	onMessages(handler: (messages: DesktopMessage[]) => void): () => void;
	onEvent(handler: (event: unknown) => void): () => void;
};

declare global {
	interface Window {
		piDesktop: PiDesktopApi;
		__piDesktopTest?: {
			renderMessages(messages: DesktopMessage[]): void;
			renderState(next: DesktopState): void;
			renderSessionList(): void;
			applyContextSelections(selections: DesktopContextSelection[], options?: { attachPathChips?: boolean }): void;
			getSlashCommands(): string[];
			sessions: DesktopSessionInfo[];
		};
	}
}

const cwdInput = document.querySelector<HTMLInputElement>("#cwd-input")!;
const changeCwdButton = document.querySelector<HTMLButtonElement>("#change-cwd")!;
const newSessionButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-new-session]"));
const appEl = document.querySelector<HTMLDivElement>("#app")!;
const sidebarSettings = document.querySelector<HTMLDivElement>(".sidebar-settings")!;
const sidebarSettingsTrigger = document.querySelector<HTMLButtonElement>("#sidebar-settings-trigger")!;
const sidebarSettingsPopover = document.querySelector<HTMLDivElement>("#sidebar-settings-popover")!;
const sidebarUserAvatar = document.querySelector<HTMLSpanElement>("#sidebar-user-avatar")!;
const sidebarSettingsLabel = document.querySelector<HTMLSpanElement>("#sidebar-settings-label")!;
const toggleLeftPanelButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-left-panel-toggle]"));
const toggleRightPanelButton = document.querySelector<HTMLButtonElement>("#toggle-right-panel")!;
const toggleBottomPanelButton = document.querySelector<HTMLButtonElement>("#toggle-bottom-panel")!;
const bottomPanel = document.querySelector<HTMLDivElement>("#bottom-panel")!;
const terminalContainer = document.querySelector<HTMLDivElement>("#terminal-container")!;
const rightTerminalContainer = document.querySelector<HTMLDivElement>("#right-terminal-container")!;
const terminalCloseButton = document.querySelector<HTMLButtonElement>("#terminal-close")!;
const rightPanelTabs = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-right-panel-tab]"));
const rightPanelPanes = Array.from(document.querySelectorAll<HTMLElement>("[data-right-panel-pane]"));
const bottomPanelTabs = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-bottom-panel-tab]"));
const bottomPanelPanes = Array.from(document.querySelectorAll<HTMLElement>("[data-bottom-panel-pane]"));
const browserUrlInput = document.querySelector<HTMLInputElement>("#browser-url")!;
const browserGoButton = document.querySelector<HTMLButtonElement>("#browser-go")!;
const browserFrame = document.querySelector<HTMLElement>("#browser-frame")!;
const bottomBrowserBar = document.querySelector<HTMLDivElement>(".bottom-browser-bar")!;
const bottomBrowserUrlInput = document.querySelector<HTMLInputElement>("#bottom-browser-url")!;
const bottomBrowserGoButton = document.querySelector<HTMLButtonElement>("#bottom-browser-go")!;
const bottomBrowserFrame = document.querySelector<HTMLElement>("#bottom-browser-frame")!;
const bottomResizer = document.querySelector<HTMLDivElement>("#bottom-resizer")!;
const leftResizer = document.querySelector<HTMLDivElement>("#left-resizer")!;
const rightResizer = document.querySelector<HTMLDivElement>("#right-resizer")!;
const refreshSessionsButton = document.querySelector<HTMLButtonElement>("#refresh-sessions")!;
const settingsLogoutButton = document.querySelector<HTMLButtonElement>("#settings-logout")!;
const sessionList = document.querySelector<HTMLDivElement>("#session-list")!;
const modelSelect = document.querySelector<HTMLSelectElement>("#model-select")!;
const modelMeta = document.querySelector<HTMLDivElement>("#model-meta")!;
const themeSelect = document.querySelector<HTMLSelectElement>("#theme-select")!;
const gitBranch = document.querySelector<HTMLDivElement>("#git-branch")!;
const gitStatus = document.querySelector<HTMLDivElement>("#git-status")!;
const refreshGitButton = document.querySelector<HTMLButtonElement>("#refresh-git")!;
const sessionTitle = document.querySelector<HTMLDivElement>("#session-title")!;
const sessionTitleInput = document.createElement("input");
sessionTitleInput.className = "session-title-input";
sessionTitleInput.type = "text";
sessionTitleInput.maxLength = 120;
sessionTitleInput.hidden = true;
sessionTitle.after(sessionTitleInput);
const sessionMenuTrigger = document.querySelector<HTMLButtonElement>("#session-menu-trigger")!;
const sessionMenu = document.querySelector<HTMLDivElement>("#session-menu")!;
const sessionMenuPin = document.querySelector<HTMLButtonElement>("#session-menu-pin")!;
const sessionMenuRename = document.querySelector<HTMLButtonElement>("#session-menu-rename")!;
const sessionMenuCopyCwd = document.querySelector<HTMLButtonElement>("#session-menu-copy-cwd")!;
const sessionMenuCopyId = document.querySelector<HTMLButtonElement>("#session-menu-copy-id")!;
const sessionMenuCopyLink = document.querySelector<HTMLButtonElement>("#session-menu-copy-link")!;
const sessionMenuCopyMarkdown = document.querySelector<HTMLButtonElement>("#session-menu-copy-markdown")!;
const sessionMenuCopyDebugLog = document.querySelector<HTMLButtonElement>("#session-menu-copy-debug-log")!;
const sessionMenuArchive = document.querySelector<HTMLButtonElement>("#session-menu-archive")!;
const sessionRenameForm = document.querySelector<HTMLFormElement>("#session-rename-form")!;
const sessionRenameInput = document.querySelector<HTMLInputElement>("#session-rename-input")!;
const sessionRenameCancel = document.querySelector<HTMLButtonElement>("#session-rename-cancel")!;
const composerAddButton = document.querySelector<HTMLButtonElement>("#composer-add")!;
const composerAddMenu = document.querySelector<HTMLDivElement>("#composer-add-menu")!;
const composerModelButton = document.querySelector<HTMLButtonElement>("#composer-model")!;
const composerModelMenu = document.querySelector<HTMLDivElement>("#composer-model-menu")!;
const runState = document.querySelector<HTMLDivElement>("#run-state")!;
const workspaceName = document.querySelector<HTMLElement>("#workspace-name")!;
const sessionShortId = document.querySelector<HTMLElement>("#session-short-id")!;
const messageCount = document.querySelector<HTMLElement>("#message-count")!;
const queueCount = document.querySelector<HTMLElement>("#queue-count")!;
const contextSummary = document.querySelector<HTMLDivElement>("#context-summary")!;
const messagesEl = document.querySelector<HTMLElement>("#messages")!;
const loginScreen = document.querySelector<HTMLElement>("#login-screen")!;
const loginButton = document.querySelector<HTMLButtonElement>("#login-button")!;
const loginStatus = document.querySelector<HTMLDivElement>("#login-status")!;
const composer = document.querySelector<HTMLFormElement>("#composer")!;
const promptInput = document.querySelector<HTMLTextAreaElement>("#prompt")!;
const sendButton = document.querySelector<HTMLButtonElement>("#send")!;
const sendButtonSendIcon = `
	<svg viewBox="0 0 24 24" aria-hidden="true">
		<path d="M12 19V5" />
		<path d="m6 11 6-6 6 6" />
	</svg>
`;
const sendButtonStopIcon = `
	<svg viewBox="0 0 24 24" aria-hidden="true">
		<rect x="7" y="7" width="10" height="10" rx="2" />
	</svg>
`;
const composerAttachments = document.createElement("div");
composerAttachments.className = "composer-attachments";
composerAttachments.hidden = true;
promptInput.before(composerAttachments);
const slashCommandMenu = document.createElement("div");
slashCommandMenu.className = "composer-menu slash-command-menu";
slashCommandMenu.hidden = true;
promptInput.before(slashCommandMenu);
const imagePreviewOverlay = document.createElement("div");
imagePreviewOverlay.className = "image-preview-overlay";
imagePreviewOverlay.hidden = true;
document.body.append(imagePreviewOverlay);

let state: DesktopState | undefined;
let models: DesktopModel[] = [];
let sessions: DesktopSessionInfo[] = [];
let currentMessages: DesktopMessage[] = [];
let composerImages: ComposerImageAttachment[] = [];
let composerFiles: ComposerFileAttachment[] = [];
let switchingSessionPath: string | undefined;
let renderedSessionId: string | undefined;
let isEditingSessionTitle = false;
const completedToolExecutions = new Map<string, { isError: boolean }>();
let visibleMessageLimit = 120;
let shouldFollowMessages = true;
let selectedSlashCommandIndex = 0;
let isComposerBusy = false;
let isAbortingRun = false;
const messagePageSize = 120;
const projectSessionPageSize = 5;
const projectSessionLimits = new Map<string, number>();
const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
const themeStorageKey = "pi-desktop-theme";
const layoutStorageKey = "pi-desktop-layout";
const pinnedSessionsStorageKey = "pi-pinned-sessions";
const archivedSessionsStorageKey = "pi-archived-sessions";
const pinnedSessionKeys = new Set<string>(JSON.parse(localStorage.getItem(pinnedSessionsStorageKey) || "[]"));
const archivedSessionKeys = new Set<string>(JSON.parse(localStorage.getItem(archivedSessionsStorageKey) || "[]"));
let showArchivedSessions = false;
const minLeftPanelWidth = 340;
const maxLeftPanelWidth = 520;
const minRightPanelWidth = 240;
const maxRightPanelWidth = 560;
const autoCollapseLeftWidth = 1040;
const autoExpandLeftWidth = 1140;

type ThemePreference = "system" | "light" | "dark";

type WindowPanelTab = "terminal" | "browser";
type RightPanelTab = "inspector" | WindowPanelTab;

type LayoutState = {
	leftWidth: number;
	rightWidth: number;
	leftCollapsed: boolean;
	rightCollapsed: boolean;
	bottomHeight: number;
	bottomCollapsed: boolean;
	rightTab: RightPanelTab;
	bottomTab: WindowPanelTab;
};

const layoutState: LayoutState = loadLayoutState();
let leftPanelAutoCollapsed = false;

document.body.dataset.platform = navigator.platform.toLowerCase().includes("mac") ? "mac" : "other";

function getThemePreference(): ThemePreference {
	const saved = localStorage.getItem(themeStorageKey);
	return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
}

function applyTheme(preference: ThemePreference = getThemePreference()): void {
	const resolved = preference === "system" ? (themeMedia.matches ? "dark" : "light") : preference;
	document.documentElement.dataset.theme = resolved;
	document.body.dataset.theme = resolved;
	themeSelect.value = preference;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function isWindowPanelTab(value: unknown): value is WindowPanelTab {
	return value === "terminal" || value === "browser";
}

function isRightPanelTab(value: unknown): value is RightPanelTab {
	return value === "inspector" || isWindowPanelTab(value);
}

function loadLayoutState(): LayoutState {
	try {
		const parsed = JSON.parse(localStorage.getItem(layoutStorageKey) ?? "{}") as Partial<LayoutState>;
		return {
			leftWidth: clamp(Number(parsed.leftWidth) || 390, minLeftPanelWidth, maxLeftPanelWidth),
			rightWidth: clamp(Number(parsed.rightWidth) || 320, minRightPanelWidth, maxRightPanelWidth),
			leftCollapsed: parsed.leftCollapsed === true,
			rightCollapsed: parsed.rightCollapsed === undefined ? true : parsed.rightCollapsed === true,
			bottomHeight: clamp(Number(parsed.bottomHeight) || 240, 120, 600),
			bottomCollapsed: parsed.bottomCollapsed !== false,
			rightTab: isRightPanelTab(parsed.rightTab) ? parsed.rightTab : "inspector",
			bottomTab: isWindowPanelTab(parsed.bottomTab) ? parsed.bottomTab : "terminal",
		};
	} catch {
		return {
			leftWidth: 390,
			rightWidth: 320,
			leftCollapsed: false,
			rightCollapsed: true,
			bottomHeight: 240,
			bottomCollapsed: true,
			rightTab: "inspector",
			bottomTab: "terminal",
		};
	}
}

function saveLayoutState(): void {
	localStorage.setItem(layoutStorageKey, JSON.stringify(layoutState));
}

function applyLayoutState(): void {
	appEl.style.setProperty("--left-panel-width", `${layoutState.leftWidth}px`);
	appEl.style.setProperty("--right-panel-width", `${layoutState.rightWidth}px`);
	appEl.style.setProperty("--left-track", layoutState.leftCollapsed ? "0px" : `${layoutState.leftWidth}px`);
	appEl.style.setProperty("--right-track", layoutState.rightCollapsed ? "0px" : `${layoutState.rightWidth}px`);
	appEl.style.setProperty("--bottom-track", layoutState.bottomCollapsed ? "0px" : `${layoutState.bottomHeight}px`);
	appEl.classList.toggle("left-collapsed", layoutState.leftCollapsed);
	appEl.classList.toggle("right-collapsed", layoutState.rightCollapsed);
	appEl.classList.toggle("bottom-collapsed", layoutState.bottomCollapsed);
	for (const button of toggleLeftPanelButtons) {
		button.setAttribute("aria-pressed", String(!layoutState.leftCollapsed));
	}
	toggleRightPanelButton.setAttribute("aria-pressed", String(!layoutState.rightCollapsed));
	toggleBottomPanelButton.setAttribute("aria-pressed", String(!layoutState.bottomCollapsed));
	for (const tab of rightPanelTabs) {
		const active = tab.dataset.rightPanelTab === layoutState.rightTab;
		tab.classList.toggle("active", active);
		tab.setAttribute("aria-selected", String(active));
	}
	for (const pane of rightPanelPanes) {
		pane.hidden = pane.dataset.rightPanelPane !== layoutState.rightTab;
	}
	for (const tab of bottomPanelTabs) {
		const active = tab.dataset.bottomPanelTab === layoutState.bottomTab;
		tab.classList.toggle("active", active);
		tab.setAttribute("aria-selected", String(active));
	}
	for (const pane of bottomPanelPanes) {
		pane.hidden = pane.dataset.bottomPanelPane !== layoutState.bottomTab;
	}
	bottomBrowserBar.hidden = layoutState.bottomCollapsed || layoutState.bottomTab !== "browser";
	bottomPanel.hidden = layoutState.bottomCollapsed;
}

function syncResponsiveLayout(): void {
	const width = window.innerWidth;
	if (width < autoCollapseLeftWidth && !layoutState.leftCollapsed) {
		layoutState.leftCollapsed = true;
		leftPanelAutoCollapsed = true;
		applyLayoutState();
		return;
	}
	if (width >= autoExpandLeftWidth && leftPanelAutoCollapsed && layoutState.leftCollapsed) {
		layoutState.leftCollapsed = false;
		leftPanelAutoCollapsed = false;
		applyLayoutState();
	}
}

function setPanelWidth(side: "left" | "right", width: number): void {
	if (side === "left") {
		layoutState.leftWidth = clamp(width, minLeftPanelWidth, maxLeftPanelWidth);
		layoutState.leftCollapsed = false;
		leftPanelAutoCollapsed = false;
	} else {
		layoutState.rightWidth = clamp(width, minRightPanelWidth, maxRightPanelWidth);
		layoutState.rightCollapsed = false;
	}
	applyLayoutState();
	saveLayoutState();
}

function togglePanel(side: "left" | "right"): void {
	if (side === "left") {
		layoutState.leftCollapsed = !layoutState.leftCollapsed;
		leftPanelAutoCollapsed = false;
	} else {
		layoutState.rightCollapsed = !layoutState.rightCollapsed;
	}
	applyLayoutState();
	saveLayoutState();
}

function beginResize(side: "left" | "right", startX: number, handle: HTMLElement, pointerId: number): void {
	const startWidth = side === "left" ? layoutState.leftWidth : layoutState.rightWidth;
	handle.classList.add("dragging");
	document.body.classList.add("resizing-panels");
	try {
		handle.setPointerCapture(pointerId);
	} catch {
		// Pointer capture can fail for synthetic events in smoke tests.
	}

	const onMove = (event: PointerEvent): void => {
		const delta = event.clientX - startX;
		const nextWidth = side === "left" ? startWidth + delta : startWidth - delta;
		setPanelWidth(side, nextWidth);
	};

	const onUp = (): void => {
		handle.classList.remove("dragging");
		document.body.classList.remove("resizing-panels");
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);
		try {
			handle.releasePointerCapture(pointerId);
		} catch {
			// Ignore stale pointer capture state.
		}
	};

	window.addEventListener("pointermove", onMove);
	window.addEventListener("pointerup", onUp, { once: true });
}

function handleResizeKey(side: "left" | "right", event: KeyboardEvent): void {
	if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
	event.preventDefault();
	const direction = event.key === "ArrowRight" ? 1 : -1;
	const currentWidth = side === "left" ? layoutState.leftWidth : layoutState.rightWidth;
	const nextWidth = currentWidth + (side === "left" ? direction : -direction) * 16;
	setPanelWidth(side, nextWidth);
}

function basename(path: string): string {
	const parts = path.split(/[\\/]/).filter(Boolean);
	return parts.at(-1) ?? path;
}

function shortId(id?: string): string {
	return id ? id.slice(0, 8) : "-";
}

function modelDisplay(state: DesktopState): string {
	if (!state.model) return "No model selected";
	return `${state.model.id} · ${state.thinkingLevel ?? "off"}`;
}

function initialsForName(value: unknown): string {
	const parts = String(value ?? "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	return (
		parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : parts[0]?.slice(0, 2) || "?"
	).toUpperCase();
}

function renderCurrentUser(user: DesktopCurrentUser | undefined): void {
	const name = user?.name || user?.email || "Settings";
	sidebarSettingsLabel.textContent = user?.name || "Settings";
	sidebarSettingsTrigger.title = user?.email ? `${name} · ${user.email}` : name;
	sidebarSettingsTrigger.setAttribute("aria-label", `Open settings for ${name}`);
	sidebarUserAvatar.replaceChildren();
	if (user?.photoUrl) {
		const image = document.createElement("img");
		image.src = user.photoUrl;
		image.alt = "";
		image.referrerPolicy = "no-referrer";
		image.addEventListener("error", () => {
			const fallback = document.createElement("span");
			fallback.textContent = initialsForName(name);
			sidebarUserAvatar.replaceChildren(fallback);
		});
		sidebarUserAvatar.append(image);
		return;
	}
	const fallback = document.createElement("span");
	fallback.textContent = initialsForName(name);
	sidebarUserAvatar.append(fallback);
}

async function refreshCurrentUser(): Promise<void> {
	try {
		renderCurrentUser(await window.piDesktop.getCurrentUser());
	} catch (error) {
		console.warn("[desktop] failed to fetch current user", error);
		renderCurrentUser(undefined);
	}
}

function setMenuOpen(button: HTMLButtonElement, menu: HTMLElement, open: boolean): void {
	menu.hidden = !open;
	button.setAttribute("aria-expanded", String(open));
}

function closeComposerMenus(): void {
	setMenuOpen(composerAddButton, composerAddMenu, false);
	setMenuOpen(composerModelButton, composerModelMenu, false);
	closeSlashCommandMenu();
}

function setSettingsPopoverOpen(open: boolean): void {
	sidebarSettingsPopover.hidden = !open;
	sidebarSettingsTrigger.setAttribute("aria-expanded", String(open));
}

function closeSettingsPopover(): void {
	setSettingsPopoverOpen(false);
}

function toggleSettingsPopover(): void {
	setSettingsPopoverOpen(sidebarSettingsPopover.hidden);
}

function syncComposerModelSelection(): void {
	for (const item of Array.from(
		composerModelMenu.querySelectorAll<HTMLButtonElement>(".model-menu-item[data-value]"),
	)) {
		item.classList.toggle("active", item.dataset.value === modelSelect.value);
	}
}

function filterModelMenu(query: string): void {
	const normalized = query.trim().toLowerCase();
	for (const item of Array.from(
		composerModelMenu.querySelectorAll<HTMLButtonElement>(".model-menu-item[data-value]"),
	)) {
		const haystack = `${item.dataset.modelId ?? ""} ${item.dataset.provider ?? ""}`.toLowerCase();
		item.hidden = normalized.length > 0 && !haystack.includes(normalized);
	}
}

function createMenuLabel(text: string): HTMLDivElement {
	const label = document.createElement("div");
	label.className = "composer-menu-label";
	label.textContent = text;
	return label;
}

function createMenuSeparator(): HTMLDivElement {
	const separator = document.createElement("div");
	separator.className = "composer-menu-separator";
	separator.setAttribute("role", "separator");
	return separator;
}

type SlashCommand = {
	name: string;
	usage: string;
	description: string;
	run(args: string): Promise<void>;
};

type SlashPaletteItem =
	| { type: "command"; command: SlashCommand }
	| { type: "model"; model: DesktopModel; label: string; description: string };

const slashCommands: SlashCommand[] = [
	{
		name: "new",
		usage: "/new",
		description: "Start a new chat in this workspace",
		run: async () => {
			renderState(await window.piDesktop.newSession());
			await refreshAfterSessionChange();
		},
	},
	{
		name: "model",
		usage: "/model [search]",
		description: "Switch models or open the model selector",
		run: async (args) => {
			if (!args.trim()) {
				closeComposerMenus();
				setMenuOpen(composerModelButton, composerModelMenu, true);
				composerModelMenu.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
				return;
			}
			const query = args.toLowerCase();
			const matches = models.filter((model) => `${model.provider}/${model.id}`.toLowerCase().includes(query));
			if (matches.length === 0) throw new Error(`No model matches "${args}".`);
			const exact =
				matches.find(
					(model) => model.id.toLowerCase() === query || `${model.provider}/${model.id}`.toLowerCase() === query,
				) ?? matches[0];
			renderState(await window.piDesktop.setModel(exact.provider, exact.id));
			showDesktopMessage("Model", `Switched to ${exact.provider}/${exact.id}.`);
		},
	},
	{
		name: "compact",
		usage: "/compact [instructions]",
		description: "Compact the current chat context",
		run: async (args) => {
			renderState(await window.piDesktop.compact(args));
			renderMessages(await window.piDesktop.getMessages());
		},
	},
	{
		name: "name",
		usage: "/name <title>",
		description: "Rename this chat",
		run: async (args) => {
			renderState(await window.piDesktop.setSessionName(args));
			await refreshSessions();
		},
	},
	{
		name: "session",
		usage: "/session",
		description: "Show current session details",
		run: async () => {
			const current = state;
			if (!current) throw new Error("Desktop state is not ready yet.");
			showDesktopMessage(
				"Session",
				[
					`Name: ${current.sessionName || sessionTitle.textContent || "New chat"}`,
					`ID: ${current.sessionId ?? "-"}`,
					`CWD: ${current.cwd}`,
					`Model: ${current.model ? `${current.model.provider}/${current.model.id}` : "No model selected"}`,
					`Messages: ${current.messageCount}`,
				].join("\n"),
			);
		},
	},
	{
		name: "copy",
		usage: "/copy",
		description: "Copy the latest assistant response",
		run: async () => {
			const messages = await window.piDesktop.getMessages();
			const lastAssistant = [...messages]
				.reverse()
				.find((message) => message.role === "assistant" && message.text.trim());
			if (!lastAssistant) throw new Error("No assistant response to copy.");
			await navigator.clipboard.writeText(lastAssistant.text);
			showDesktopMessage("Clipboard", "Copied the latest assistant response.");
		},
	},
	{
		name: "reload",
		usage: "/reload",
		description: "Reload Pi settings, prompts, and extensions",
		run: async () => {
			renderState(await window.piDesktop.reloadSession());
			await refreshAfterSessionChange();
			showDesktopMessage("Reload", "Reloaded session resources.");
		},
	},
	{
		name: "quit",
		usage: "/quit",
		description: "Quit Pi Desktop",
		run: async () => {
			await window.piDesktop.quit();
		},
	},
];

function supportedSlashCommandNames(): string[] {
	return slashCommands.map((command) => command.name);
}

function matchingSlashCommands(): SlashCommand[] {
	const query = promptInput.value.slice(1, promptInput.selectionStart ?? promptInput.value.length).toLowerCase();
	return slashCommands.filter(
		(command) =>
			command.name.toLowerCase().includes(query) ||
			command.description.toLowerCase().includes(query) ||
			command.usage.toLowerCase().includes(query),
	);
}

function modelSearchQueryFromSlash(): string | undefined {
	const value = promptInput.value;
	const cursor = promptInput.selectionStart ?? value.length;
	if (cursor !== value.length) return undefined;
	const match = value.match(/^\/model\s+(.+)$/i);
	return match?.[1]?.trim().toLowerCase();
}

function matchingSlashModels(): DesktopModel[] {
	const query = modelSearchQueryFromSlash();
	if (!query) return [];
	return models.filter((model) => `${model.provider}/${model.id}`.toLowerCase().includes(query)).slice(0, 12);
}

function matchingSlashPaletteItems(): SlashPaletteItem[] {
	const modelMatches = matchingSlashModels();
	if (modelMatches.length > 0) {
		return modelMatches.map((model) => ({
			type: "model",
			model,
			label: model.id,
			description: model.provider,
		}));
	}
	return matchingSlashCommands().map((command) => ({ type: "command", command }));
}

function closeSlashCommandMenu(): void {
	slashCommandMenu.hidden = true;
	slashCommandMenu.replaceChildren();
	selectedSlashCommandIndex = 0;
}

function selectSlashCommand(command: SlashCommand): void {
	promptInput.value =
		command.usage.includes("<") || command.usage.includes("[") ? `/${command.name} ` : `/${command.name}`;
	promptInput.focus();
	promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
	closeSlashCommandMenu();
	autosizePrompt();
	syncSendButtonState();
}

async function selectSlashPaletteItem(item: SlashPaletteItem): Promise<void> {
	if (item.type === "command") {
		selectSlashCommand(item.command);
		return;
	}
	promptInput.value = `/model ${item.model.provider}/${item.model.id}`;
	await executeSlashCommand(promptInput.value);
}

function renderSlashCommandMenu(): void {
	const value = promptInput.value;
	const cursor = promptInput.selectionStart ?? value.length;
	const beforeCursor = value.slice(0, cursor);
	const isModelSearch = modelSearchQueryFromSlash() !== undefined;
	const shouldShow =
		isModelSearch ||
		(value.startsWith("/") &&
			beforeCursor.startsWith("/") &&
			!beforeCursor.includes(" ") &&
			!beforeCursor.includes("\n") &&
			cursor === value.length);
	if (!shouldShow) {
		closeSlashCommandMenu();
		return;
	}

	const matches = matchingSlashPaletteItems();
	if (matches.length === 0) {
		closeSlashCommandMenu();
		return;
	}
	selectedSlashCommandIndex = clamp(selectedSlashCommandIndex, 0, matches.length - 1);
	slashCommandMenu.replaceChildren(createMenuLabel(isModelSearch ? "Models" : "Commands"));
	for (const [index, paletteItem] of matches.entries()) {
		const item = document.createElement("button");
		item.type = "button";
		item.className = `slash-command-item ${index === selectedSlashCommandIndex ? "active" : ""}`;
		item.innerHTML = `
			<span class="slash-command-name">${paletteItem.type === "command" ? paletteItem.command.usage : paletteItem.label}</span>
			<span class="slash-command-description">${
				paletteItem.type === "command" ? paletteItem.command.description : paletteItem.description
			}</span>
		`;
		item.addEventListener("mousedown", (event) => {
			event.preventDefault();
			selectSlashPaletteItem(paletteItem).catch(showError);
		});
		slashCommandMenu.append(item);
	}
	slashCommandMenu.hidden = false;
}

function moveSlashSelection(delta: number): void {
	const matches = matchingSlashPaletteItems();
	if (matches.length === 0) return;
	selectedSlashCommandIndex = (selectedSlashCommandIndex + delta + matches.length) % matches.length;
	renderSlashCommandMenu();
}

async function executeSlashCommand(input: string): Promise<void> {
	const match = input.match(/^\/([^\s/]+)(?:\s+([\s\S]*))?$/);
	if (!match) {
		showError(`Unknown command: ${input}`);
		return;
	}
	const [, rawName, rawArgs = ""] = match;
	const command = slashCommands.find((candidate) => candidate.name === rawName.toLowerCase());
	if (!command) {
		showError(`Unknown command: /${rawName}`);
		return;
	}

	promptInput.value = "";
	closeSlashCommandMenu();
	autosizePrompt();
	syncSendButtonState();
	setBusy(true);
	showStreamingIndicator();
	try {
		await command.run(rawArgs.trim());
	} catch (error) {
		showError(error);
	} finally {
		setBusy(Boolean(state?.isStreaming));
	}
}

function formatRelative(value: string): string {
	const date = new Date(value);
	const deltaSeconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
	if (deltaSeconds < 60) return "just now";
	const deltaMinutes = Math.round(deltaSeconds / 60);
	if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
	const deltaHours = Math.round(deltaMinutes / 60);
	if (deltaHours < 24) return `${deltaHours}h ago`;
	const deltaDays = Math.round(deltaHours / 24);
	if (deltaDays < 7) return `${deltaDays}d ago`;
	return date.toLocaleDateString();
}

function isMessagesScrolledToBottom(): boolean {
	return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight <= 32;
}

function scrollMessagesToBottom(): void {
	messagesEl.scrollTop = messagesEl.scrollHeight;
	shouldFollowMessages = true;
}

function setBusy(isBusy: boolean): void {
	isComposerBusy = isBusy;
	sendButton.setAttribute("aria-label", isBusy ? "Stop" : "Send");
	sendButton.title = isBusy ? "Stop" : "Send";
	sendButton.innerHTML = isBusy ? sendButtonStopIcon : sendButtonSendIcon;
	runState.textContent = isBusy ? "Running" : "Idle";
	runState.className = `run-state ${isBusy ? "running" : "idle"}`;
	if (!isBusy) hideStreamingIndicator();
	syncSendButtonState();
}

function showStreamingIndicator(): void {
	if (messagesEl.querySelector(".streaming-indicator")) return;
	const indicator = document.createElement("div");
	indicator.className = "streaming-indicator";
	const label = document.createElement("span");
	label.textContent = "Thinking";
	const dots = document.createElement("span");
	dots.className = "dots";
	for (let index = 0; index < 3; index++) {
		dots.append(document.createElement("span"));
	}
	indicator.append(label, dots);
	messagesEl.append(indicator);
	if (shouldFollowMessages || isMessagesScrolledToBottom()) scrollMessagesToBottom();
}

function hideStreamingIndicator(): void {
	messagesEl.querySelector(".streaming-indicator")?.remove();
}

function roleLabel(role: string): string {
	if (role === "toolResult") return "Tool result";
	if (role === "assistant") return "Pi";
	if (role === "user") return "You";
	if (role === "custom") return "Context";
	return role;
}

function formatToolLabel(name: string): string {
	const normalized = name.replace(/[_-]+/g, " ").trim();
	if (!normalized) return "Tool";
	return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function toolStateLabel(result: DesktopMessage | undefined, execution?: { isError: boolean }): string {
	if (result) return result.isError ? "Failed" : "Completed";
	if (execution) return execution.isError ? "Failed" : "Completed";
	return "Running";
}

function isBrowserUrl(value: string): boolean {
	return /^(https?|file):\/\//i.test(value);
}

function appendInlineMarkdown(parent: HTMLElement, text: string): void {
	const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|(https?|file):\/\/[^\s<>)]+)/g;
	let cursor = 0;
	for (const match of text.matchAll(pattern)) {
		const raw = match[0];
		const index = match.index ?? 0;
		if (index > cursor) parent.append(document.createTextNode(text.slice(cursor, index)));
		if (raw.startsWith("`")) {
			const code = document.createElement("code");
			code.textContent = raw.slice(1, -1);
			parent.append(code);
		} else if (raw.startsWith("**")) {
			const strong = document.createElement("strong");
			strong.textContent = raw.slice(2, -2);
			parent.append(strong);
		} else if (isBrowserUrl(raw)) {
			const trailingMatch = /[.,!?;:]+$/.exec(raw);
			const trailing = trailingMatch?.[0] ?? "";
			const href = trailing ? raw.slice(0, -trailing.length) : raw;
			const link = document.createElement("a");
			link.href = href;
			link.textContent = href;
			parent.append(link);
			if (trailing) parent.append(document.createTextNode(trailing));
		} else {
			const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(raw);
			const href = linkMatch?.[2] ?? "";
			if (isBrowserUrl(href)) {
				const link = document.createElement("a");
				link.href = href;
				link.textContent = linkMatch?.[1] ?? href;
				parent.append(link);
			} else {
				parent.append(document.createTextNode(raw));
			}
		}
		cursor = index + raw.length;
	}
	if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
}

function appendParagraph(parent: HTMLElement, lines: string[]): void {
	if (lines.length === 0) return;
	const paragraph = document.createElement("p");
	appendInlineMarkdown(paragraph, lines.join(" "));
	parent.append(paragraph);
}

function parseMarkdownTableRow(line: string): string[] | undefined {
	const trimmed = line.trim();
	if (!trimmed.includes("|")) return undefined;
	const normalized = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
	const cells = (normalized.endsWith("|") ? normalized.slice(0, -1) : normalized).split("|");
	if (cells.length < 2) return undefined;
	return cells.map((cell) => cell.trim());
}

function parseMarkdownTableSeparator(line: string, expectedCells: number): boolean {
	const cells = parseMarkdownTableRow(line);
	if (!cells || cells.length !== expectedCells) return false;
	return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function appendMarkdownTable(parent: HTMLElement, header: string[], rows: string[][]): void {
	const wrapper = document.createElement("div");
	wrapper.className = "markdown-table-wrap";
	const table = document.createElement("table");
	const thead = document.createElement("thead");
	const headRow = document.createElement("tr");
	for (const cell of header) {
		const th = document.createElement("th");
		appendInlineMarkdown(th, cell);
		headRow.append(th);
	}
	thead.append(headRow);
	table.append(thead);

	const tbody = document.createElement("tbody");
	for (const row of rows) {
		const tr = document.createElement("tr");
		for (let index = 0; index < header.length; index++) {
			const td = document.createElement("td");
			appendInlineMarkdown(td, row[index] ?? "");
			tr.append(td);
		}
		tbody.append(tr);
	}
	table.append(tbody);
	wrapper.append(table);
	parent.append(wrapper);
}

function renderMarkdown(parent: HTMLElement, markdown: string): void {
	const lines = markdown.replace(/\r\n/g, "\n").split("\n");
	let paragraph: string[] = [];
	let list: HTMLUListElement | HTMLOListElement | undefined;
	let code: HTMLPreElement | undefined;
	let codeLines: string[] = [];

	const flushParagraph = (): void => {
		appendParagraph(parent, paragraph);
		paragraph = [];
	};
	const flushList = (): void => {
		list = undefined;
	};

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]!;
		const fence = /^```/.test(line);
		if (code) {
			if (fence) {
				const codeEl = document.createElement("code");
				codeEl.textContent = codeLines.join("\n");
				code.append(codeEl);
				parent.append(code);
				code = undefined;
				codeLines = [];
			} else {
				codeLines.push(line);
			}
			continue;
		}
		if (fence) {
			flushParagraph();
			flushList();
			code = document.createElement("pre");
			continue;
		}
		if (!line.trim()) {
			flushParagraph();
			flushList();
			continue;
		}
		if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
			flushParagraph();
			flushList();
			parent.append(document.createElement("hr"));
			continue;
		}
		const heading = /^(#{1,3})\s+(.+)$/.exec(line);
		if (heading) {
			flushParagraph();
			flushList();
			const level = String(Math.min(3, heading[1].length + 2)) as "3" | "4" | "5";
			const h = document.createElement(`h${level}`);
			appendInlineMarkdown(h, heading[2]);
			parent.append(h);
			continue;
		}
		const bullet = /^[-*]\s+(.+)$/.exec(line);
		const ordered = /^\d+\.\s+(.+)$/.exec(line);
		if (bullet || ordered) {
			flushParagraph();
			const shouldBeOrdered = Boolean(ordered);
			if (!list || (shouldBeOrdered && list.tagName !== "OL") || (!shouldBeOrdered && list.tagName !== "UL")) {
				list = document.createElement(shouldBeOrdered ? "ol" : "ul");
				parent.append(list);
			}
			const item = document.createElement("li");
			appendInlineMarkdown(item, bullet?.[1] ?? ordered?.[1] ?? "");
			list.append(item);
			continue;
		}
		const quote = /^>\s?(.+)$/.exec(line);
		if (quote) {
			flushParagraph();
			flushList();
			const blockquote = document.createElement("blockquote");
			appendInlineMarkdown(blockquote, quote[1]);
			parent.append(blockquote);
			continue;
		}
		const tableHeader = parseMarkdownTableRow(line);
		const nextLine = lines[index + 1];
		if (tableHeader && nextLine && parseMarkdownTableSeparator(nextLine, tableHeader.length)) {
			flushParagraph();
			flushList();
			const rows: string[][] = [];
			index += 2;
			for (; index < lines.length; index++) {
				const row = parseMarkdownTableRow(lines[index]!);
				if (!row) break;
				rows.push(row);
			}
			index--;
			appendMarkdownTable(parent, tableHeader, rows);
			continue;
		}
		paragraph.push(line.trim());
	}
	if (code) {
		const codeEl = document.createElement("code");
		codeEl.textContent = codeLines.join("\n");
		code.append(codeEl);
		parent.append(code);
	}
	flushParagraph();
}

function contentText(message: DesktopMessage): string {
	if (message.errorMessage) return message.errorMessage;
	const parts = message.content
		.filter((block): block is Extract<DesktopContent, { type: "text" }> => block.type === "text")
		.map((block) => block.text)
		.filter(Boolean);
	return parts.join("\n\n") || message.text || "";
}

function splitVisibleTextAndContextPaths(text: string): { text: string; paths: string[] } {
	const lines = text.split("\n");
	const markerIndex = lines.findIndex(
		(line) => line.trim() === "Use this path as context:" || line.trim() === "Use these paths as context:",
	);
	if (markerIndex === -1) return { text, paths: [] };

	const paths: string[] = [];
	for (let index = markerIndex + 1; index < lines.length; index++) {
		const line = lines[index] ?? "";
		const match = /^\s*-\s+(.+?)\s*$/.exec(line);
		if (match) {
			paths.push(match[1]);
			continue;
		}
		if (line.trim() !== "") break;
	}
	if (paths.length === 0) return { text, paths: [] };
	return { text: lines.slice(0, markerIndex).join("\n").trimEnd(), paths };
}

function hasVisibleContent(message: DesktopMessage): boolean {
	return Boolean(
		contentText(message) || message.content.some((block) => block.type === "image") || message.toolCalls?.length,
	);
}

function renderContent(message: DesktopMessage, options: { includeImages?: boolean; text?: string } = {}): HTMLElement {
	const includeImages = options.includeImages ?? true;
	const body = document.createElement("div");
	body.className = "message-body markdown";
	const text = options.text ?? contentText(message);
	if (text) renderMarkdown(body, text);
	if (!includeImages) return body;
	for (const block of message.content) {
		if (block.type !== "image") continue;
		const image = document.createElement("img");
		image.className = "message-image";
		image.src = `data:${block.mimeType};base64,${block.data}`;
		image.alt = "Attached image";
		body.append(image);
	}
	return body;
}

function openImagePreviewSource(name: string, src: string): void {
	openImagePreview({ id: src, data: "", mimeType: "image/png", name, objectUrl: src });
}

function renderImageAttachments(message: DesktopMessage): HTMLElement | undefined {
	const images = message.content.filter(
		(block): block is Extract<DesktopContent, { type: "image" }> => block.type === "image",
	);
	if (images.length === 0) return undefined;

	const strip = document.createElement("div");
	strip.className = "message-attachments";
	for (const [index, block] of images.entries()) {
		const src = `data:${block.mimeType};base64,${block.data}`;
		const button = document.createElement("button");
		button.type = "button";
		button.className = "message-image-tile";
		button.title = "Preview attached image";
		button.setAttribute("aria-label", `Preview attached image ${index + 1}`);
		button.addEventListener("click", () => openImagePreviewSource(`Attached image ${index + 1}`, src));

		const image = document.createElement("img");
		image.src = src;
		image.alt = "Attached image";
		button.append(image);
		strip.append(button);
	}
	return strip;
}

function renderFileAttachments(paths: string[]): HTMLElement | undefined {
	if (paths.length === 0) return undefined;

	const strip = document.createElement("div");
	strip.className = "message-attachments file-attachments";
	for (const path of paths) {
		const chip = document.createElement("div");
		chip.className = "message-file-chip";
		chip.title = path;

		const icon = document.createElement("span");
		icon.className = "message-file-chip-icon";
		icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h4" /></svg>`;

		const name = document.createElement("span");
		name.className = "message-file-chip-name";
		name.textContent = basename(path);

		chip.append(icon, name);
		strip.append(chip);
	}
	return strip;
}

function renderToolInput(input: unknown): string {
	if (input === undefined || input === null) return "";
	if (typeof input === "string") return input;
	try {
		return JSON.stringify(input, null, 2);
	} catch {
		return String(input);
	}
}

function createMessage(message: DesktopMessage): HTMLElement {
	const row = document.createElement("article");
	row.className = `message ${message.role}`;

	if (message.role === "user") {
		const userContent = splitVisibleTextAndContextPaths(contentText(message));
		row.classList.toggle(
			"has-attachments",
			message.content.some((block) => block.type === "image") || userContent.paths.length > 0,
		);
		const meta = document.createElement("div");
		meta.className = "message-hover-meta";
		if (state?.model) {
			const model = document.createElement("span");
			model.className = "message-model";
			model.textContent = `${state.model.id} · ${state.thinkingLevel ?? "off"}`;
			meta.append(model);
		}
		const time = document.createElement("time");
		time.className = "message-time";
		time.textContent = message.timestamp
			? new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
			: "";
		meta.append(time);
		const bubble = document.createElement("div");
		bubble.className = "message-user-bubble";
		const body = renderContent(message, { includeImages: false, text: userContent.text });
		if (body.hasChildNodes()) {
			bubble.append(body);
		}
		const fileAttachments = renderFileAttachments(userContent.paths);
		if (fileAttachments) {
			row.append(fileAttachments);
		}
		const attachments = renderImageAttachments(message);
		if (attachments) {
			row.append(attachments);
		}
		if (bubble.hasChildNodes()) {
			row.append(bubble);
		}
		row.append(meta);
		return row;
	}

	const header = document.createElement("div");
	header.className = "message-header";
	const label = document.createElement("span");
	label.className = "message-role";
	label.textContent = roleLabel(message.role);
	const time = document.createElement("time");
	time.className = "message-time";
	time.textContent = message.timestamp
		? new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
		: "";
	header.append(label, time);
	row.append(header, renderContent(message));
	const copyText = contentText(message).trim();
	if (message.role === "assistant" && copyText) {
		const footer = document.createElement("div");
		footer.className = "message-actions";
		const copyButton = document.createElement("button");
		copyButton.type = "button";
		copyButton.className = "message-action-btn";
		copyButton.title = "Copy";
		copyButton.setAttribute("aria-label", "Copy response");
		copyButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>`;
		copyButton.addEventListener("click", async () => {
			try {
				await navigator.clipboard.writeText(copyText);
				copyButton.classList.add("copied");
				copyButton.title = "Copied";
				setTimeout(() => {
					copyButton.classList.remove("copied");
					copyButton.title = "Copy";
				}, 1500);
			} catch (error) {
				showError(error);
			}
		});
		footer.append(copyButton);
		row.append(footer);
	}
	return row;
}

function createToolGroup(
	call: DesktopToolCall,
	result: DesktopMessage | undefined,
	execution: { isError: boolean } | undefined,
	collapsed: boolean,
): HTMLElement {
	const details = document.createElement("details");
	details.className = `tool-group ${result?.isError || execution?.isError ? "error" : ""}`;
	details.open = !collapsed;

	const summary = document.createElement("summary");
	const name = document.createElement("span");
	name.className = "tool-name";
	name.textContent = formatToolLabel(call.name);
	const stateLabel = document.createElement("span");
	stateLabel.className = "tool-state";
	stateLabel.textContent = toolStateLabel(result, execution);
	summary.append(name, stateLabel);
	details.append(summary);

	const input = renderToolInput(call.input);
	if (input) {
		const pre = document.createElement("pre");
		pre.className = "tool-input";
		const code = document.createElement("code");
		code.textContent = input;
		pre.append(code);
		details.append(pre);
	}
	if (result) {
		const body = renderContent(result);
		body.classList.add("tool-result-body");
		details.append(body);
	}
	return details;
}

function renderMessages(messages: DesktopMessage[]): void {
	currentMessages = messages;
	syncSessionMenu();
	const sessionChanged = renderedSessionId !== state?.sessionId;
	const followAfterRender = sessionChanged || shouldFollowMessages || isMessagesScrolledToBottom();
	const previousScrollTop = messagesEl.scrollTop;
	messagesEl.innerHTML = "";
	if (sessionChanged) {
		renderedSessionId = state?.sessionId;
		completedToolExecutions.clear();
		visibleMessageLimit = messagePageSize;
		shouldFollowMessages = true;
	}
	if (messages.length === 0) {
		const empty = document.createElement("div");
		empty.className = "empty";
		empty.innerHTML = `
			<div class="empty-title">Start with the repo in front of you.</div>
			<div class="empty-copy">Ask for a change, an explanation, or a check against this workspace.</div>
		`;
		messagesEl.append(empty);
		return;
	}

	const firstVisibleIndex = Math.max(0, messages.length - visibleMessageLimit);
	if (firstVisibleIndex > 0) {
		const older = document.createElement("button");
		older.type = "button";
		older.className = "load-older";
		older.textContent = `Show ${Math.min(messagePageSize, firstVisibleIndex)} earlier messages`;
		older.addEventListener("click", () => {
			visibleMessageLimit += messagePageSize;
			renderMessages(messages);
		});
		messagesEl.append(older);
	}

	for (let index = firstVisibleIndex; index < messages.length; index++) {
		const message = messages[index]!;
		if (message.role === "toolResult") continue;
		if (!hasVisibleContent(message)) continue;
		const row = createMessage(message);
		if (message.toolCalls?.length) {
			const tools = document.createElement("div");
			tools.className = "tool-stack";
			for (const call of message.toolCalls) {
				const resultIndex = messages.findIndex((candidate, candidateIndex) => {
					return candidateIndex > index && candidate.role === "toolResult" && candidate.toolCallId === call.id;
				});
				const result = resultIndex === -1 ? undefined : messages[resultIndex];
				const hasNewerMessages = resultIndex !== -1 && resultIndex < messages.length - 1;
				const execution = result ? undefined : completedToolExecutions.get(call.id);
				tools.append(createToolGroup(call, result, execution, hasNewerMessages || Boolean(execution)));
			}
			row.append(tools);
		}
		messagesEl.append(row);
	}
	const lastMessage = messages.at(-1);
	const assistantHasContent =
		lastMessage?.role === "assistant" &&
		Boolean(contentText(lastMessage).trim() || lastMessage.content.length > 0 || lastMessage.toolCalls?.length);
	if (isComposerBusy && !assistantHasContent) showStreamingIndicator();
	if (followAfterRender) {
		scrollMessagesToBottom();
	} else {
		messagesEl.scrollTop = Math.min(
			previousScrollTop,
			Math.max(0, messagesEl.scrollHeight - messagesEl.clientHeight),
		);
	}
}

window.__piDesktopTest = {
	renderMessages,
	renderState,
	renderSessionList,
	applyContextSelections,
	getSlashCommands: supportedSlashCommandNames,
	get sessions() {
		return sessions;
	},
	set sessions(next: DesktopSessionInfo[]) {
		sessions = next;
	},
};

function renderState(next: DesktopState): void {
	const previous = state;
	state = next;
	const requiresAuth = next.authRequired;
	appEl.classList.toggle("auth-required", requiresAuth);
	loginScreen.hidden = !requiresAuth;
	messagesEl.hidden = requiresAuth;
	composer.hidden = requiresAuth;
	cwdInput.value = next.cwd;
	updateSessionTitle();
	const model = next.model ? `${next.model.provider}/${next.model.id}` : "No model selected";
	composerModelButton.textContent = modelDisplay(next);
	modelMeta.textContent = next.model
		? "Using shared Pi auth and model config"
		: "Use pi /login or configure ~/.pi/agent";
	workspaceName.textContent = basename(next.cwd);
	sessionShortId.textContent = shortId(next.sessionId);
	messageCount.textContent = String(next.messageCount);
	queueCount.textContent = String(next.pendingMessageCount);
	contextSummary.innerHTML = `
		<div><span>Working directory</span><strong>${next.cwd}</strong></div>
		<div><span>Session store</span><strong>${next.sessionDir ?? "Default Pi session store"}</strong></div>
		<div><span>Session file</span><strong>${next.sessionFile ?? "Not written yet"}</strong></div>
		<div><span>Model</span><strong>${requiresAuth ? "Login required" : model}</strong></div>
	`;
	setBusy(next.isStreaming);

	const selectedValue = next.model ? `${next.model.provider}:${next.model.id}` : "";
	if (modelSelect.value !== selectedValue) {
		modelSelect.value = selectedValue;
	}
	syncComposerModelSelection();
	if (!previous || previous.sessionId !== next.sessionId || previous.cwd !== next.cwd) {
		renderSessionList();
	}
}

function updateSessionTitle(): void {
	if (isEditingSessionTitle) return;
	const title = sessionDisplayTitle(activeSession(), "New chat");
	sessionTitle.textContent = title;
	sessionTitle.title = title;
	document.title = `${title} - Pi Desktop`;
	syncSessionMenu();
}

function activeSession(): DesktopSessionInfo | undefined {
	return sessions.find((session) => isActiveSession(session));
}

function isActiveSession(session: DesktopSessionInfo | undefined): boolean {
	if (!session) return false;
	return Boolean(
		(state?.sessionId && session.id === state.sessionId) ||
			(state?.sessionFile && session.path === state.sessionFile),
	);
}

function sessionDisplayTitle(session: DesktopSessionInfo | undefined, fallback = "Untitled session"): string {
	const activeName = session && isActiveSession(session) ? state?.sessionName : undefined;
	const raw = activeName || session?.name || session?.firstMessage || fallback;
	return compactInferredSessionTitle(raw);
}

function compactInferredSessionTitle(value: string, maxLength = 42): string {
	const normalized = value.replace(/\s+/g, " ").trim();
	if (normalized.length <= maxLength) return normalized;
	const clipped = normalized.slice(0, maxLength - 3);
	const wordBoundary = clipped.lastIndexOf(" ");
	const prefix = wordBoundary >= 18 ? clipped.slice(0, wordBoundary) : clipped;
	return `${prefix.trimEnd()}...`;
}

function sessionIdentityKeys(session: DesktopSessionInfo | undefined): string[] {
	return [session?.path, session?.id].filter((value): value is string => Boolean(value));
}

function sessionStorageKey(session: DesktopSessionInfo | undefined): string | undefined {
	return session?.path || session?.id;
}

function persistSessionKeys(storageKey: string, values: Set<string>): void {
	localStorage.setItem(storageKey, JSON.stringify([...values]));
}

function isSessionPinned(session: DesktopSessionInfo | undefined): boolean {
	return sessionIdentityKeys(session).some((key) => pinnedSessionKeys.has(key));
}

function isSessionArchived(session: DesktopSessionInfo | undefined): boolean {
	return sessionIdentityKeys(session).some((key) => archivedSessionKeys.has(key));
}

function setSessionPinned(session: DesktopSessionInfo | undefined, pinned: boolean): void {
	const key = sessionStorageKey(session);
	if (!key) return;
	if (pinned) {
		pinnedSessionKeys.add(key);
		for (const identityKey of sessionIdentityKeys(session)) archivedSessionKeys.delete(identityKey);
	} else {
		for (const identityKey of sessionIdentityKeys(session)) pinnedSessionKeys.delete(identityKey);
	}
	persistSessionKeys(pinnedSessionsStorageKey, pinnedSessionKeys);
	persistSessionKeys(archivedSessionsStorageKey, archivedSessionKeys);
	syncSessionMenu();
	renderSessionList();
}

function setSessionArchived(session: DesktopSessionInfo | undefined, archived: boolean): void {
	const key = sessionStorageKey(session);
	if (!key) return;
	if (archived) {
		archivedSessionKeys.add(key);
		for (const identityKey of sessionIdentityKeys(session)) pinnedSessionKeys.delete(identityKey);
	} else {
		for (const identityKey of sessionIdentityKeys(session)) archivedSessionKeys.delete(identityKey);
	}
	persistSessionKeys(archivedSessionsStorageKey, archivedSessionKeys);
	persistSessionKeys(pinnedSessionsStorageKey, pinnedSessionKeys);
}

function modifiedSessionTime(session: DesktopSessionInfo | undefined): number {
	return new Date(session?.modified ?? 0).getTime();
}

function syncSessionMenu(): void {
	const session = activeSession();
	const hasSession = Boolean(session && state?.sessionId);
	sessionMenuTrigger.disabled = !hasSession;
	for (const button of [
		sessionMenuPin,
		sessionMenuRename,
		sessionMenuCopyCwd,
		sessionMenuCopyId,
		sessionMenuCopyLink,
		sessionMenuCopyMarkdown,
		sessionMenuCopyDebugLog,
		sessionMenuArchive,
	]) {
		button.disabled = !hasSession;
	}
	const pinned = isSessionPinned(session);
	sessionMenuTrigger.classList.toggle("pinned", pinned);
	sessionMenuPin.querySelector("span:last-child")!.textContent = pinned ? "Unpin chat" : "Pin chat";
	sessionMenuPin.setAttribute("aria-pressed", pinned ? "true" : "false");
	if (!hasSession) closeSessionMenu();
}

function renderModels(): void {
	modelSelect.innerHTML = "";
	composerModelMenu.innerHTML = "";
	if (models.length === 0) {
		const option = document.createElement("option");
		option.value = "";
		option.textContent = "No configured models";
		modelSelect.append(option);
		modelSelect.disabled = true;
		composerModelButton.textContent = "No model selected";
		composerModelButton.disabled = true;
		return;
	}
	modelSelect.disabled = false;
	composerModelButton.disabled = false;
	composerModelMenu.append(createMenuLabel("Reasoning"));
	const currentThinking = (state?.thinkingLevel ?? "medium").toLowerCase();
	for (const [label, value] of [
		["Low", "low"],
		["Medium", "medium"],
		["High", "high"],
		["Extra High", "extra-high"],
	]) {
		const item = document.createElement("button");
		item.type = "button";
		item.className = `model-menu-item reasoning-item ${currentThinking === value ? "active" : ""}`;
		item.setAttribute("aria-disabled", "true");
		item.tabIndex = -1;
		item.innerHTML = `<span>${label}</span>`;
		composerModelMenu.append(item);
	}
	composerModelMenu.append(createMenuSeparator(), createMenuLabel("Model"));
	const filterWrap = document.createElement("label");
	filterWrap.className = "model-filter";
	filterWrap.innerHTML = `<span>Filter models</span><input type="search" placeholder="Search models" autocomplete="off" spellcheck="false" />`;
	const filterInput = filterWrap.querySelector<HTMLInputElement>("input")!;
	filterInput.addEventListener("input", () => {
		filterModelMenu(filterInput.value);
	});
	composerModelMenu.append(filterWrap);
	const selectedValue = state?.model ? `${state.model.provider}:${state.model.id}` : "";
	const sortedModels = [...models].sort((a, b) => {
		const aSelected = `${a.provider}:${a.id}` === selectedValue ? 0 : 1;
		const bSelected = `${b.provider}:${b.id}` === selectedValue ? 0 : 1;
		return aSelected - bSelected;
	});
	for (const model of sortedModels) {
		const option = document.createElement("option");
		option.value = `${model.provider}:${model.id}`;
		option.textContent = `${model.provider} / ${model.id}`;
		modelSelect.append(option);

		const item = document.createElement("button");
		item.type = "button";
		item.className = "model-menu-item";
		item.dataset.value = option.value;
		item.dataset.modelId = model.id;
		item.dataset.provider = model.provider;
		item.innerHTML = `<span class="model-menu-name">${model.id}</span><small>${model.provider}</small>`;
		item.addEventListener("click", async () => {
			try {
				modelSelect.value = option.value;
				closeComposerMenus();
				renderState(await window.piDesktop.setModel(model.provider, model.id));
				promptInput.focus();
			} catch (error) {
				showError(error);
			}
		});
		composerModelMenu.append(item);
	}
	if (state?.model) {
		modelSelect.value = `${state.model.provider}:${state.model.id}`;
	}
	syncComposerModelSelection();
}

function renderSessionList(): void {
	sessionList.innerHTML = "";
	const visibleSessions = sessions.filter((session) => showArchivedSessions || !isSessionArchived(session));
	const archivedCount = sessions.filter((session) => isSessionArchived(session)).length;
	if (visibleSessions.length === 0) {
		const empty = document.createElement("div");
		empty.className = "session-empty";
		empty.textContent = showArchivedSessions ? "No archived chats yet." : "No saved chats in this store yet.";
		sessionList.append(empty);
	}

	const groups = new Map<string, DesktopSessionInfo[]>();
	for (const session of visibleSessions) {
		const group = groups.get(session.cwd) ?? [];
		group.push(session);
		groups.set(session.cwd, group);
	}
	for (const projectSessions of groups.values()) {
		projectSessions.sort(
			(a, b) =>
				Number(isSessionPinned(b)) - Number(isSessionPinned(a)) || modifiedSessionTime(b) - modifiedSessionTime(a),
		);
	}
	const orderedGroups = [...groups.entries()].sort(([, sessionsA], [, sessionsB]) => {
		return modifiedSessionTime(sessionsB[0]) - modifiedSessionTime(sessionsA[0]);
	});
	const currentProjectKeys = new Set(orderedGroups.map(([cwd]) => cwd));
	for (const cwd of projectSessionLimits.keys()) {
		if (!currentProjectKeys.has(cwd)) {
			projectSessionLimits.delete(cwd);
		}
	}

	for (const [cwd, projectSessions] of orderedGroups) {
		const heading = document.createElement("div");
		heading.className = `session-group-heading ${cwd === state?.cwd ? "current" : ""}`;
		const icon = document.createElement("span");
		icon.className = "project-icon";
		icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-7.2L9.8 5H5a2 2 0 0 0-2 2.5Z" /></svg>`;
		const label = document.createElement("span");
		label.className = "project-name";
		label.textContent = basename(cwd);
		heading.title = `${cwd} · ${projectSessions.length} sessions`;
		heading.append(icon, label);
		sessionList.append(heading);

		const activeIndex = projectSessions.findIndex((session) => isActiveSession(session));
		const defaultLimit = activeIndex >= projectSessionPageSize ? activeIndex + 1 : projectSessionPageSize;
		const visibleLimit = Math.min(projectSessionLimits.get(cwd) ?? defaultLimit, projectSessions.length);
		for (const session of projectSessions.slice(0, visibleLimit)) {
			sessionList.append(createSessionListItem(session));
		}
		if (projectSessions.length > projectSessionPageSize) {
			const controls = document.createElement("div");
			controls.className = "session-pagination";
			const hiddenCount = projectSessions.length - visibleLimit;
			if (hiddenCount > 0) {
				const showMore = document.createElement("button");
				showMore.type = "button";
				showMore.className = "session-pagination-button";
				showMore.textContent = `Show ${Math.min(projectSessionPageSize, hiddenCount)} more`;
				showMore.addEventListener("click", () => {
					projectSessionLimits.set(cwd, Math.min(visibleLimit + projectSessionPageSize, projectSessions.length));
					renderSessionList();
				});
				controls.append(showMore);
			}
			if (visibleLimit > projectSessionPageSize) {
				const showLess = document.createElement("button");
				showLess.type = "button";
				showLess.className = "session-pagination-button";
				showLess.textContent = "Show less";
				showLess.addEventListener("click", () => {
					projectSessionLimits.delete(cwd);
					renderSessionList();
				});
				controls.append(showLess);
			}
			sessionList.append(controls);
		}
	}
	if (archivedCount > 0) {
		const archivedToggle = document.createElement("button");
		archivedToggle.type = "button";
		archivedToggle.className = "archived-sessions-toggle";
		archivedToggle.textContent = showArchivedSessions ? "Hide archived chats" : `Show ${archivedCount} archived`;
		archivedToggle.addEventListener("click", () => {
			showArchivedSessions = !showArchivedSessions;
			renderSessionList();
		});
		sessionList.append(archivedToggle);
	}
	syncSessionMenu();
}

function createSessionListItem(session: DesktopSessionInfo): HTMLElement {
	const row = document.createElement("div");
	row.className = `session-item-row ${isActiveSession(session) ? "active" : ""} ${
		session.path === switchingSessionPath ? "loading" : ""
	} ${isSessionPinned(session) ? "pinned" : ""} ${isSessionArchived(session) ? "archived" : ""}`;
	const button = document.createElement("button");
	button.type = "button";
	button.disabled = session.path === switchingSessionPath;
	button.className = "session-item";
	const title = sessionDisplayTitle(session);
	const titleEl = document.createElement("span");
	titleEl.className = "session-item-title";
	const titleText = document.createElement("span");
	titleText.className = "session-item-title-text";
	titleText.textContent = title;
	titleEl.append(titleText);
	const metaEl = document.createElement("span");
	metaEl.className = "session-item-meta";
	if (session.path === switchingSessionPath) {
		metaEl.textContent = "Loading...";
	} else {
		const timeSpan = document.createElement("span");
		timeSpan.className = "session-item-time";
		timeSpan.textContent = formatRelative(session.modified);
		const msgSpan = document.createElement("span");
		msgSpan.className = "session-item-messages";
		msgSpan.textContent = `${session.messageCount} msg`;
		metaEl.append(timeSpan, msgSpan);
	}
	button.append(titleEl, metaEl);
	button.addEventListener("click", async () => {
		try {
			await switchToSession(session.path);
		} catch (error) {
			showError(error);
		}
	});

	const actions = document.createElement("div");
	actions.className = "session-item-actions";
	const pinButton = document.createElement("button");
	pinButton.type = "button";
	pinButton.className = "session-row-action session-pin-button";
	pinButton.title = isSessionPinned(session) ? "Unpin chat" : "Pin chat";
	pinButton.setAttribute("aria-label", pinButton.title);
	pinButton.setAttribute("aria-pressed", isSessionPinned(session) ? "true" : "false");
	pinButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 4 6 6-4 1-4 7-2-2 7-4 1-4-6-6Z" /><path d="m4 20 6-6" /></svg>`;
	pinButton.addEventListener("click", (event) => {
		event.stopPropagation();
		setSessionPinned(session, !isSessionPinned(session));
	});
	const archiveButton = document.createElement("button");
	archiveButton.type = "button";
	archiveButton.className = "session-row-action";
	archiveButton.title = isSessionArchived(session) ? "Unarchive chat" : "Archive chat";
	archiveButton.setAttribute("aria-label", archiveButton.title);
	archiveButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" /><path d="M10 12h4" /></svg>`;
	archiveButton.addEventListener("click", async (event) => {
		event.stopPropagation();
		try {
			if (isSessionArchived(session)) {
				setSessionArchived(session, false);
				renderSessionList();
			} else {
				await archiveSession(session);
			}
		} catch (error) {
			showError(error);
		}
	});
	actions.append(pinButton, archiveButton);
	row.append(button, actions);
	return row;
}

function renderGit(status: GitStatus): void {
	if (!status.isRepo) {
		gitBranch.textContent = "Not a git repository";
		gitStatus.textContent = status.error || "";
		return;
	}
	const changed = status.status.length;
	gitBranch.textContent = `${status.branch || "unknown"} · ${changed} changed`;
	gitStatus.innerHTML = "";
	if (changed === 0 && !status.diffStat) {
		gitStatus.innerHTML = `<div class="git-clean">Working tree clean</div>`;
		return;
	}
	for (const line of status.status.slice(0, 32)) {
		const item = document.createElement("div");
		item.className = "git-line";
		item.textContent = line;
		gitStatus.append(item);
	}
	if (status.diffStat) {
		const stat = document.createElement("pre");
		stat.className = "diff-stat";
		stat.textContent = status.diffStat;
		gitStatus.append(stat);
	}
}

async function refreshModels(): Promise<void> {
	models = await window.piDesktop.listModels();
	renderModels();
}

async function refreshSessions(): Promise<void> {
	sessions = await window.piDesktop.listSessions();
	updateSessionTitle();
	renderSessionList();
}

async function refreshGit(): Promise<void> {
	renderGit(await window.piDesktop.gitStatus());
}

async function refreshAfterSessionChange(): Promise<void> {
	await Promise.all([refreshModels(), refreshSessions(), refreshGit()]);
	renderMessages(await window.piDesktop.getMessages());
}

async function switchToSession(sessionPath: string): Promise<void> {
	if (switchingSessionPath) return;
	if (sessionPath === state?.sessionFile) {
		promptInput.focus();
		return;
	}
	switchingSessionPath = sessionPath;
	messagesEl.classList.add("loading-session");
	renderSessionList();
	try {
		renderState(await window.piDesktop.switchSession(sessionPath));
		switchingSessionPath = undefined;
		renderSessionList();
		renderMessages(await window.piDesktop.getMessages());
		messagesEl.classList.remove("loading-session");
		promptInput.focus();
		refreshModels().catch(showError);
		refreshGit().catch(showError);
	} finally {
		switchingSessionPath = undefined;
		renderSessionList();
		messagesEl.classList.remove("loading-session");
	}
}

function setSessionMenuOpen(open: boolean): void {
	sessionMenu.hidden = !open;
	sessionMenuTrigger.setAttribute("aria-expanded", open ? "true" : "false");
	if (!open) {
		sessionRenameForm.hidden = true;
		sessionMenu.querySelector<HTMLDivElement>(".session-menu-actions")!.hidden = false;
	}
}

function closeSessionMenu(): void {
	setSessionMenuOpen(false);
}

function conversationMarkdown(): string {
	return currentMessages
		.filter((message) => message.role === "user" || message.role === "assistant")
		.map((message) => {
			const text = contentText(message).trim();
			if (!text) return "";
			return `## ${message.role === "user" ? "You" : "Pi"}\n\n${text}`;
		})
		.filter(Boolean)
		.join("\n\n");
}

async function copySessionMenuText(button: HTMLButtonElement, text: string | undefined): Promise<void> {
	if (!text) return;
	await navigator.clipboard.writeText(text);
	const label = button.querySelector("span:last-child");
	const previous = label?.textContent ?? "";
	if (label) label.textContent = "Copied";
	closeSessionMenu();
	if (label && previous) {
		window.setTimeout(() => {
			label.textContent = previous;
		}, 1500);
	}
}

function showSessionRenameForm(): void {
	const session = activeSession();
	if (!session || isEditingSessionTitle) return;
	closeSessionMenu();
	const originalTitle = sessionDisplayTitle(session);
	isEditingSessionTitle = true;
	sessionTitle.hidden = true;
	sessionTitleInput.hidden = false;
	sessionTitleInput.value = originalTitle;
	sessionTitleInput.focus();
	sessionTitleInput.select();

	const stopEditing = (save: boolean): void => {
		sessionTitleInput.removeEventListener("blur", onBlur);
		sessionTitleInput.removeEventListener("keydown", onKeydown);
		sessionTitleInput.hidden = true;
		sessionTitle.hidden = false;
		isEditingSessionTitle = false;
		if (save) {
			const nextName = sessionTitleInput.value.trim();
			if (nextName && nextName !== originalTitle) {
				window.piDesktop
					.setSessionName(nextName)
					.then((next) => {
						renderState(next);
						return refreshSessions();
					})
					.catch(showError);
			} else {
				updateSessionTitle();
			}
		} else {
			updateSessionTitle();
		}
	};
	const onBlur = (): void => stopEditing(true);
	const onKeydown = (event: KeyboardEvent): void => {
		if (event.key === "Enter") {
			event.preventDefault();
			stopEditing(true);
		}
		if (event.key === "Escape") {
			event.preventDefault();
			stopEditing(false);
		}
	};
	sessionTitleInput.addEventListener("blur", onBlur);
	sessionTitleInput.addEventListener("keydown", onKeydown);
}

function nextSessionInProjectAfterArchive(session: DesktopSessionInfo): DesktopSessionInfo | undefined {
	return sessions
		.filter(
			(candidate) => candidate.cwd === session.cwd && !isActiveSession(candidate) && !isSessionArchived(candidate),
		)
		.sort(
			(a, b) =>
				Number(isSessionPinned(b)) - Number(isSessionPinned(a)) || modifiedSessionTime(b) - modifiedSessionTime(a),
		)[0];
}

async function archiveSession(session: DesktopSessionInfo): Promise<void> {
	const wasActive = isActiveSession(session);
	if (wasActive && isComposerBusy) {
		await abortCurrentRun();
	}
	setSessionArchived(session, true);
	if (!wasActive) {
		renderSessionList();
		syncSessionMenu();
		return;
	}
	const nextSession = nextSessionInProjectAfterArchive(session);
	if (nextSession?.path) {
		await switchToSession(nextSession.path);
		return;
	}
	if (state?.cwd !== session.cwd) {
		renderState(await window.piDesktop.setCwd(session.cwd));
	}
	renderState(await window.piDesktop.newSession());
	await refreshAfterSessionChange();
}

function showError(error: unknown): void {
	const text = error instanceof Error ? error.message : String(error);
	showDesktopMessage("Desktop", text, "error");
}

function showDesktopMessage(labelText: string, text: string, variant: "notice" | "error" = "notice"): void {
	const row = document.createElement("article");
	row.className = `message ${variant}`;
	const header = document.createElement("div");
	header.className = "message-header";
	const label = document.createElement("span");
	label.textContent = labelText;
	header.append(label);
	const body = document.createElement("div");
	body.className = "message-body";
	body.textContent = text;
	row.append(header, body);
	messagesEl.append(row);
	messagesEl.scrollTop = messagesEl.scrollHeight;
}

function autosizePrompt(): void {
	promptInput.style.height = "auto";
	promptInput.style.height = `${Math.min(promptInput.scrollHeight, 220)}px`;
}

function syncSendButtonState(): void {
	if (isComposerBusy) {
		sendButton.disabled = isAbortingRun || Boolean(state?.authRequired);
		return;
	}
	sendButton.disabled =
		Boolean(state?.authRequired) ||
		(promptInput.value.trim().length === 0 && composerImages.length === 0 && composerFiles.length === 0);
}

function closeImagePreview(): void {
	imagePreviewOverlay.hidden = true;
	imagePreviewOverlay.replaceChildren();
}

function openImagePreview(attachment: ComposerImageAttachment): void {
	imagePreviewOverlay.replaceChildren();
	let zoom = 1;
	const minZoom = 0.5;
	const maxZoom = 3;
	const zoomStep = 0.25;

	const dialog = document.createElement("div");
	dialog.className = "image-preview-dialog";
	dialog.setAttribute("role", "dialog");
	dialog.setAttribute("aria-modal", "true");
	dialog.setAttribute("aria-label", attachment.name);

	const image = document.createElement("img");
	image.src = attachment.objectUrl;
	image.alt = attachment.name;

	const zoomBar = document.createElement("div");
	zoomBar.className = "image-preview-zoom";

	const zoomOut = document.createElement("button");
	zoomOut.type = "button";
	zoomOut.className = "image-preview-zoom-button";
	zoomOut.title = "Zoom out";
	zoomOut.setAttribute("aria-label", "Zoom out");
	zoomOut.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>`;

	const zoomLabel = document.createElement("div");
	zoomLabel.className = "image-preview-zoom-label";

	const zoomIn = document.createElement("button");
	zoomIn.type = "button";
	zoomIn.className = "image-preview-zoom-button";
	zoomIn.title = "Zoom in";
	zoomIn.setAttribute("aria-label", "Zoom in");
	zoomIn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>`;

	const updateZoom = () => {
		image.style.setProperty("--preview-zoom", String(zoom));
		zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
		zoomOut.disabled = zoom <= minZoom;
		zoomIn.disabled = zoom >= maxZoom;
	};
	zoomOut.addEventListener("click", () => {
		zoom = Math.max(minZoom, zoom - zoomStep);
		updateZoom();
	});
	zoomIn.addEventListener("click", () => {
		zoom = Math.min(maxZoom, zoom + zoomStep);
		updateZoom();
	});

	const close = document.createElement("button");
	close.type = "button";
	close.className = "image-preview-close";
	close.title = "Close preview";
	close.setAttribute("aria-label", "Close preview");
	close.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>`;
	close.addEventListener("click", closeImagePreview);

	updateZoom();
	zoomBar.append(zoomOut, zoomLabel, zoomIn);
	dialog.append(image, close);
	imagePreviewOverlay.append(dialog, zoomBar);
	imagePreviewOverlay.hidden = false;
	close.focus();
}

function renderComposerAttachments(): void {
	composerAttachments.replaceChildren();
	composerAttachments.hidden = composerImages.length === 0 && composerFiles.length === 0;
	for (const attachment of composerImages) {
		const item = document.createElement("div");
		item.className = "composer-attachment";

		const preview = document.createElement("button");
		preview.type = "button";
		preview.className = "composer-attachment-preview";
		preview.title = `Preview ${attachment.name}`;
		preview.setAttribute("aria-label", `Preview ${attachment.name}`);
		preview.addEventListener("click", () => openImagePreview(attachment));

		const image = document.createElement("img");
		image.src = attachment.objectUrl;
		image.alt = attachment.name;
		preview.append(image);

		const remove = document.createElement("button");
		remove.type = "button";
		remove.className = "composer-attachment-remove";
		remove.title = `Remove ${attachment.name}`;
		remove.setAttribute("aria-label", `Remove ${attachment.name}`);
		remove.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7" /><path d="m11.5 4.5-7 7" /></svg>`;
		remove.addEventListener("click", () => {
			composerImages = composerImages.filter((candidate) => candidate.id !== attachment.id);
			URL.revokeObjectURL(attachment.objectUrl);
			closeImagePreview();
			renderComposerAttachments();
			syncSendButtonState();
			promptInput.focus();
		});

		item.append(preview, remove);
		composerAttachments.append(item);
	}
	for (const attachment of composerFiles) {
		const item = document.createElement("div");
		item.className = "composer-file-attachment";

		const icon = document.createElement("div");
		icon.className = "composer-file-icon";
		icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h4" /></svg>`;

		const meta = document.createElement("div");
		meta.className = "composer-file-meta";
		const name = document.createElement("div");
		name.className = "composer-file-name";
		name.textContent = attachment.name;
		const type = document.createElement("div");
		type.className = "composer-file-type";
		type.textContent = fileTypeLabel(attachment.name);
		meta.append(name, type);

		const remove = document.createElement("button");
		remove.type = "button";
		remove.className = "composer-attachment-remove composer-file-remove";
		remove.title = `Remove ${attachment.name}`;
		remove.setAttribute("aria-label", `Remove ${attachment.name}`);
		remove.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7" /><path d="m11.5 4.5-7 7" /></svg>`;
		remove.addEventListener("click", () => {
			composerFiles = composerFiles.filter((candidate) => candidate.id !== attachment.id);
			renderComposerAttachments();
			syncSendButtonState();
			promptInput.focus();
		});

		item.append(icon, meta, remove);
		composerAttachments.append(item);
	}
	syncSendButtonState();
}

function clearComposerAttachments(): void {
	for (const attachment of composerImages) {
		URL.revokeObjectURL(attachment.objectUrl);
	}
	composerImages = [];
	composerFiles = [];
	renderComposerAttachments();
}

function fileTypeLabel(name: string): string {
	const extension = name.includes(".") ? name.split(".").pop()?.trim() : "";
	return extension ? extension.toUpperCase() : "FILE";
}

function readImageAttachment(file: File): Promise<ComposerImageAttachment> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.addEventListener("load", () => {
			const result = typeof reader.result === "string" ? reader.result : "";
			const comma = result.indexOf(",");
			const data = comma === -1 ? result : result.slice(comma + 1);
			resolve({
				id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
				data,
				mimeType: file.type || "image/png",
				name: file.name || "Pasted image",
				objectUrl: URL.createObjectURL(file),
			});
		});
		reader.addEventListener("error", () => reject(reader.error ?? new Error(`Failed to read ${file.name}`)));
		reader.readAsDataURL(file);
	});
}

function imageFilesFromClipboard(event: ClipboardEvent): File[] {
	const data = event.clipboardData;
	if (!data) return [];
	const files: File[] = [];
	for (const item of Array.from(data.items)) {
		if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
		const file = item.getAsFile();
		if (file) files.push(file);
	}
	if (files.length > 0) return files;
	return Array.from(data.files).filter((file) => file.type.startsWith("image/"));
}

async function addComposerImageFiles(files: File[]): Promise<void> {
	if (files.length === 0) return;
	const attachments = await Promise.all(files.map(readImageAttachment));
	composerImages = [...composerImages, ...attachments];
	renderComposerAttachments();
}

function addComposerImageSelections(selections: Extract<DesktopContextSelection, { type: "image" }>[]): void {
	if (selections.length === 0) return;
	const attachments = selections.map((selection) => ({
		id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
		data: selection.data,
		mimeType: selection.mimeType,
		name: selection.name,
		objectUrl: `data:${selection.mimeType};base64,${selection.data}`,
	}));
	composerImages = [...composerImages, ...attachments];
	renderComposerAttachments();
}

function addComposerFileSelections(selections: Extract<DesktopContextSelection, { type: "path" }>[]): void {
	if (selections.length === 0) return;
	const attachments = selections.map((selection) => ({
		id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
		path: selection.path,
		name: selection.name || basename(selection.path),
	}));
	composerFiles = [...composerFiles, ...attachments];
	renderComposerAttachments();
}

function insertComposerContext(paths: string[]): void {
	if (paths.length === 0) return;
	const block = [
		paths.length === 1 ? "Use this path as context:" : "Use these paths as context:",
		...paths.map((path) => `- ${path}`),
	].join("\n");
	const current = promptInput.value.trimEnd();
	promptInput.value = current ? `${current}\n\n${block}\n` : `${block}\n`;
	autosizePrompt();
	promptInput.focus();
	promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
}

function contextTextForPaths(paths: string[]): string {
	if (paths.length === 0) return "";
	return [
		paths.length === 1 ? "Use this path as context:" : "Use these paths as context:",
		...paths.map((path) => `- ${path}`),
	].join("\n");
}

function messageWithFileContext(message: string): string {
	const context = contextTextForPaths(composerFiles.map((file) => file.path));
	if (!context) return message;
	return message ? `${message}\n\n${context}` : context;
}

function applyContextSelections(
	selections: DesktopContextSelection[],
	options: { attachPathChips?: boolean } = {},
): void {
	addComposerImageSelections(
		selections.filter(
			(selection): selection is Extract<DesktopContextSelection, { type: "image" }> => selection.type === "image",
		),
	);
	const paths = selections.filter(
		(selection): selection is Extract<DesktopContextSelection, { type: "path" }> => selection.type === "path",
	);
	if (options.attachPathChips) {
		addComposerFileSelections(paths);
	} else {
		insertComposerContext(paths.map((selection) => selection.path));
	}
}

async function abortCurrentRun(): Promise<void> {
	if (isAbortingRun) return;
	isAbortingRun = true;
	syncSendButtonState();
	try {
		renderState(await window.piDesktop.abort());
	} catch (error) {
		showError(error);
	} finally {
		isAbortingRun = false;
		setBusy(Boolean(state?.isStreaming));
	}
}

composer.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (isComposerBusy) {
		await abortCurrentRun();
		return;
	}
	const message = promptInput.value.trim();
	if (!message && composerImages.length === 0 && composerFiles.length === 0) return;
	if (message.startsWith("/")) {
		if (composerImages.length > 0 || composerFiles.length > 0) {
			showError("Slash commands cannot include attachments.");
			return;
		}
		await executeSlashCommand(message);
		return;
	}
	const images = composerImages.map((image) => ({
		type: "image" as const,
		data: image.data,
		mimeType: image.mimeType,
	}));
	promptInput.value = "";
	const promptText = messageWithFileContext(message);
	clearComposerAttachments();
	autosizePrompt();
	setBusy(true);
	showStreamingIndicator();
	try {
		renderState(await window.piDesktop.prompt({ text: promptText, images }));
		await refreshSessions();
	} catch (error) {
		showError(error);
		setBusy(false);
	}
});

promptInput.addEventListener("keydown", (event) => {
	if (!slashCommandMenu.hidden) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			moveSlashSelection(1);
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			moveSlashSelection(-1);
			return;
		}
		if (event.key === "Tab" || event.key === "Enter") {
			const item = matchingSlashPaletteItems()[selectedSlashCommandIndex];
			if (item) {
				event.preventDefault();
				selectSlashPaletteItem(item).catch(showError);
				return;
			}
		}
	}
	if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
		composer.requestSubmit();
	}
});

promptInput.addEventListener("input", () => {
	autosizePrompt();
	syncSendButtonState();
	renderSlashCommandMenu();
});

promptInput.addEventListener("paste", (event) => {
	const files = imageFilesFromClipboard(event);
	if (files.length === 0) return;
	event.preventDefault();
	addComposerImageFiles(files).catch(showError);
});

messagesEl.addEventListener("scroll", () => {
	shouldFollowMessages = isMessagesScrolledToBottom();
});

messagesEl.addEventListener("click", (event) => {
	if (event.defaultPrevented) return;
	const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : undefined;
	if (!anchor || !messagesEl.contains(anchor) || !isBrowserUrl(anchor.href)) return;
	event.preventDefault();
	openUrlInRightBrowser(anchor.href);
});

imagePreviewOverlay.addEventListener("click", (event) => {
	if (event.target === imagePreviewOverlay) {
		closeImagePreview();
	}
});

for (const button of newSessionButtons) {
	button.addEventListener("click", async () => {
		try {
			renderState(await window.piDesktop.newSession());
			await refreshAfterSessionChange();
		} catch (error) {
			showError(error);
		}
	});
}

changeCwdButton.addEventListener("click", async () => {
	try {
		renderState(await window.piDesktop.setCwd(cwdInput.value));
		await refreshAfterSessionChange();
	} catch (error) {
		showError(error);
	}
});

modelSelect.addEventListener("change", async () => {
	const [provider, ...idParts] = modelSelect.value.split(":");
	const id = idParts.join(":");
	if (!provider || !id) return;
	try {
		renderState(await window.piDesktop.setModel(provider, id));
		syncComposerModelSelection();
	} catch (error) {
		showError(error);
	}
});

themeSelect.addEventListener("change", () => {
	const preference = themeSelect.value as ThemePreference;
	localStorage.setItem(themeStorageKey, preference);
	applyTheme(preference);
});

themeMedia.addEventListener("change", () => {
	if (getThemePreference() === "system") {
		applyTheme("system");
	}
});

window.addEventListener("resize", syncResponsiveLayout);

sidebarSettingsTrigger.addEventListener("click", (event) => {
	event.preventDefault();
	event.stopPropagation();
	closeComposerMenus();
	closeSessionMenu();
	toggleSettingsPopover();
});

for (const button of toggleLeftPanelButtons) {
	button.addEventListener("click", () => {
		togglePanel("left");
	});
}

toggleRightPanelButton.addEventListener("click", () => {
	togglePanel("right");
	syncRightPanelContent();
});

// Right panel tabs and terminal/browser panes
let term: Terminal | undefined;
let fitAddon: FitAddon | undefined;
let terminalResizeObserver: ResizeObserver | undefined;
let terminalCreated = false;

function rightPanelTabFromDataset(button: HTMLButtonElement): RightPanelTab | undefined {
	const tab = button.dataset.rightPanelTab;
	return isRightPanelTab(tab) ? tab : undefined;
}

function bottomPanelTabFromDataset(button: HTMLButtonElement): WindowPanelTab | undefined {
	const tab = button.dataset.bottomPanelTab;
	return isWindowPanelTab(tab) ? tab : undefined;
}

function resizeTerminal(): void {
	if (!term || !fitAddon || term.element?.offsetParent === null) return;
	fitAddon.fit();
	window.piDesktop.terminalResize(term.cols, term.rows);
}

function createTerminal(): void {
	if (term) return;
	term = new Terminal({
		fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
		fontSize: 13,
		lineHeight: 1.35,
		cursorBlink: true,
		theme: {
			background: "#151515",
			foreground: "#d4d4d4",
			cursor: "#d4d4d4",
			selectionBackground: "#264f78",
		},
	});
	fitAddon = new FitAddon();
	term.loadAddon(fitAddon);
	term.onData((data) => {
		window.piDesktop.terminalWrite(data);
	});
	window.piDesktop.onTerminalData((data) => {
		term?.write(data);
	});
	terminalResizeObserver = new ResizeObserver(resizeTerminal);
	terminalResizeObserver.observe(terminalContainer);
	terminalResizeObserver.observe(rightTerminalContainer);
}

function mountTerminal(host: HTMLElement): void {
	createTerminal();
	if (!term) return;
	if (term.element) {
		host.append(term.element);
	} else {
		term.open(host);
	}
	if (!terminalCreated) {
		terminalCreated = true;
		window.piDesktop.terminalCreate().catch(showError);
	}
	setTimeout(() => {
		resizeTerminal();
		term?.focus();
	}, 0);
}

function openBrowserUrl(value: string, input: HTMLInputElement, frame: HTMLElement): void {
	const trimmed = value.trim();
	if (!trimmed) return;
	const url = new URL(isBrowserUrl(trimmed) ? trimmed : `https://${trimmed}`);
	input.value = url.href;
	frame.setAttribute("src", url.href);
}

function ensureBrowserLoaded(input: HTMLInputElement, frame: HTMLElement): void {
	if (frame.getAttribute("src") === "about:blank") {
		openBrowserUrl(input.value, input, frame);
	}
}

function openUrlInRightBrowser(url: string): void {
	layoutState.rightTab = "browser";
	layoutState.rightCollapsed = false;
	applyLayoutState();
	saveLayoutState();
	openBrowserUrl(url, browserUrlInput, browserFrame);
}

function syncRightPanelContent(): void {
	if (layoutState.rightCollapsed) return;
	if (layoutState.rightTab === "terminal") {
		mountTerminal(rightTerminalContainer);
	} else if (layoutState.rightTab === "browser") {
		ensureBrowserLoaded(browserUrlInput, browserFrame);
	}
}

function syncBottomPanelContent(): void {
	if (layoutState.bottomCollapsed) return;
	if (layoutState.bottomTab === "terminal") {
		mountTerminal(terminalContainer);
	} else {
		ensureBrowserLoaded(bottomBrowserUrlInput, bottomBrowserFrame);
	}
}

function setRightPanelTab(tab: RightPanelTab): void {
	layoutState.rightTab = tab;
	layoutState.rightCollapsed = false;
	applyLayoutState();
	saveLayoutState();
	syncRightPanelContent();
}

function setBottomPanelTab(tab: WindowPanelTab): void {
	layoutState.bottomTab = tab;
	layoutState.bottomCollapsed = false;
	applyLayoutState();
	saveLayoutState();
	syncBottomPanelContent();
}

function toggleBottomPanel(): void {
	layoutState.bottomCollapsed = !layoutState.bottomCollapsed;
	applyLayoutState();
	saveLayoutState();
	if (!layoutState.bottomCollapsed) {
		syncBottomPanelContent();
	} else {
		syncRightPanelContent();
	}
}

for (const tab of rightPanelTabs) {
	tab.addEventListener("click", () => {
		const nextTab = rightPanelTabFromDataset(tab);
		if (nextTab) setRightPanelTab(nextTab);
	});
}

for (const tab of bottomPanelTabs) {
	tab.addEventListener("click", () => {
		const nextTab = bottomPanelTabFromDataset(tab);
		if (nextTab) setBottomPanelTab(nextTab);
	});
}

toggleBottomPanelButton.addEventListener("click", toggleBottomPanel);

terminalCloseButton.addEventListener("click", () => {
	layoutState.bottomCollapsed = true;
	applyLayoutState();
	saveLayoutState();
	syncRightPanelContent();
});

browserGoButton.addEventListener("click", () => {
	try {
		openBrowserUrl(browserUrlInput.value, browserUrlInput, browserFrame);
	} catch (error) {
		showError(error);
	}
});

browserUrlInput.addEventListener("keydown", (event) => {
	if (event.key !== "Enter") return;
	event.preventDefault();
	try {
		openBrowserUrl(browserUrlInput.value, browserUrlInput, browserFrame);
	} catch (error) {
		showError(error);
	}
});

bottomBrowserGoButton.addEventListener("click", () => {
	try {
		openBrowserUrl(bottomBrowserUrlInput.value, bottomBrowserUrlInput, bottomBrowserFrame);
	} catch (error) {
		showError(error);
	}
});

bottomBrowserUrlInput.addEventListener("keydown", (event) => {
	if (event.key !== "Enter") return;
	event.preventDefault();
	try {
		openBrowserUrl(bottomBrowserUrlInput.value, bottomBrowserUrlInput, bottomBrowserFrame);
	} catch (error) {
		showError(error);
	}
});

// Bottom panel resize
bottomResizer.addEventListener("pointerdown", (event) => {
	event.preventDefault();
	const startY = event.clientY;
	const startHeight = layoutState.bottomHeight;
	bottomResizer.classList.add("dragging");
	bottomResizer.setPointerCapture(event.pointerId);

	function onMove(e: PointerEvent): void {
		const delta = startY - e.clientY;
		layoutState.bottomHeight = clamp(startHeight + delta, 120, 600);
		applyLayoutState();
		resizeTerminal();
	}
	function onUp(): void {
		bottomResizer.classList.remove("dragging");
		bottomResizer.removeEventListener("pointermove", onMove);
		bottomResizer.removeEventListener("pointerup", onUp);
		saveLayoutState();
	}
	bottomResizer.addEventListener("pointermove", onMove);
	bottomResizer.addEventListener("pointerup", onUp);
});

// Cmd+J shortcut
document.addEventListener("keydown", (event) => {
	if ((event.metaKey || event.ctrlKey) && event.key === "j") {
		event.preventDefault();
		toggleBottomPanel();
	}
});

function toggleComposerMenu(button: HTMLButtonElement, menu: HTMLElement): void {
	const nextOpen = menu.hidden;
	closeComposerMenus();
	closeSessionMenu();
	setMenuOpen(button, menu, nextOpen);
}

composerAddButton.addEventListener("mousedown", (event) => {
	event.preventDefault();
	event.stopPropagation();
	toggleComposerMenu(composerAddButton, composerAddMenu);
});

composerAddButton.addEventListener("click", (event) => {
	event.stopPropagation();
	if (event.detail === 0) {
		toggleComposerMenu(composerAddButton, composerAddMenu);
	}
});

composerModelButton.addEventListener("mousedown", (event) => {
	event.preventDefault();
	event.stopPropagation();
	toggleComposerMenu(composerModelButton, composerModelMenu);
	if (!composerModelMenu.hidden) {
		composerModelMenu.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
	}
});

composerModelButton.addEventListener("click", (event) => {
	event.stopPropagation();
	if (event.detail === 0) {
		toggleComposerMenu(composerModelButton, composerModelMenu);
		if (!composerModelMenu.hidden) {
			composerModelMenu.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
		}
	}
});

composerAddMenu.addEventListener("click", async (event) => {
	event.stopPropagation();
	const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-context-kind]");
	if (!button) return;
	const kind = button.dataset.contextKind as "files" | "folder" | "workspace";
	try {
		closeComposerMenus();
		applyContextSelections(await window.piDesktop.chooseContext(kind), { attachPathChips: kind === "files" });
	} catch (error) {
		showError(error);
	}
});

composerModelMenu.addEventListener("click", (event) => {
	event.stopPropagation();
});

sessionMenuTrigger.addEventListener("click", (event) => {
	event.stopPropagation();
	closeComposerMenus();
	closeSettingsPopover();
	setSessionMenuOpen(sessionMenu.hidden);
});

sessionMenu.addEventListener("click", (event) => {
	event.stopPropagation();
});

sessionMenuPin.addEventListener("click", () => {
	const session = activeSession();
	setSessionPinned(session, !isSessionPinned(session));
	closeSessionMenu();
});

sessionMenuRename.addEventListener("click", () => {
	showSessionRenameForm();
});

sessionMenuCopyCwd.addEventListener("click", () => {
	copySessionMenuText(sessionMenuCopyCwd, activeSession()?.cwd).catch(showError);
});

sessionMenuCopyId.addEventListener("click", () => {
	copySessionMenuText(sessionMenuCopyId, state?.sessionId || activeSession()?.id).catch(showError);
});

sessionMenuCopyLink.addEventListener("click", async () => {
	try {
		await copySessionMenuText(sessionMenuCopyLink, await window.piDesktop.getSessionDeepLink());
	} catch (error) {
		showError(error);
	}
});

sessionMenuCopyMarkdown.addEventListener("click", () => {
	copySessionMenuText(sessionMenuCopyMarkdown, conversationMarkdown()).catch(showError);
});

sessionMenuCopyDebugLog.addEventListener("click", async () => {
	try {
		await copySessionMenuText(sessionMenuCopyDebugLog, await window.piDesktop.getSessionLog());
	} catch (error) {
		showError(error);
	}
});

sessionMenuArchive.addEventListener("click", async () => {
	try {
		const session = activeSession();
		if (session) await archiveSession(session);
		closeSessionMenu();
	} catch (error) {
		showError(error);
	}
});

sessionRenameCancel.addEventListener("click", () => {
	closeSessionMenu();
});

sessionRenameForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	try {
		const nextName = sessionRenameInput.value.trim();
		if (nextName) {
			renderState(await window.piDesktop.setSessionName(nextName));
			await refreshSessions();
		}
		closeSessionMenu();
	} catch (error) {
		showError(error);
	}
});

document.addEventListener("click", (event) => {
	if (
		event.target instanceof Node &&
		(composerAddButton.contains(event.target) ||
			composerAddMenu.contains(event.target) ||
			composerModelButton.contains(event.target) ||
			composerModelMenu.contains(event.target) ||
			sessionMenuTrigger.contains(event.target) ||
			sessionMenu.contains(event.target) ||
			sidebarSettings.contains(event.target))
	) {
		return;
	}
	closeComposerMenus();
	closeSessionMenu();
	closeSettingsPopover();
});

document.addEventListener("keydown", (event) => {
	if (event.key === "Escape") {
		closeImagePreview();
		closeComposerMenus();
		closeSessionMenu();
		closeSettingsPopover();
		promptInput.focus();
	}
});

leftResizer.addEventListener("pointerdown", (event) => {
	event.preventDefault();
	beginResize("left", event.clientX, leftResizer, event.pointerId);
});

rightResizer.addEventListener("pointerdown", (event) => {
	event.preventDefault();
	beginResize("right", event.clientX, rightResizer, event.pointerId);
});

leftResizer.addEventListener("keydown", (event) => {
	handleResizeKey("left", event);
});

rightResizer.addEventListener("keydown", (event) => {
	handleResizeKey("right", event);
});

refreshGitButton.addEventListener("click", () => {
	refreshGit().catch(showError);
});

refreshSessionsButton.addEventListener("click", () => {
	refreshSessions().catch(showError);
});

settingsLogoutButton.addEventListener("click", async () => {
	try {
		closeSettingsPopover();
		const result = await window.piDesktop.logout();
		renderState(result.state);
		renderCurrentUser(undefined);
		await refreshModels();
	} catch (error) {
		showError(error);
	}
});

loginButton.addEventListener("click", async () => {
	loginButton.disabled = true;
	loginStatus.textContent = "Opening browser for Glean login...";
	try {
		const result = await window.piDesktop.login();
		renderState(result.state);
		void refreshCurrentUser();
		await refreshAfterSessionChange();
		loginStatus.textContent = "";
	} catch (error) {
		loginStatus.textContent = error instanceof Error ? error.message : String(error);
		showError(error);
	} finally {
		loginButton.disabled = false;
	}
});

window.piDesktop.onState(renderState);
window.piDesktop.onMessages(renderMessages);
window.piDesktop.onEvent((event) => {
	const typed = event as { type?: string } & DesktopToolExecutionEndEvent;
	if (typed.type === "tool_execution_end" && typed.toolCallId) {
		completedToolExecutions.set(typed.toolCallId, { isError: typed.isError === true });
		window.piDesktop.getMessages().then(renderMessages).catch(showError);
	}
	if (typed.type === "agent_end") {
		Promise.all([refreshGit(), refreshSessions()]).catch(showError);
	}
});

async function boot(): Promise<void> {
	applyLayoutState();
	syncResponsiveLayout();
	syncRightPanelContent();
	syncBottomPanelContent();
	applyTheme();
	renderState(await window.piDesktop.init());
	void refreshCurrentUser();
	await refreshAfterSessionChange();
}

boot().catch(showError);
