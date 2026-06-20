import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";

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
	queuedPrompts: DesktopQueuedPrompt[];
	permissionMode: DesktopPermissionMode;
	permissionRequests: DesktopPermissionRequest[];
	clarificationRequests: DesktopClarificationRequest[];
	messageCount: number;
	todos: DesktopTodo[];
};

type DesktopQueuedPrompt = {
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

type DesktopPermissionReply = "allowOnce" | "allowAlways" | "reject";

type DesktopTodoStatus = "pending" | "in_progress" | "completed" | "cancelled";

type DesktopTodo = {
	content: string;
	status: DesktopTodoStatus;
};

type DesktopMessage = {
	entryId?: string;
	feedback?: "positive" | "negative";
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

type OptimisticDesktopMessage = DesktopMessage & {
	baseBackendCount: number;
	optimistic: true;
	optimisticId: string;
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

type TurnWorkTrace = {
	groups: HTMLElement[];
	hasError: boolean;
	notes: HTMLElement[];
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
	isRunning?: boolean;
};

type SessionStatus = "running" | "finished";

type SessionNoticeStatus = "running" | "complete" | "error";

type SessionNotice = {
	key: string;
	text: string;
	status: SessionNoticeStatus;
};

type SessionRecoveryError = {
	path: string;
	message: string;
};

type DesktopSessionStatusEvent = {
	type: "desktop_session_status";
	path?: string;
	id?: string;
	isRunning: boolean;
};

type GitStatus = {
	isRepo: boolean;
	branch?: string;
	status: string[];
	diffStat?: string;
	additions?: number;
	deletions?: number;
	error?: string;
};

type GithubCheckState = "passed" | "pending" | "failed" | "neutral";

type GithubCheck = {
	completedAt?: string;
	detailsUrl?: string;
	name: string;
	state: GithubCheckState;
	workflow?: string;
};

type GithubPullRequestStatus =
	| { fetchedAt: string; kind: "none" | "unavailable" | "error"; message: string }
	| {
			baseRefName: string;
			checks: GithubCheck[];
			failedCount: number;
			fetchedAt: string;
			headRefName: string;
			isDraft: boolean;
			kind: "ready";
			neutralCount: number;
			number: number;
			passedCount: number;
			pendingCount: number;
			reviewDecision?: string;
			state: string;
			title: string;
			url: string;
	  };

type DesktopEnvironmentStatus = {
	git: GitStatus;
	pullRequest: GithubPullRequestStatus;
	monitoring: boolean;
};

type DiffLine = {
	newLine?: number;
	oldLine?: number;
	text: string;
	type: "context" | "add" | "delete";
};

type DiffHunk = {
	header: string;
	lines: DiffLine[];
	newLines: number;
	newStart: number;
	oldLines: number;
	oldStart: number;
};

type DiffFile = {
	additions: number;
	deletions: number;
	hunks: DiffHunk[];
	newPath: string;
	oldPath: string;
	status: "modified" | "added" | "deleted" | "renamed";
};

type ParsedDiff = {
	files: DiffFile[];
	totalAdditions: number;
	totalDeletions: number;
};

type ReviewCommentAnchor = {
	filePath: string;
	side: "old" | "new";
	startOldLine?: number;
	startNewLine?: number;
	endOldLine?: number;
	endNewLine?: number;
};

type ReviewDraftComment = ReviewCommentAnchor & {
	id: string;
	body: string;
	status: "draft";
	createdAt: number;
};

type DesktopLogoutResult = {
	state: DesktopState;
	message: string;
};

type DesktopLoginResult = {
	state: DesktopState;
	message: string;
};

type DesktopExportSessionResult = { canceled: true } | { canceled: false; filePath: string };

type DesktopCurrentUser = {
	name?: string;
	email?: string;
	photoUrl?: string;
	endpoint?: string;
};

type DesktopGleanAuth = {
	endpoint: string;
	accessToken: string;
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
	getGleanAuth(): Promise<DesktopGleanAuth | undefined>;
	getMessages(): Promise<DesktopMessage[]>;
	getSessionLog(): Promise<string>;
	getSessionDeepLink(): Promise<string>;
	exportSession(): Promise<DesktopExportSessionResult>;
	showItemInFolder(filePath: string): Promise<void>;
	listSessions(): Promise<DesktopSessionInfo[]>;
	newSession(): Promise<DesktopState>;
	switchSession(sessionPath: string): Promise<DesktopState>;
	forkSession(entryId: string): Promise<DesktopState>;
	setResponseFeedback(entryId: string, rating: "positive" | "negative" | null): Promise<DesktopMessage[]>;
	prompt(
		message: string | { text: string; images?: Array<{ type: "image"; data: string; mimeType: string }> },
	): Promise<DesktopState>;
	queuePrompt(
		message: string | { text: string; images?: Array<{ type: "image"; data: string; mimeType: string }> },
	): Promise<DesktopState>;
	steerPrompt(
		message: string | { text: string; images?: Array<{ type: "image"; data: string; mimeType: string }> },
	): Promise<DesktopState>;
	takeQueuedPrompt(id: string): Promise<{
		state: DesktopState;
		prompt?: {
			text: string;
			images?: Array<{ type: "image"; data: string; mimeType: string }>;
		};
	}>;
	steerQueuedPrompt(id: string): Promise<DesktopState>;
	resolveClarification(id: string, answer: string): Promise<DesktopState>;
	rejectClarification(id: string): Promise<DesktopState>;
	createTempTextFile(text: string): Promise<Extract<DesktopContextSelection, { type: "path" }>>;
	setPermissionMode(mode: DesktopPermissionMode): Promise<DesktopState>;
	resolvePermission(id: string, reply: DesktopPermissionReply): Promise<DesktopState>;
	abort(): Promise<DesktopState>;
	chooseContext(kind: "files" | "folder" | "workspace"): Promise<DesktopContextSelection[]>;
	setCwd(cwd: string): Promise<DesktopState>;
	listModels(): Promise<DesktopModel[]>;
	setModel(provider: string, id: string): Promise<DesktopState>;
	setThinkingLevel(level: string): Promise<DesktopState>;
	compact(customInstructions?: string): Promise<DesktopState>;
	setSessionName(name: string): Promise<DesktopState>;
	reloadSession(): Promise<DesktopState>;
	login(): Promise<DesktopLoginResult>;
	logout(): Promise<DesktopLogoutResult>;
	quit(): Promise<void>;
	gitStatus(): Promise<GitStatus>;
	environmentStatus(): Promise<DesktopEnvironmentStatus>;
	setPrMonitor(enabled: boolean): Promise<DesktopEnvironmentStatus>;
	fixPrChecks(): Promise<DesktopEnvironmentStatus>;
	getDiff(scope?: "working-tree" | "staged" | "last-turn", context?: number): Promise<ParsedDiff>;
	terminalCreate(terminalId?: string): Promise<void>;
	terminalWrite(terminalId: string, data: string): void;
	terminalResize(terminalId: string, cols: number, rows: number): void;
	terminalDestroy(terminalId?: string): Promise<void>;
	terminalDestroyAll(): void;
	terminalFocus(terminalId: string, focused: boolean): void;
	onTerminalData(handler: (terminalId: string, data: string) => void): () => void;
	onTerminalZoom(handler: (terminalId: string, delta: number) => void): () => void;
	onEnvironmentStatus(handler: (status: DesktopEnvironmentStatus) => void): () => void;
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
const startupLoading = document.querySelector<HTMLDivElement>("#startup-loading")!;
const terminalContainer = document.querySelector<HTMLDivElement>("#terminal-container")!;
const rightTerminalContainer = document.querySelector<HTMLDivElement>("#right-terminal-container")!;
const terminalCloseButton = document.querySelector<HTMLButtonElement>("#terminal-close")!;
const rightPanelTabs = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-right-panel-tab]"));
const rightPanelPanes = Array.from(document.querySelectorAll<HTMLElement>("[data-right-panel-pane]"));
const bottomPanelTabs = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-bottom-panel-tab]"));
const bottomPanelPanes = Array.from(document.querySelectorAll<HTMLElement>("[data-bottom-panel-pane]"));
const browserHomeUrl = "https://app.glean.com";
const browserHomeButton = document.querySelector<HTMLButtonElement>("#browser-home")!;
const browserUrlInput = document.querySelector<HTMLInputElement>("#browser-url")!;
const browserGoButton = document.querySelector<HTMLButtonElement>("#browser-go")!;
const browserFrame = document.querySelector<HTMLElement>("#browser-frame")!;
const bottomBrowserBar = document.querySelector<HTMLDivElement>(".bottom-browser-bar")!;
const bottomBrowserHomeButton = document.querySelector<HTMLButtonElement>("#bottom-browser-home")!;
const bottomBrowserUrlInput = document.querySelector<HTMLInputElement>("#bottom-browser-url")!;
const bottomBrowserGoButton = document.querySelector<HTMLButtonElement>("#bottom-browser-go")!;
const bottomBrowserFrame = document.querySelector<HTMLElement>("#bottom-browser-frame")!;
const bottomResizer = document.querySelector<HTMLDivElement>("#bottom-resizer")!;
const leftResizer = document.querySelector<HTMLDivElement>("#left-resizer")!;
const rightResizer = document.querySelector<HTMLDivElement>("#right-resizer")!;
const refreshSessionsButton = document.querySelector<HTMLButtonElement>("#refresh-sessions")!;
const addProjectButton = document.querySelector<HTMLButtonElement>("#add-project")!;
const settingsLogoutButton = document.querySelector<HTMLButtonElement>("#settings-logout")!;
const sessionList = document.querySelector<HTMLDivElement>("#session-list")!;
const sessionSearchInput = document.querySelector<HTMLInputElement>("#session-search")!;
const modelSelect = document.querySelector<HTMLSelectElement>("#model-select")!;
const modelMeta = document.querySelector<HTMLDivElement>("#model-meta")!;
const themeSelect = document.querySelector<HTMLSelectElement>("#theme-select")!;
const gitBranch = document.querySelector<HTMLDivElement>("#git-branch")!;
const gitStatus = document.querySelector<HTMLDivElement>("#git-status")!;
const refreshGitButton = document.querySelector<HTMLButtonElement>("#refresh-git")!;
const toggleEnvironmentCardButton = document.querySelector<HTMLButtonElement>("#toggle-environment-card")!;
const refreshEnvironmentButton = document.querySelector<HTMLButtonElement>("#refresh-environment")!;
const environmentPopover = document.querySelector<HTMLElement>("#environment-popover")!;
const environmentContent = document.querySelector<HTMLDivElement>("#environment-content")!;
const environmentTabIndicator = document.querySelector<HTMLSpanElement>("#environment-tab-indicator")!;
const refreshReviewButton = document.querySelector<HTMLButtonElement>("#refresh-review")!;
const reviewContent = document.querySelector<HTMLDivElement>("#review-content")!;
const reviewStats = document.querySelector<HTMLSpanElement>("#review-stats")!;
const reviewScopeSelect = document.querySelector<HTMLSelectElement>("#review-scope")!;
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
const composerHint = document.querySelector<HTMLSpanElement>("#composer-hint")!;
const composerContextUsageButton = document.querySelector<HTMLButtonElement>("#composer-context-usage")!;
const composerContextUsageMenu = document.querySelector<HTMLDivElement>("#composer-context-usage-menu")!;
const composerContextUsageValue = document.querySelector<HTMLDivElement>("#composer-context-usage-value")!;
const composerCompactContext = document.querySelector<HTMLButtonElement>("#composer-compact-context")!;
const composerModelButton = document.querySelector<HTMLButtonElement>("#composer-model")!;
const composerModelMenu = document.querySelector<HTMLDivElement>("#composer-model-menu")!;
const composerPermissionButton = document.querySelector<HTMLButtonElement>("#composer-permission-mode")!;
const composerPermissionLabel = document.querySelector<HTMLSpanElement>("#composer-permission-label")!;
const composerPermissionMenu = document.querySelector<HTMLDivElement>("#composer-permission-menu")!;
const composerContext = document.querySelector<HTMLDivElement>("#composer-context")!;
const composerWorkspaceButton = document.querySelector<HTMLButtonElement>("#composer-workspace")!;
const composerWorkspaceName = document.querySelector<HTMLSpanElement>("#composer-workspace-name")!;
const composerBranchName = document.querySelector<HTMLSpanElement>("#composer-branch-name")!;
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
const queuedPromptList = document.createElement("div");
queuedPromptList.className = "queued-prompts";
queuedPromptList.hidden = true;
promptInput.before(queuedPromptList);
const clarificationRequestList = document.createElement("div");
clarificationRequestList.className = "clarification-requests";
clarificationRequestList.hidden = true;
queuedPromptList.before(clarificationRequestList);
const permissionRequestList = document.createElement("div");
permissionRequestList.className = "permission-requests";
permissionRequestList.hidden = true;
clarificationRequestList.before(permissionRequestList);
const reviewCommentsBadge = document.createElement("div");
reviewCommentsBadge.id = "review-comments-badge";
reviewCommentsBadge.className = "review-comments-badge";
reviewCommentsBadge.hidden = true;
promptInput.before(reviewCommentsBadge);
const imagePreviewOverlay = document.createElement("div");
imagePreviewOverlay.className = "image-preview-overlay";
imagePreviewOverlay.hidden = true;
document.body.append(imagePreviewOverlay);

let state: DesktopState | undefined;
let models: DesktopModel[] = [];
let sessions: DesktopSessionInfo[] = [];
let backendMessages: DesktopMessage[] = [];
let currentMessages: DesktopMessage[] = [];
let optimisticUserMessages: OptimisticDesktopMessage[] = [];
let composerImages: ComposerImageAttachment[] = [];
let composerFiles: ComposerFileAttachment[] = [];
let switchingSessionPath: string | undefined;
let renderedSessionId: string | undefined;
let isEditingSessionTitle = false;
let reviewComments: ReviewDraftComment[] = [];
let reviewDiffData: ParsedDiff | undefined;
let activeCommentAnchor: ReviewCommentAnchor | undefined;
let rangeSelectStart: { filePath: string; oldLine?: number; newLine?: number; side: "old" | "new" } | undefined;
const clarificationDraftsById = new Map<string, string>();
const completedToolExecutions = new Map<string, { isError: boolean }>();
const toolStackOpenStateByKey = new Map<string, boolean>();
const expandedTurnWorkKeys = new Set<string>();
const sessionStatusByKey = new Map<string, SessionStatus>();
const sessionNoticesBySessionId = new Map<string, SessionNotice[]>();
const activeToolExecutions = new Set<string>();
const diffLineMetadata = new WeakMap<HTMLElement, { file: DiffFile; line: DiffLine }>();
let visibleMessageLimit = 120;
let shouldFollowMessages = true;
let renderedStableMessageSignature = "";
let renderedFirstVisibleIndex = 0;
let renderedMessageCount = 0;
let selectedSlashCommandIndex = 0;
let isComposerBusy = false;
let isAbortingRun = false;
let sessionRecoveryError: SessionRecoveryError | undefined;
let activeAgentRun = false;
const messagePageSize = 120;
const projectSessionPageSize = 5;
const projectSessionLimits = new Map<string, number>();
const collapsedProjects = new Set<string>(JSON.parse(localStorage.getItem("pi-collapsed-projects") || "[]"));
const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
const themeStorageKey = "pi-desktop-theme";
const layoutStorageKey = "pi-desktop-layout";
const pinnedSessionsStorageKey = "pi-pinned-sessions";
const archivedSessionsStorageKey = "pi-archived-sessions";
const pastedTextFileThreshold = 24_000;
const pinnedSessionKeys = new Set<string>(JSON.parse(localStorage.getItem(pinnedSessionsStorageKey) || "[]"));
const archivedSessionKeys = new Set<string>(JSON.parse(localStorage.getItem(archivedSessionsStorageKey) || "[]"));
let showArchivedSessions = false;
let loadedLayoutCwd: string | undefined;
const minLeftPanelWidth = 340;
const maxLeftPanelWidth = 520;
const minRightPanelWidth = 240;
const maxRightPanelWidth = 560;
const autoCollapseLeftWidth = 1040;
const autoExpandLeftWidth = 1140;

type ThemePreference = "system" | "light" | "dark";

type WindowPanelTab = "terminal" | "browser";
type RightPanelTab = "inspector" | "review" | WindowPanelTab;

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
	return value === "inspector" || value === "review" || isWindowPanelTab(value);
}

function projectLayoutStorageKey(cwd: string): string {
	return `${layoutStorageKey}:${cwd}`;
}

function loadLayoutState(storageKey = layoutStorageKey): LayoutState {
	try {
		const parsed = JSON.parse(
			localStorage.getItem(storageKey) ?? localStorage.getItem(layoutStorageKey) ?? "{}",
		) as Partial<LayoutState>;
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
	const storageKey = state?.cwd ? projectLayoutStorageKey(state.cwd) : layoutStorageKey;
	localStorage.setItem(storageKey, JSON.stringify(layoutState));
}

function restoreProjectLayout(cwd: string | undefined): void {
	if (!cwd || loadedLayoutCwd === cwd) return;
	loadedLayoutCwd = cwd;
	Object.assign(layoutState, loadLayoutState(projectLayoutStorageKey(cwd)));
	applyLayoutState();
	syncRightPanelContent();
	syncBottomPanelContent();
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

function setEnvironmentPopoverOpen(open: boolean): void {
	environmentPopover.hidden = !open;
	toggleEnvironmentCardButton.setAttribute("aria-expanded", String(open));
	if (open) refreshEnvironment().catch(showError);
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

function reasoningDisplay(level: string | undefined): string {
	return (
		{
			off: "off",
			minimal: "minimal",
			low: "low",
			medium: "medium",
			high: "high",
			xhigh: "extra high",
			"extra-high": "extra high",
		}[level ?? "off"] ??
		level ??
		"off"
	);
}

function modelDisplay(state: DesktopState): string {
	if (!state.model) return "No model selected";
	return `${state.model.id} · ${reasoningDisplay(state.thinkingLevel)}`;
}

function renderComposerContext(git?: GitStatus): void {
	if (!state || state.authRequired) {
		composerContext.hidden = true;
		return;
	}
	composerContext.hidden = false;
	composerWorkspaceName.textContent = basename(state.cwd);
	composerWorkspaceButton.title = state.cwd;
	const branch = git?.isRepo ? git.branch || "detached" : "No git branch";
	composerBranchName.textContent = branch;
	composerBranchName.title = branch;
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

function normalizePhotoUrl(photoUrl: string | undefined, endpoint: string): string | undefined {
	if (!photoUrl) return undefined;
	return photoUrl.startsWith("/") ? new URL(photoUrl, endpoint).href : photoUrl;
}

async function fetchImageDataUrl(url: string, endpoint: string, accessToken: string): Promise<string> {
	if (!url || url.startsWith("data:")) return url;
	const imageUrl = new URL(url);
	const endpointUrl = new URL(endpoint);
	const headers = imageUrl.origin === endpointUrl.origin ? { Authorization: `Bearer ${accessToken}` } : undefined;
	const response = await fetch(imageUrl.href, { headers });
	if (!response.ok) throw new Error(`Avatar fetch failed (${response.status})`);
	const blob = await response.blob();
	if (!blob.type.startsWith("image/")) throw new Error(`Avatar response is not an image (${blob.type || "unknown"})`);
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ""));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

async function fetchCurrentUserInRenderer(): Promise<DesktopCurrentUser | undefined> {
	const auth = await window.piDesktop.getGleanAuth();
	if (!auth?.endpoint || !auth?.accessToken) return undefined;
	const response = await fetch(`${auth.endpoint}/api/v1/people?clientVersion=desktop-cowork`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${auth.accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ includeFields: ["PEOPLE_DETAILS", "PEOPLE_PROFILE_SETTINGS"] }),
	});
	if (!response.ok) throw new Error(`User fetch failed (${response.status})`);
	const result = (await response.json()) as {
		results?: Array<{ name?: unknown; metadata?: Record<string, unknown> }>;
	};
	const person = result.results?.[0];
	const metadata = person?.metadata ?? {};
	const rawPhotoUrl =
		typeof metadata.photoUrl === "string"
			? metadata.photoUrl
			: typeof metadata.uneditedPhotoUrl === "string"
				? metadata.uneditedPhotoUrl
				: undefined;
	const photoUrl = normalizePhotoUrl(rawPhotoUrl, auth.endpoint);
	return {
		endpoint: auth.endpoint,
		name:
			(typeof person?.name === "string" ? person.name : undefined) ??
			[metadata.firstName, metadata.lastName].filter((value) => typeof value === "string" && value).join(" "),
		email: typeof metadata.email === "string" ? metadata.email : undefined,
		photoUrl: photoUrl
			? await fetchImageDataUrl(photoUrl, auth.endpoint, auth.accessToken).catch(() => photoUrl)
			: undefined,
	};
}

async function refreshCurrentUser(): Promise<void> {
	try {
		renderCurrentUser(await fetchCurrentUserInRenderer());
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
	setMenuOpen(composerContextUsageButton, composerContextUsageMenu, false);
	setMenuOpen(composerModelButton, composerModelMenu, false);
	setMenuOpen(composerPermissionButton, composerPermissionMenu, false);
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
			upsertSessionNotice("compaction", "Preparing more context · compacting...", "running");
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
	focusComposer();
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
	try {
		await command.run(rawArgs.trim());
	} catch (error) {
		showError(error);
	} finally {
		setBusy(isRunActive());
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

function forceFollowMessagesToBottom(): void {
	shouldFollowMessages = true;
	scrollMessagesToBottom();
	requestAnimationFrame(scrollMessagesToBottom);
	setTimeout(scrollMessagesToBottom, 0);
}

function keepMessagesPinnedAfterComposerResize(): void {
	if (!shouldFollowMessages) return;
	requestAnimationFrame(scrollMessagesToBottom);
	setTimeout(scrollMessagesToBottom, 0);
}

function isRunActive(nextState = state): boolean {
	return Boolean(
		activeAgentRun ||
			activeToolExecutions.size > 0 ||
			nextState?.isStreaming ||
			(nextState?.pendingMessageCount ?? 0) > 0,
	);
}

function syncComposerHint(): void {
	composerHint.textContent = isComposerBusy
		? "Enter queues next · ⌘ Enter steers current run"
		: "Enter to send · Shift Enter newline";
}

function setBusy(isBusy: boolean): void {
	isComposerBusy = isBusy;
	sendButton.setAttribute("aria-label", isBusy ? "Stop" : "Send");
	sendButton.title = isBusy ? "Stop" : "Send";
	sendButton.innerHTML = isBusy ? sendButtonStopIcon : sendButtonSendIcon;
	runState.textContent = isBusy ? "Running" : "Idle";
	runState.className = `run-state ${isBusy ? "running" : "idle"}`;
	syncComposerHint();
	if (!isBusy) hideStreamingIndicator();
	composerCompactContext.disabled = isBusy || (state?.messageCount ?? 0) < 2;
	syncSendButtonState();
}

function showStreamingIndicator(): void {
	if (messagesEl.querySelector(".streaming-indicator")) return;
	const indicator = document.createElement("div");
	indicator.className = "streaming-indicator";
	indicator.id = "streaming-indicator";
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

function syncStreamingIndicator(): void {
	const lastMessage = currentMessages.at(-1);
	const assistantHasContent =
		lastMessage?.role === "assistant" &&
		Boolean(contentText(lastMessage).trim() || lastMessage.content.length > 0 || lastMessage.toolCalls?.length);
	if (!isComposerBusy || activeToolExecutions.size > 0 || assistantHasContent) {
		hideStreamingIndicator();
		return;
	}
	showStreamingIndicator();
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

function isSupportedLinkHref(href: string): boolean {
	return /^(?:https?|file):\/\//i.test(href);
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
		} else if (isSupportedLinkHref(raw)) {
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
			if (isSupportedLinkHref(href)) {
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

function imageBlocksForMessage(message: DesktopMessage): Array<Extract<DesktopContent, { type: "image" }>> {
	return (message.content ?? []).filter(
		(block): block is Extract<DesktopContent, { type: "image" }> => block.type === "image",
	);
}

function optimisticMessageMatches(
	candidate: DesktopMessage,
	candidateIndex: number,
	optimistic: OptimisticDesktopMessage,
): boolean {
	if (candidateIndex < optimistic.baseBackendCount || candidate.role !== "user") return false;
	if (contentText(candidate) !== contentText(optimistic)) return false;
	const candidateImages = imageBlocksForMessage(candidate);
	const optimisticImages = imageBlocksForMessage(optimistic);
	if (candidateImages.length !== optimisticImages.length) return false;
	return optimisticImages.every((image, index) => {
		const candidateImage = candidateImages[index];
		return candidateImage?.mimeType === image.mimeType && candidateImage?.data === image.data;
	});
}

function messagesWithOptimisticUserMessages(messages: DesktopMessage[]): DesktopMessage[] {
	if (optimisticUserMessages.length === 0) return messages;
	const pending = optimisticUserMessages.filter(
		(optimistic) => !messages.some((message, index) => optimisticMessageMatches(message, index, optimistic)),
	);
	if (pending.length !== optimisticUserMessages.length) optimisticUserMessages = pending;
	return pending.length === 0 ? messages : [...messages, ...pending];
}

function removeOptimisticUserMessage(id: string): void {
	const previousLength = optimisticUserMessages.length;
	optimisticUserMessages = optimisticUserMessages.filter((message) => message.optimisticId !== id);
	if (optimisticUserMessages.length !== previousLength) renderMessages(backendMessages);
}

function appendOptimisticUserMessage(
	text: string,
	images: Array<{ type: "image"; data: string; mimeType: string }>,
): string {
	const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	shouldFollowMessages = true;
	optimisticUserMessages.push({
		role: "user",
		text,
		content: [
			...(text ? [{ type: "text" as const, text }] : []),
			...images.map((image) => ({ type: "image" as const, data: image.data, mimeType: image.mimeType })),
		],
		timestamp: Date.now(),
		optimistic: true,
		optimisticId: id,
		baseBackendCount: backendMessages.length,
	});
	renderMessages(backendMessages);
	forceFollowMessagesToBottom();
	return id;
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

function toolDescription(call: DesktopToolCall): string {
	const input = call.input;
	if (!input || typeof input !== "object" || Array.isArray(input)) return "";
	const record = input as Record<string, unknown>;
	const value =
		record.path ??
		record.file_path ??
		record.command ??
		record.pattern ??
		record.query ??
		record.description ??
		record.prompt;
	if (typeof value !== "string") return "";
	const normalized = value.replace(/\s+/g, " ").trim();
	return normalized.length > 92 ? `${normalized.slice(0, 89)}...` : normalized;
}

function renderToolOutput(result: DesktopMessage): HTMLElement | undefined {
	const output = contentText(result);
	if (!output) return undefined;
	const pre = document.createElement("pre");
	pre.className = "tool-result-body";
	const code = document.createElement("code");
	code.textContent = output;
	pre.append(code);
	return pre;
}

function createAssistantMessageActions(message: DesktopMessage): HTMLElement {
	const footer = document.createElement("div");
	footer.className = "message-actions";
	const copyText = contentText(message).trim();
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
	if (message.entryId) {
		const feedbackButtons: HTMLButtonElement[] = [];
		for (const [rating, label] of [
			["positive", "Good response"],
			["negative", "Bad response"],
		] as const) {
			const feedbackButton = document.createElement("button");
			feedbackButton.type = "button";
			feedbackButton.className = `message-action-btn feedback-${rating}`;
			feedbackButton.classList.toggle("active", message.feedback === rating);
			feedbackButton.title = label;
			feedbackButton.setAttribute("aria-label", label);
			feedbackButton.setAttribute("aria-pressed", String(message.feedback === rating));
			feedbackButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11M15 5.9 14 10h5.8a2 2 0 0 1 1.9 2.6l-2.3 7A2 2 0 0 1 17.5 21H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h2.8a2 2 0 0 0 1.8-1.1L12 2a3.1 3.1 0 0 1 3 3.9Z"></path></svg>`;
			feedbackButton.addEventListener("click", async () => {
				const nextRating = message.feedback === rating ? null : rating;
				for (const button of feedbackButtons) button.disabled = true;
				try {
					renderMessages(await window.piDesktop.setResponseFeedback(message.entryId!, nextRating));
				} catch (error) {
					showError(error);
					for (const button of feedbackButtons) button.disabled = false;
				}
			});
			feedbackButtons.push(feedbackButton);
			footer.append(feedbackButton);
		}

		const forkButton = document.createElement("button");
		forkButton.type = "button";
		forkButton.className = "message-action-btn";
		forkButton.title = "Branch in new chat";
		forkButton.setAttribute("aria-label", "Branch in new chat from this response");
		forkButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2.5"></circle><circle cx="18" cy="5" r="2.5"></circle><circle cx="12" cy="19" r="2.5"></circle><path d="M6 7.5v2A6.5 6.5 0 0 0 12 16v.5M18 7.5v2A6.5 6.5 0 0 1 12 16"></path></svg>`;
		forkButton.addEventListener("click", async () => {
			if (forkButton.disabled) return;
			forkButton.disabled = true;
			forkButton.classList.add("loading");
			forkButton.title = "Creating branch...";
			try {
				renderState(await window.piDesktop.forkSession(message.entryId!));
				shouldFollowMessages = true;
				visibleMessageLimit = messagePageSize;
				await refreshAfterSessionChange();
				focusComposer();
			} catch (error) {
				forkButton.disabled = false;
				forkButton.classList.remove("loading");
				forkButton.title = "Branch in new chat";
				showError(error);
			}
		});
		footer.append(forkButton);
	}
	return footer;
}

function createMessage(message: DesktopMessage, showAssistantActions = false): HTMLElement {
	const row = document.createElement("article");
	row.className = `message ${message.role}`;
	row.classList.toggle("optimistic", (message as Partial<OptimisticDesktopMessage>).optimistic === true);

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
			model.textContent = `${state.model.id} · ${reasoningDisplay(state.thinkingLevel)}`;
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
	if (showAssistantActions && message.role === "assistant" && contentText(message).trim()) {
		row.append(createAssistantMessageActions(message));
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
	details.dataset.toolCallId = call.id;

	const summary = document.createElement("summary");
	const title = document.createElement("span");
	title.className = "tool-title";
	const name = document.createElement("span");
	name.className = "tool-name";
	name.textContent = formatToolLabel(call.name);
	title.append(name);
	const description = toolDescription(call);
	if (description) {
		const detail = document.createElement("span");
		detail.className = "tool-description";
		detail.textContent = description;
		detail.title = description;
		title.append(detail);
	}
	const stateLabel = document.createElement("span");
	stateLabel.className = "tool-state";
	stateLabel.textContent = toolStateLabel(result, execution);
	details.dataset.toolState = stateLabel.textContent.toLowerCase();
	summary.append(title, stateLabel);
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
		const output = renderToolOutput(result);
		if (output) details.append(output);
	}
	details.dataset.toolSignature = JSON.stringify([
		call.id,
		call.name,
		input,
		details.dataset.toolState,
		result?.isError,
		result ? contentText(result) : undefined,
		execution?.isError,
	]);
	return details;
}

function toolStackKey(groups: HTMLElement[]): string {
	return (
		groups[0]?.dataset.toolCallId ||
		groups
			.map((group) => group.dataset.toolCallId)
			.filter(Boolean)
			.join("|")
	);
}

function createTurnWorkNote(message: DesktopMessage): HTMLElement {
	const note = document.createElement("div");
	note.className = "turn-work-note";
	note.append(renderContent(message));
	return note;
}

function createCollapsedToolStack(groups: HTMLElement[], hasError: boolean): HTMLElement {
	const details = document.createElement("details");
	details.className = `tool-stack-group ${hasError ? "error" : ""}`;
	const key = toolStackKey(groups);
	if (key) {
		details.dataset.toolStackKey = key;
		const rememberedOpen = toolStackOpenStateByKey.get(key);
		if (typeof rememberedOpen === "boolean") details.open = rememberedOpen;
	}
	const summary = document.createElement("summary");
	const name = document.createElement("span");
	name.className = "tool-name";
	name.textContent = `${groups.length} tool call${groups.length === 1 ? "" : "s"}`;
	const failedCount = groups.filter((group) => group.dataset.toolState === "failed").length;
	const completedCount = groups.filter((group) => group.dataset.toolState === "completed").length;
	const runningCount = groups.filter((group) => group.dataset.toolState === "running").length;
	const stateLabel = document.createElement("span");
	stateLabel.className = "tool-state";
	if (runningCount > 0) {
		details.dataset.toolState = "running";
		const running = document.createElement("span");
		running.className = "tool-stat-running";
		running.textContent = `${runningCount} running`;
		const completed = document.createElement("span");
		completed.className = "tool-stat-completed";
		completed.textContent = `${completedCount} completed`;
		stateLabel.append(running, document.createTextNode(" · "), completed);
		if (failedCount > 0) {
			const failed = document.createElement("span");
			failed.className = "tool-stat-failed";
			failed.textContent = `${failedCount} failed`;
			stateLabel.append(document.createTextNode(" · "), failed);
		}
	} else if (failedCount > 0) {
		details.dataset.toolState = "failed";
		const completed = document.createElement("span");
		completed.className = "tool-stat-completed";
		completed.textContent = `${completedCount} completed`;
		const failed = document.createElement("span");
		failed.className = "tool-stat-failed";
		failed.textContent = `${failedCount} failed`;
		stateLabel.append(completed, document.createTextNode(" · "), failed);
	} else {
		details.dataset.toolState = "completed";
		stateLabel.textContent = "Completed";
	}
	details.dataset.toolStackSignature = JSON.stringify(groups.map((group) => group.dataset.toolSignature ?? ""));
	summary.append(name, stateLabel);
	const body = document.createElement("div");
	body.className = "tool-stack-group-body";
	body.append(...groups);
	details.append(summary, body);
	details.addEventListener("toggle", () => {
		if (key) toolStackOpenStateByKey.set(key, details.open);
	});
	return details;
}

function buildToolGroupsForMessage(
	message: DesktopMessage,
	index: number,
	messages: DesktopMessage[],
	compactCompleted = false,
): { groups: HTMLElement[]; hasError: boolean; hasIncompleteTool: boolean } {
	const groups: HTMLElement[] = [];
	let hasIncompleteTool = false;
	let hasError = false;
	for (const call of message.toolCalls ?? []) {
		const resultIndex = messages.findIndex((candidate, candidateIndex) => {
			return candidateIndex > index && candidate.role === "toolResult" && candidate.toolCallId === call.id;
		});
		const result = resultIndex === -1 ? undefined : messages[resultIndex];
		const hasNewerMessages = resultIndex !== -1 && resultIndex < messages.length - 1;
		const execution = result ? undefined : completedToolExecutions.get(call.id);
		hasIncompleteTool ||= !result && !execution;
		hasError ||= result?.isError === true || execution?.isError === true;
		groups.push(createToolGroup(call, result, execution, hasNewerMessages || Boolean(execution) || compactCompleted));
	}
	return { groups, hasError, hasIncompleteTool };
}

function renderToolStackForMessage(
	message: DesktopMessage,
	index: number,
	messages: DesktopMessage[],
	compactCompleted = false,
): HTMLElement | undefined {
	if (!message.toolCalls?.length) return undefined;
	const tools = document.createElement("div");
	tools.className = "tool-stack";
	const { groups, hasError, hasIncompleteTool } = buildToolGroupsForMessage(
		message,
		index,
		messages,
		compactCompleted,
	);
	if (compactCompleted && groups.length > 1 && !hasIncompleteTool) {
		tools.append(createCollapsedToolStack(groups, hasError));
	} else {
		tools.append(...groups);
	}
	return tools;
}

function lastUserMessageIndex(messages: DesktopMessage[]): number {
	for (let index = messages.length - 1; index >= 0; index--) {
		if (messages[index]?.role === "user") return index;
	}
	return -1;
}

function shouldCompactToolMessage(index: number, isActivelyStreaming: boolean, messages: DesktopMessage[]): boolean {
	return !isActivelyStreaming && (!isComposerBusy || index < lastUserMessageIndex(messages));
}

function isIntermediateToolMessage(message: DesktopMessage): boolean {
	return message.role === "assistant" && Boolean(message.toolCalls?.length) && !contentText(message).trim();
}

function createCompletedTurnWorkTraces(
	messages: DesktopMessage[],
	firstVisibleIndex: number,
): {
	skippedIndexes: Set<number>;
	tracedToolIndexes: Set<number>;
	tracesByFinalIndex: Map<number, TurnWorkTrace>;
} {
	const tracesByFinalIndex = new Map<number, TurnWorkTrace>();
	const skippedIndexes = new Set<number>();
	const tracedToolIndexes = new Set<number>();
	for (let segmentStart = 0; segmentStart < messages.length; ) {
		const userIndex = messages.findIndex((message, index) => index >= segmentStart && message.role === "user");
		if (userIndex === -1) break;
		const nextUserIndex = messages.findIndex((message, index) => index > userIndex && message.role === "user");
		const segmentEnd = nextUserIndex === -1 ? messages.length : nextUserIndex;
		if (isComposerBusy && nextUserIndex === -1) break;
		let finalAssistantIndex = -1;
		for (let index = userIndex + 1; index < segmentEnd; index++) {
			const message = messages[index]!;
			if (message.role === "assistant" && contentText(message).trim() && Number.isFinite(message.timestamp)) {
				finalAssistantIndex = index;
			}
		}
		const completionIndex = finalAssistantIndex === -1 ? nextUserIndex : finalAssistantIndex;
		const userTimestamp = messages[userIndex]?.timestamp;
		const segmentTimestamps = messages
			.slice(userIndex + 1, segmentEnd)
			.map((message) => message.timestamp)
			.filter((timestamp): timestamp is number => Number.isFinite(timestamp));
		const lastTurnTimestamp = segmentTimestamps.length > 0 ? Math.max(...segmentTimestamps) : undefined;
		const hasDuration =
			completionIndex >= firstVisibleIndex &&
			Number.isFinite(userTimestamp) &&
			Number.isFinite(lastTurnTimestamp) &&
			lastTurnTimestamp - userTimestamp >= 1_000;
		if (hasDuration) {
			const groups: HTMLElement[] = [];
			const notes: HTMLElement[] = [];
			const candidateToolIndexes: number[] = [];
			const candidateSkippedIndexes: number[] = [];
			let hasError = false;
			let hasIncompleteTool = false;
			for (let index = userIndex + 1; index < segmentEnd; index++) {
				if (index < firstVisibleIndex) continue;
				const message = messages[index]!;
				if (message.role !== "assistant") continue;
				const isFinalAssistant = index === finalAssistantIndex;
				if (!isFinalAssistant && contentText(message).trim()) {
					notes.push(createTurnWorkNote(message));
					candidateSkippedIndexes.push(index);
				}
				if (message.toolCalls?.length) {
					const built = buildToolGroupsForMessage(message, index, messages, true);
					groups.push(...built.groups);
					hasError ||= built.hasError;
					hasIncompleteTool ||= built.hasIncompleteTool;
					candidateToolIndexes.push(index);
				}
				if (!isFinalAssistant && isIntermediateToolMessage(message)) candidateSkippedIndexes.push(index);
			}
			if ((groups.length > 0 || notes.length > 0) && !hasIncompleteTool) {
				tracesByFinalIndex.set(completionIndex, { groups, hasError, notes });
				for (const index of candidateToolIndexes) tracedToolIndexes.add(index);
				for (const index of candidateSkippedIndexes) skippedIndexes.add(index);
			}
		}
		segmentStart = segmentEnd;
	}
	return { skippedIndexes, tracedToolIndexes, tracesByFinalIndex };
}

function formatRunDuration(durationMs: number): string {
	const totalSeconds = Math.max(1, Math.round(durationMs / 1_000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes === 0) return `${seconds}s`;
	if (seconds === 0) return `${minutes}m`;
	return `${minutes}m ${seconds}s`;
}

function completedTurnDurations(messages: DesktopMessage[]): Map<number, number> {
	const durations = new Map<number, number>();
	for (let userIndex = 0; userIndex < messages.length; userIndex++) {
		const userMessage = messages[userIndex]!;
		const userTimestamp = userMessage.timestamp;
		if (userMessage.role !== "user" || !Number.isFinite(userTimestamp)) continue;
		const nextUserIndex = messages.findIndex((message, index) => index > userIndex && message.role === "user");
		const segmentEnd = nextUserIndex === -1 ? messages.length : nextUserIndex;
		if (isComposerBusy && nextUserIndex === -1) continue;
		let finalAssistantIndex = -1;
		for (let index = userIndex + 1; index < segmentEnd; index++) {
			const message = messages[index]!;
			if (message.role === "assistant" && contentText(message).trim() && Number.isFinite(message.timestamp)) {
				finalAssistantIndex = index;
			}
		}
		const completionIndex = finalAssistantIndex === -1 ? nextUserIndex : finalAssistantIndex;
		if (completionIndex === -1) continue;
		const segmentTimestamps = messages
			.slice(userIndex + 1, segmentEnd)
			.map((message) => message.timestamp)
			.filter((timestamp): timestamp is number => Number.isFinite(timestamp));
		const lastTurnTimestamp = segmentTimestamps.length > 0 ? Math.max(...segmentTimestamps) : undefined;
		if (!Number.isFinite(lastTurnTimestamp)) continue;
		const duration = lastTurnTimestamp - userTimestamp;
		if (duration >= 1_000) durations.set(completionIndex, duration);
		userIndex = segmentEnd - 1;
	}
	return durations;
}

function turnWorkKey(index: number): string {
	return `${state?.sessionId ?? "session"}:${index}`;
}

function createTurnCompletion(index: number, duration: number, trace: TurnWorkTrace | undefined): HTMLElement {
	const groups = trace?.groups ?? [];
	const notes = trace?.notes ?? [];
	const expandable = groups.length > 0 || notes.length > 0;
	const boundary = document.createElement(expandable ? "details" : "div");
	boundary.className = "turn-completion";
	boundary.dataset.turnCompletionIndex = String(index);
	const summary = document.createElement(expandable ? "summary" : "div");
	summary.className = "turn-completion-summary";
	const label = document.createElement("span");
	label.textContent = `Worked for ${formatRunDuration(duration)}`;
	summary.append(label);
	if (expandable) {
		const key = turnWorkKey(index);
		(boundary as HTMLDetailsElement).open = expandedTurnWorkKeys.has(key);
		const caret = document.createElement("span");
		caret.className = "turn-completion-caret";
		caret.setAttribute("aria-hidden", "true");
		summary.append(caret);
		const body = document.createElement("div");
		body.className = "turn-work-body";
		if (notes.length > 0) {
			const noteList = document.createElement("div");
			noteList.className = "turn-work-notes";
			noteList.append(...notes);
			body.append(noteList);
		}
		if (groups.length > 0) {
			const tools = document.createElement("div");
			tools.className = `tool-stack turn-work-tools ${trace?.hasError ? "error" : ""}`;
			tools.append(...groups);
			body.append(tools);
		}
		boundary.append(summary, body);
		boundary.addEventListener("toggle", () => {
			const details = boundary as HTMLDetailsElement;
			if (details.open) expandedTurnWorkKeys.add(key);
			else expandedTurnWorkKeys.delete(key);
		});
	} else {
		boundary.append(summary);
	}
	return boundary;
}

function upsertSessionNotice(key: string, text: string, status: SessionNoticeStatus = "complete"): void {
	if (!state?.sessionId) return;
	const notices = sessionNoticesBySessionId.get(state.sessionId) ?? [];
	const next = notices.filter((notice) => notice.key !== key);
	next.push({ key, text, status });
	sessionNoticesBySessionId.set(state.sessionId, next.slice(-3));
	renderSessionNotices();
}

function pruneOrphanTurnCompletions(): void {
	for (const boundary of messagesEl.querySelectorAll(".turn-completion")) {
		let next = boundary.nextElementSibling;
		while (next?.classList?.contains("session-event-notice")) next = next.nextElementSibling;
		if (!next || next.id === "streaming-indicator" || !next.classList?.contains("message")) boundary.remove();
	}
}

function renderSessionNotices(): void {
	for (const notice of messagesEl.querySelectorAll(".session-event-notice")) notice.remove();
	const notices = sessionNoticesBySessionId.get(state?.sessionId ?? "") ?? [];
	const indicator = document.getElementById("streaming-indicator");
	for (const notice of notices) {
		const row = document.createElement("div");
		row.className = `session-event-notice ${notice.status}`;
		const dot = document.createElement("span");
		dot.className = "session-event-notice-dot";
		const label = document.createElement("span");
		label.textContent = notice.text;
		row.append(dot, label);
		messagesEl.insertBefore(row, indicator);
	}
}

function messageStableSignature(message: DesktopMessage, index: number, activeAssistantIndex: number): string {
	const ignoreStreamingText = isComposerBusy && index === activeAssistantIndex;
	const content: unknown[] = [];
	let hasStreamingTextBlock = false;
	for (const block of message.content ?? []) {
		if (block.type === "text") {
			if (ignoreStreamingText) {
				if (!hasStreamingTextBlock) {
					content.push(["text"]);
					hasStreamingTextBlock = true;
				}
			} else {
				content.push(["text", block.text]);
			}
		} else if (block.type === "thinking") {
			content.push(["thinking"]);
		} else if (block.type === "image") {
			content.push(["image", block.mimeType, block.data?.length]);
		} else if (block.type === "toolCall") {
			content.push(["toolCall", block.id, block.name, renderToolInput(block.input)]);
		} else {
			content.push([block.type]);
		}
	}
	return JSON.stringify({
		role: message.role,
		entryId: message.entryId,
		feedback: message.feedback,
		timestamp: message.timestamp,
		toolCallId: message.toolCallId,
		toolName: message.toolName,
		isError: message.isError,
		errorMessage: message.errorMessage,
		text: ignoreStreamingText ? undefined : message.text,
		content,
		toolCalls: (message.toolCalls ?? []).map((call) => [call.id, call.name, renderToolInput(call.input)]),
	});
}

function messagesStableSignature(
	messages: DesktopMessage[],
	firstVisibleIndex: number,
	activeAssistantIndex: number,
): string {
	return messages
		.slice(firstVisibleIndex)
		.map((message, offset) => messageStableSignature(message, firstVisibleIndex + offset, activeAssistantIndex))
		.join("\n");
}

function addAssistantMessageActions(row: Element, message: DesktopMessage): void {
	if (message.role !== "assistant" || !contentText(message).trim() || row.querySelector(".message-actions")) return;
	row.append(createAssistantMessageActions(message));
}

function updateStableMessageRow(
	row: HTMLElement,
	message: DesktopMessage,
	index: number,
	messages: DesktopMessage[],
	compactCompleted = false,
	toolsInTurnTrace = false,
	showAssistantActions = false,
): void {
	row.dataset.messageIndex = String(index);
	row.classList.toggle("optimistic", (message as Partial<OptimisticDesktopMessage>).optimistic === true);
	const time = row.querySelector(".message-time");
	const nextTime = message.timestamp
		? new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
		: "";
	if (time && time.textContent !== nextTime) time.textContent = nextTime;

	const textSignature = contentText(message);
	if (message.role === "assistant" && row.dataset.textSignature !== textSignature) {
		const body = Array.from(row.children).find((child) => child.classList?.contains("message-body"));
		if (body) {
			const nextBody = renderContent(message);
			body.replaceChildren(...Array.from(nextBody.childNodes));
		}
		row.dataset.textSignature = textSignature;
	}

	if (showAssistantActions) addAssistantMessageActions(row, message);
	else row.querySelector(".message-actions")?.remove();

	const toolSignature = JSON.stringify(
		(message.toolCalls ?? []).map((call) => {
			const result = messages.find((candidate, candidateIndex) => {
				return candidateIndex > index && candidate.role === "toolResult" && candidate.toolCallId === call.id;
			});
			const execution = result ? undefined : completedToolExecutions.get(call.id);
			return [call.id, call.name, call.input, result?.text, result?.isError, execution?.isError];
		}),
	);
	if (toolsInTurnTrace) {
		row.querySelector(".tool-stack")?.remove();
		row.dataset.toolSignature = toolSignature;
	} else if (row.dataset.toolSignature !== toolSignature) {
		row.querySelector(".tool-stack")?.remove();
		const tools = renderToolStackForMessage(message, index, messages, compactCompleted);
		if (tools) row.append(tools);
		row.dataset.toolSignature = toolSignature;
	}
}

function normalizePlanItems(value: unknown): DesktopTodo[] {
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

function latestPlanItems(messages: DesktopMessage[]): DesktopTodo[] | undefined {
	for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex--) {
		const calls = messages[messageIndex]?.toolCalls ?? [];
		for (let callIndex = calls.length - 1; callIndex >= 0; callIndex--) {
			const call = calls[callIndex]!;
			if (call.name.toLowerCase() !== "todowrite") continue;
			return normalizePlanItems((call.input as { todos?: unknown } | undefined)?.todos);
		}
	}
	return undefined;
}

function renderSessionPlan(messages: DesktopMessage[]): void {
	const existing = messagesEl.querySelector(".session-plan");
	const items = Array.isArray(state?.todos) ? normalizePlanItems(state.todos) : latestPlanItems(messages);
	if (!items || items.length === 0) {
		existing?.remove();
		return;
	}
	const signature = JSON.stringify(items);
	if ((existing as HTMLElement | null)?.dataset.planSignature === signature) return;
	const existingDetails = existing?.querySelector("details");
	const wasOpen = existingDetails ? existingDetails.open : undefined;
	existing?.remove();
	const completed = items.filter((item) => item.status === "completed").length;
	const card = document.createElement("article");
	card.className = "message assistant session-plan";
	card.dataset.planSignature = signature;
	const details = document.createElement("details");
	details.open = wasOpen ?? (isComposerBusy || completed < items.length);
	const summary = document.createElement("summary");
	const title = document.createElement("span");
	title.className = "session-plan-title";
	title.textContent = "Plan";
	const progress = document.createElement("span");
	progress.className = "session-plan-progress";
	progress.textContent = `${completed}/${items.length} completed`;
	summary.append(title, progress);
	const list = document.createElement("ol");
	list.className = "session-plan-items";
	for (const item of items) {
		const row = document.createElement("li");
		row.className = `session-plan-item ${item.status}`;
		const marker = document.createElement("span");
		marker.className = "session-plan-marker";
		marker.setAttribute("aria-hidden", "true");
		const text = document.createElement("span");
		text.textContent = item.content;
		row.append(marker, text);
		list.append(row);
	}
	details.append(summary, list);
	card.append(details);
	const finalResponse = messagesEl.querySelector(".message.last-response");
	const indicator = document.getElementById("streaming-indicator");
	messagesEl.insertBefore(card, finalResponse ?? indicator);
}

function openReviewPanel(scope: "working-tree" | "staged" | "last-turn" = "working-tree"): void {
	reviewScopeSelect.value = scope;
	layoutState.rightCollapsed = false;
	layoutState.rightTab = "review";
	applyLayoutState();
	saveLayoutState();
	syncRightPanelContent();
	refreshReview().catch(showError);
}

function renderLastTurnArtifact(): void {
	messagesEl.querySelector(".change-artifact")?.remove();
	const diff = state?.lastTurnDiff;
	if (!diff || diff.files.length === 0 || isComposerBusy) return;
	const card = document.createElement("article");
	card.className = "message assistant change-artifact";
	const header = document.createElement("div");
	header.className = "change-artifact-header";
	const title = document.createElement("div");
	title.className = "change-artifact-title";
	const icon = document.createElement("span");
	icon.className = "change-artifact-icon";
	icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12h8M12 8v8"/></svg>`;
	const copy = document.createElement("span");
	copy.textContent = `Edited ${diff.files.length} file${diff.files.length === 1 ? "" : "s"}`;
	const stats = document.createElement("span");
	stats.className = "change-artifact-stats";
	stats.innerHTML = `<span class="add-count">+${diff.totalAdditions}</span><span class="del-count">-${diff.totalDeletions}</span>`;
	title.append(icon, copy, stats);
	const review = document.createElement("button");
	review.type = "button";
	review.textContent = "Review";
	review.addEventListener("click", () => openReviewPanel("last-turn"));
	header.append(title, review);

	const files = document.createElement("div");
	files.className = "change-artifact-files";
	for (const file of diff.files.slice(0, 4)) {
		const row = document.createElement("button");
		row.type = "button";
		row.className = "change-artifact-file";
		row.addEventListener("click", () => openReviewPanel("last-turn"));
		const path = document.createElement("span");
		path.className = "change-artifact-path";
		path.textContent = file.newPath;
		const fileStats = document.createElement("span");
		fileStats.className = "change-artifact-file-stats";
		fileStats.innerHTML = `<span class="add-count">+${file.additions}</span><span class="del-count">-${file.deletions}</span>`;
		row.append(path, fileStats);
		files.append(row);
	}
	if (diff.files.length > 4) {
		const more = document.createElement("button");
		more.type = "button";
		more.className = "change-artifact-more";
		more.textContent = `Show ${diff.files.length - 4} more file${diff.files.length - 4 === 1 ? "" : "s"}`;
		more.addEventListener("click", () => openReviewPanel("last-turn"));
		files.append(more);
	}
	card.append(header, files);
	const indicator = document.getElementById("streaming-indicator");
	messagesEl.insertBefore(card, indicator);
}

function patchStableStreamingRender(
	messages: DesktopMessage[],
	firstVisibleIndex: number,
	activeAssistantIndex: number,
): void {
	const indicator = document.getElementById("streaming-indicator");
	const turnDurations = completedTurnDurations(messages);
	const { skippedIndexes, tracedToolIndexes, tracesByFinalIndex } = createCompletedTurnWorkTraces(
		messages,
		firstVisibleIndex,
	);
	for (let index = firstVisibleIndex; index < messages.length; index++) {
		const message = messages[index]!;
		if (message.role === "toolResult") continue;
		if (skippedIndexes.has(index)) {
			messagesEl.querySelector(`[data-message-index="${index}"]`)?.remove();
			continue;
		}
		if (!hasVisibleContent(message)) continue;
		const isActivelyStreaming = isComposerBusy && index === activeAssistantIndex;
		const showAssistantActions =
			message.role === "assistant" &&
			Boolean(contentText(message).trim()) &&
			index === activeAssistantIndex &&
			!isActivelyStreaming;
		let row = messagesEl.querySelector<HTMLElement>(`[data-message-index="${index}"]`);
		if (!row) {
			row = createMessage(message, showAssistantActions);
			row.dataset.messageIndex = String(index);
			messagesEl.insertBefore(row, indicator);
		}
		const duration = turnDurations.get(index);
		if (duration && !messagesEl.querySelector(`[data-turn-completion-index="${index}"]`)) {
			messagesEl.insertBefore(createTurnCompletion(index, duration, tracesByFinalIndex.get(index)), row);
		}
		row.classList.toggle(
			"last-response",
			message.role === "assistant" && index === activeAssistantIndex && !isActivelyStreaming,
		);
		updateStableMessageRow(
			row,
			message,
			index,
			messages,
			shouldCompactToolMessage(index, isActivelyStreaming, messages),
			tracedToolIndexes.has(index),
			showAssistantActions,
		);
	}
	renderedStableMessageSignature = messagesStableSignature(messages, firstVisibleIndex, activeAssistantIndex);
	renderedFirstVisibleIndex = firstVisibleIndex;
	renderedMessageCount = messages.length;
	syncStreamingIndicator();
	renderSessionNotices();
	renderSessionPlan(messages);
	renderLastTurnArtifact();
	pruneOrphanTurnCompletions();
	if (shouldFollowMessages) scrollMessagesToBottom();
}

function renderMessages(messages: DesktopMessage[]): void {
	backendMessages = messages;
	syncSessionMenu();
	const sessionChanged = renderedSessionId !== state?.sessionId;
	if (sessionChanged) {
		renderedSessionId = state?.sessionId;
		optimisticUserMessages = [];
		completedToolExecutions.clear();
		toolStackOpenStateByKey.clear();
		visibleMessageLimit = messagePageSize;
		shouldFollowMessages = true;
		renderedStableMessageSignature = "";
		renderedFirstVisibleIndex = 0;
		renderedMessageCount = 0;
	}
	messages = messagesWithOptimisticUserMessages(messages);
	currentMessages = messages;

	let lastAssistantIndex = -1;
	for (let index = messages.length - 1; index >= 0; index--) {
		if (messages[index]?.role === "assistant") {
			lastAssistantIndex = index;
			break;
		}
	}
	const activeAssistantIndex = isComposerBusy ? lastAssistantIndex : -1;
	const defaultFirstVisibleIndex = Math.max(0, messages.length - visibleMessageLimit);
	const firstVisibleIndex =
		isComposerBusy && shouldFollowMessages && renderedMessageCount > 0
			? Math.min(defaultFirstVisibleIndex, renderedFirstVisibleIndex)
			: defaultFirstVisibleIndex;
	const stableSignature = messagesStableSignature(messages, firstVisibleIndex, activeAssistantIndex);
	const stableRenderChanged = stableSignature !== renderedStableMessageSignature;
	const canPatchStreamingRender =
		isComposerBusy &&
		!sessionChanged &&
		messages.length > 0 &&
		renderedMessageCount > 0 &&
		renderedFirstVisibleIndex === firstVisibleIndex &&
		messages.length >= renderedMessageCount &&
		(stableRenderChanged || isComposerBusy);
	if (canPatchStreamingRender) {
		patchStableStreamingRender(messages, firstVisibleIndex, activeAssistantIndex);
		return;
	}

	const followAfterRender = sessionChanged || shouldFollowMessages || isMessagesScrolledToBottom();
	const previousScrollTop = messagesEl.scrollTop;
	messagesEl.innerHTML = "";
	renderedStableMessageSignature = stableSignature;
	renderedFirstVisibleIndex = firstVisibleIndex;
	renderedMessageCount = messages.length;
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

	const turnDurations = completedTurnDurations(messages);
	const { skippedIndexes, tracedToolIndexes, tracesByFinalIndex } = createCompletedTurnWorkTraces(
		messages,
		firstVisibleIndex,
	);
	for (let index = firstVisibleIndex; index < messages.length; index++) {
		const message = messages[index]!;
		if (message.role === "toolResult") continue;
		if (skippedIndexes.has(index)) continue;
		if (!hasVisibleContent(message)) continue;
		const isActivelyStreaming = isComposerBusy && index === lastAssistantIndex;
		const showAssistantActions =
			message.role === "assistant" &&
			Boolean(contentText(message).trim()) &&
			index === lastAssistantIndex &&
			!isActivelyStreaming;
		const row = createMessage(message, showAssistantActions);
		row.dataset.messageIndex = String(index);
		row.classList.toggle(
			"last-response",
			message.role === "assistant" && index === lastAssistantIndex && !isActivelyStreaming,
		);
		const duration = turnDurations.get(index);
		if (duration) messagesEl.append(createTurnCompletion(index, duration, tracesByFinalIndex.get(index)));
		const tools = tracedToolIndexes.has(index)
			? undefined
			: renderToolStackForMessage(
					message,
					index,
					messages,
					shouldCompactToolMessage(index, isActivelyStreaming, messages),
				);
		if (tools) row.append(tools);
		messagesEl.append(row);
	}
	syncStreamingIndicator();
	renderSessionNotices();
	renderSessionPlan(messages);
	renderLastTurnArtifact();
	pruneOrphanTurnCompletions();
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
	const sessionChanged = Boolean(previous && (previous.sessionId !== next.sessionId || previous.cwd !== next.cwd));
	const runStateChanged = Boolean(
		previous &&
			!sessionChanged &&
			(previous.isStreaming !== next.isStreaming || previous.pendingMessageCount !== next.pendingMessageCount),
	);
	if (sessionChanged) {
		activeAgentRun = false;
		activeToolExecutions.clear();
		isAbortingRun = false;
	}
	state = next;
	restoreProjectLayout(next.cwd);
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
	composerWorkspaceName.textContent = basename(next.cwd);
	composerWorkspaceButton.title = next.cwd;
	sessionShortId.textContent = shortId(next.sessionId);
	const active = activeSession();
	if (active) {
		markSessionRead(active);
		const stateRunning = isRunActive(next);
		active.isRunning = stateRunning;
		setSessionStatus(active, stateRunning ? "running" : undefined);
	}
	messageCount.textContent = String(next.messageCount);
	queueCount.textContent = String(next.pendingMessageCount);
	renderPermissionMode();
	renderPermissionRequests();
	renderClarificationRequests();
	renderQueuedPrompts();
	contextSummary.innerHTML = `
		<div><span>Working directory</span><strong>${next.cwd}</strong></div>
		<div><span>Session store</span><strong>${next.sessionDir ?? "Default Pi session store"}</strong></div>
		<div><span>Session file</span><strong>${next.sessionFile ?? "Not written yet"}</strong></div>
		<div><span>Model</span><strong>${requiresAuth ? "Login required" : model}</strong></div>
	`;
	setBusy(isRunActive(next));
	renderContextUsage(next);
	renderComposerContext();

	const selectedValue = next.model ? `${next.model.provider}:${next.model.id}` : "";
	if (modelSelect.value !== selectedValue) {
		modelSelect.value = selectedValue;
	}
	syncComposerModelSelection();
	if (!previous || sessionChanged) {
		activeCommentAnchor = undefined;
		reviewDiffData = undefined;
		loadReviewComments();
		renderSessionList();
	} else {
		renderReviewCommentsBadge();
		if (runStateChanged) renderSessionList();
	}
}

function compactTokenCount(value: number | null): string {
	if (!Number.isFinite(value)) return "unknown";
	const numericValue = value as number;
	if (numericValue >= 1_000_000) return `${(numericValue / 1_000_000).toFixed(numericValue >= 10_000_000 ? 0 : 1)}m`;
	if (numericValue >= 1_000) return `${(numericValue / 1_000).toFixed(numericValue >= 100_000 ? 0 : 1)}k`;
	return String(Math.round(numericValue));
}

function renderContextUsage(next = state): void {
	const usage = next?.contextUsage;
	composerContextUsageButton.hidden = !usage;
	if (!usage) {
		setMenuOpen(composerContextUsageButton, composerContextUsageMenu, false);
		return;
	}
	const percent = Number.isFinite(usage.percent) ? Math.max(0, Math.min(100, usage.percent as number)) : 0;
	const ring = composerContextUsageButton.querySelector<SVGCircleElement>(".context-usage-value");
	if (ring) ring.style.strokeDashoffset = String(100 - percent);
	const tokenSummary = `${compactTokenCount(usage.tokens)} / ${compactTokenCount(usage.contextWindow)} tokens`;
	const percentSummary = usage.percent === null ? "Usage estimate unavailable" : `${Math.round(percent)}% used`;
	composerContextUsageButton.title = `${percentSummary} · ${tokenSummary}`;
	composerContextUsageButton.setAttribute("aria-label", `Context window: ${percentSummary}, ${tokenSummary}`);
	composerContextUsageValue.textContent = `${tokenSummary} · ${percentSummary}`;
	composerCompactContext.disabled = isComposerBusy || next.messageCount < 2;
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

function markSessionRead(session: DesktopSessionInfo | undefined): void {
	if (!session) return;
	let changed = false;
	for (const key of sessionIdentityKeys(session)) {
		if (sessionStatusByKey.get(key) === "finished") {
			sessionStatusByKey.delete(key);
			changed = true;
		}
	}
	if (changed) renderSessionList();
}

function getSessionStatus(session: DesktopSessionInfo | undefined): SessionStatus | undefined {
	const keys = sessionIdentityKeys(session);
	if (keys.some((key) => sessionStatusByKey.get(key) === "running")) return "running";
	if (keys.some((key) => sessionStatusByKey.get(key) === "finished")) return "finished";
	return undefined;
}

function setSessionStatus(session: DesktopSessionInfo | undefined, status: SessionStatus | undefined): void {
	for (const key of sessionIdentityKeys(session)) {
		if (status) sessionStatusByKey.set(key, status);
		else sessionStatusByKey.delete(key);
	}
}

function updateSessionRunningStatus(status: DesktopSessionStatusEvent): void {
	const session = sessions.find((candidate) => candidate.path === status.path || candidate.id === status.id);
	if (!session) return;
	session.isRunning = status.isRunning;
	if (status.isRunning) {
		setSessionStatus(session, "running");
	} else if (session.id !== state?.sessionId) {
		setSessionStatus(session, "finished");
	} else {
		setSessionStatus(session, undefined);
		markSessionRead(session);
	}
	renderSessionList();
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

function sessionMatchesSearch(session: DesktopSessionInfo, query: string): boolean {
	if (!query) return true;
	const title = session.name || session.firstMessage || "Untitled session";
	return `${title} ${session.cwd}`.toLowerCase().includes(query);
}

function pinnedSessionIndex(session: DesktopSessionInfo): number {
	const order = [...pinnedSessionKeys];
	const indexes = sessionIdentityKeys(session)
		.map((key) => order.indexOf(key))
		.filter((index) => index >= 0);
	return indexes.length > 0 ? Math.min(...indexes) : Number.MAX_SAFE_INTEGER;
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
	sessionMenuPin.classList.toggle("active", pinned);
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
	const availableThinkingLevels = new Set(state?.availableThinkingLevels ?? ["low", "medium", "high", "xhigh"]);
	for (const [label, value] of [
		["Low", "low"],
		["Medium", "medium"],
		["High", "high"],
		["Extra High", "xhigh"],
	]) {
		const item = document.createElement("button");
		item.type = "button";
		const isAvailable = availableThinkingLevels.has(value);
		item.className = `model-menu-item reasoning-item ${currentThinking === value ? "active" : ""}`;
		item.dataset.thinkingLevel = value;
		item.setAttribute("aria-disabled", String(!isAvailable));
		item.tabIndex = isAvailable ? 0 : -1;
		item.title = isAvailable ? "" : "This reasoning level is not supported by the current model.";
		item.innerHTML = `<span>${label}</span>`;
		item.addEventListener("click", async () => {
			if (item.getAttribute("aria-disabled") === "true") return;
			try {
				closeComposerMenus();
				renderState(await window.piDesktop.setThinkingLevel(value));
				focusComposer();
			} catch (error) {
				showError(error);
			}
		});
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
				focusComposer();
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
	renderSessionRecoveryError();
	if (sessions.length === 0) {
		const empty = document.createElement("div");
		empty.className = "session-empty";
		empty.textContent = "No saved chats in this store yet.";
		sessionList.append(empty);
		syncSessionMenu();
		return;
	}

	const query = sessionSearchInput.value.trim().toLowerCase();
	const matchingSessions = sessions.filter((session) => sessionMatchesSearch(session, query));
	if (matchingSessions.length === 0) {
		const empty = document.createElement("div");
		empty.className = "session-empty";
		empty.textContent = "No matching chats.";
		sessionList.append(empty);
		syncSessionMenu();
		return;
	}

	const archivedSessions = matchingSessions
		.filter((session) => isSessionArchived(session))
		.sort((a, b) => modifiedSessionTime(b) - modifiedSessionTime(a));
	const activeSessions = matchingSessions.filter((session) => !isSessionArchived(session));
	const pinnedSessions = activeSessions
		.filter((session) => isSessionPinned(session))
		.sort((a, b) => pinnedSessionIndex(a) - pinnedSessionIndex(b) || modifiedSessionTime(b) - modifiedSessionTime(a));
	if (pinnedSessions.length > 0) {
		const pinnedHeading = document.createElement("div");
		pinnedHeading.className = "session-section-heading";
		pinnedHeading.textContent = "Pinned";
		sessionList.append(pinnedHeading);
		for (const session of pinnedSessions) sessionList.append(createSessionListItem(session));
	}

	const groups = new Map<string, DesktopSessionInfo[]>();
	for (const session of activeSessions) {
		if (isSessionPinned(session)) continue;
		const group = groups.get(session.cwd) ?? [];
		group.push(session);
		groups.set(session.cwd, group);
	}
	for (const projectSessions of groups.values()) {
		projectSessions.sort((a, b) => modifiedSessionTime(b) - modifiedSessionTime(a));
	}
	const orderedGroups = [...groups.entries()].sort(([cwdA], [cwdB]) => {
		return basename(cwdA).localeCompare(basename(cwdB));
	});
	const currentProjectKeys = new Set(orderedGroups.map(([cwd]) => cwd));
	for (const cwd of projectSessionLimits.keys()) {
		if (!currentProjectKeys.has(cwd)) {
			projectSessionLimits.delete(cwd);
		}
	}

	for (const [cwd, projectSessions] of orderedGroups) {
		const projectCollapsed = !query && collapsedProjects.has(cwd);
		const heading = document.createElement("div");
		heading.className = `session-group-heading ${cwd === state?.cwd ? "current" : ""} ${
			projectCollapsed ? "collapsed" : ""
		}`;
		const icon = document.createElement("span");
		icon.className = "project-icon";
		icon.innerHTML = projectCollapsed
			? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4l2 2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2Z" /></svg>`
			: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 2h9a2 2 0 0 1 2 2v1H2V6a2 2 0 0 1 2-2Z" /><path d="M2 9h20l-1.5 9a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2L2 9Z" /></svg>`;
		const label = document.createElement("span");
		label.className = "project-name";
		label.textContent = basename(cwd);
		const newChatButton = document.createElement("button");
		newChatButton.type = "button";
		newChatButton.className = "project-new-chat-btn";
		newChatButton.title = "New chat in this project";
		newChatButton.setAttribute("aria-label", newChatButton.title);
		newChatButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
		newChatButton.addEventListener("click", async (event) => {
			event.stopPropagation();
			try {
				if (state?.cwd !== cwd) renderState(await window.piDesktop.setCwd(cwd));
				renderState(await window.piDesktop.newSession());
				await refreshAfterSessionChange();
			} catch (error) {
				showError(error);
			} finally {
				focusComposer();
			}
		});
		const collapseIcon = document.createElement("span");
		collapseIcon.className = "project-collapse-icon";
		collapseIcon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
		heading.title = `${cwd} · ${projectSessions.length} sessions`;
		heading.append(icon, label, newChatButton, collapseIcon);
		heading.addEventListener("click", () => {
			if (collapsedProjects.has(cwd)) {
				collapsedProjects.delete(cwd);
			} else {
				collapsedProjects.add(cwd);
			}
			localStorage.setItem("pi-collapsed-projects", JSON.stringify([...collapsedProjects]));
			renderSessionList();
		});
		sessionList.append(heading);
		if (projectCollapsed) continue;

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
	if (archivedSessions.length > 0) {
		const archivedToggle = document.createElement("button");
		archivedToggle.type = "button";
		archivedToggle.className = "archived-sessions-toggle";
		archivedToggle.setAttribute("aria-expanded", String(showArchivedSessions));
		archivedToggle.textContent = `Archived · ${archivedSessions.length}`;
		archivedToggle.addEventListener("click", () => {
			showArchivedSessions = !showArchivedSessions;
			renderSessionList();
		});
		sessionList.append(archivedToggle);
		if (showArchivedSessions) {
			for (const session of archivedSessions) sessionList.append(createSessionListItem(session, { archived: true }));
		}
	}
	syncSessionMenu();
}

function renderSessionRecoveryError(): void {
	if (!sessionRecoveryError) return;
	const card = document.createElement("div");
	card.className = "session-recovery-error";
	const title = document.createElement("strong");
	title.textContent = "Could not restore chat";
	const message = document.createElement("span");
	message.textContent = sessionRecoveryError.message;
	const actions = document.createElement("div");
	const retry = document.createElement("button");
	retry.type = "button";
	retry.textContent = "Retry";
	retry.addEventListener("click", () => {
		if (sessionRecoveryError) switchToSession(sessionRecoveryError.path).catch(showError);
	});
	const dismiss = document.createElement("button");
	dismiss.type = "button";
	dismiss.textContent = "Dismiss";
	dismiss.addEventListener("click", () => {
		sessionRecoveryError = undefined;
		renderSessionList();
	});
	actions.append(retry, dismiss);
	card.append(title, message, actions);
	sessionList.append(card);
}

function createSessionListItem(session: DesktopSessionInfo, options: { archived?: boolean } = {}): HTMLElement {
	const archived = options.archived === true;
	const row = document.createElement("div");
	row.className = `session-item-row ${isActiveSession(session) ? "active" : ""} ${
		session.path === switchingSessionPath ? "loading" : ""
	} ${isSessionPinned(session) ? "pinned" : ""} ${archived ? "archived" : ""}`;
	const button = document.createElement("button");
	button.type = "button";
	button.disabled = session.path === switchingSessionPath;
	button.className = "session-item";
	const title = sessionDisplayTitle(session);
	button.title = `${session.name || session.firstMessage || "Untitled session"} · ${basename(session.cwd)}`;
	const titleEl = document.createElement("span");
	titleEl.className = "session-item-title";
	const sessionStatus = getSessionStatus(session);
	const isRunning = sessionStatus === "running" || (sessionStatus === undefined && session.isRunning);
	const isFinished = !isRunning && session.id !== state?.sessionId && sessionStatus === "finished";
	if (isRunning || isFinished) {
		const statusDot = document.createElement("span");
		statusDot.className = `session-status-dot ${isRunning ? "running" : "finished"}`;
		statusDot.title = isRunning ? "Running" : "Finished";
		titleEl.append(statusDot);
	}
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
			markSessionRead(session);
			await switchToSession(session.path);
		} catch (error) {
			showError(error);
		}
	});

	const actions = document.createElement("div");
	actions.className = "session-item-actions";
	if (archived) {
		const restoreButton = document.createElement("button");
		restoreButton.type = "button";
		restoreButton.className = "session-row-action";
		restoreButton.title = "Restore chat";
		restoreButton.setAttribute("aria-label", restoreButton.title);
		restoreButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v13H4z"/><path d="M3 3h18v4H3zM9 12h6"/></svg>`;
		restoreButton.addEventListener("click", (event) => {
			event.stopPropagation();
			setSessionArchived(session, false);
			renderSessionList();
		});
		actions.append(restoreButton);
		row.append(button, actions);
		return row;
	}
	const pinButton = document.createElement("button");
	pinButton.type = "button";
	pinButton.className = "session-row-action session-pin-button";
	pinButton.title = isSessionPinned(session) ? "Unpin chat" : "Pin chat";
	pinButton.setAttribute("aria-label", pinButton.title);
	pinButton.setAttribute("aria-pressed", isSessionPinned(session) ? "true" : "false");
	pinButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3 6 0 1 6 3 3v2H5v-2l3-3 1-6Z"/><path d="M12 14v7"/></svg>`;
	pinButton.addEventListener("click", (event) => {
		event.stopPropagation();
		setSessionPinned(session, !isSessionPinned(session));
	});
	const archiveButton = document.createElement("button");
	archiveButton.type = "button";
	archiveButton.className = "session-row-action";
	archiveButton.title = "Archive chat";
	archiveButton.setAttribute("aria-label", archiveButton.title);
	archiveButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v13H4z"/><path d="M3 3h18v4H3zM9 12h6"/></svg>`;
	archiveButton.addEventListener("click", async (event) => {
		event.stopPropagation();
		try {
			await archiveSession(session);
		} catch (error) {
			showError(error);
		}
	});
	actions.append(pinButton, archiveButton);
	row.append(button, actions);
	return row;
}

function renderGit(status: GitStatus): void {
	renderComposerContext(status);
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

function environmentIcon(kind: "changes" | "local" | "branch" | "commit"): string {
	if (kind === "changes") {
		return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>';
	}
	if (kind === "local") {
		return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></svg>';
	}
	if (kind === "branch") {
		return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v12a4 4 0 0 0 4 4h6"/><circle cx="7" cy="4" r="2"/><circle cx="17" cy="20" r="2"/><path d="M15 8h2a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3h-2"/></svg>';
	}
	return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h5M16 12h5"/><circle cx="12" cy="12" r="4"/></svg>';
}

function renderMonitorControl(monitoring: boolean): string {
	return `<label class="environment-monitor-label">
		<input id="environment-auto-fix" type="checkbox" ${monitoring ? "checked" : ""} />
		<span>Auto-fix failing checks</span>
	</label>`;
}

function isOpenPullRequest(pullRequest: GithubPullRequestStatus): boolean {
	return pullRequest.kind === "ready" && pullRequest.state.toUpperCase() === "OPEN";
}

function pullRequestStateLabel(pullRequest: GithubPullRequestStatus): string {
	if (pullRequest.kind !== "ready") return "";
	const prState = pullRequest.state.toUpperCase();
	if (prState === "MERGED") return "Merged";
	if (prState === "CLOSED") return "Closed";
	if (pullRequest.isDraft) return "Draft";
	return "Open";
}

function pullRequestStateClass(pullRequest: GithubPullRequestStatus): string {
	if (pullRequest.kind !== "ready") return "";
	const prState = pullRequest.state.toUpperCase();
	if (prState === "MERGED") return "merged";
	if (prState === "CLOSED") return "closed";
	if (pullRequest.isDraft) return "draft";
	return "open";
}

function draftEnvironmentAction(text: string): void {
	promptInput.value = text;
	autosizePrompt();
	syncSendButtonState();
	setEnvironmentPopoverOpen(false);
	focusComposer();
	promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
}

function renderEnvironment(status: DesktopEnvironmentStatus): void {
	renderComposerContext(status.git);
	const pullRequest = status.pullRequest;
	const git = status.git;
	const hasFailures = isOpenPullRequest(pullRequest) && pullRequest.kind === "ready" && pullRequest.failedCount > 0;
	environmentTabIndicator.hidden = !hasFailures;
	toggleEnvironmentCardButton.classList.toggle("has-pr-failures", hasFailures);
	const changes = git.isRepo
		? `<button id="environment-review-changes" class="environment-row environment-command-row" type="button">
				<span class="environment-row-icon">${environmentIcon("changes")}</span>
				<span class="environment-row-label">Changes</span>
				<span class="environment-change-count"><span class="environment-additions">+${git.additions ?? 0}</span> <span class="environment-deletions">-${git.deletions ?? 0}</span></span>
			</button>
			<div class="environment-row">
				<span class="environment-row-icon">${environmentIcon("local")}</span>
				<span class="environment-row-label">Local</span>
				<span>${git.status.length} file${git.status.length === 1 ? "" : "s"}</span>
			</div>
			<div class="environment-row">
				<span class="environment-row-icon">${environmentIcon("branch")}</span>
				<span class="environment-row-label">${escapeHtml(git.branch || "detached")}</span>
			</div>
			<button id="environment-commit-push" class="environment-row environment-command-row" type="button">
				<span class="environment-row-icon">${environmentIcon("commit")}</span>
				<span class="environment-row-label">Commit or push</span>
				<span class="environment-row-caret" aria-hidden="true"></span>
			</button>`
		: `<div class="environment-empty">${escapeHtml(git.error || "This workspace is not a Git repository.")}</div>`;
	let pullRequestSection: string;
	if (pullRequest.kind === "ready") {
		const checks = [...pullRequest.checks]
			.sort(
				(left, right) =>
					["failed", "pending", "passed", "neutral"].indexOf(left.state) -
					["failed", "pending", "passed", "neutral"].indexOf(right.state),
			)
			.map((check) => {
				const label = check.state === "neutral" ? "skipped" : check.state;
				const tag = check.detailsUrl ? "a" : "div";
				const href = check.detailsUrl
					? ` href="${escapeHtml(check.detailsUrl)}" target="_blank" rel="noreferrer"`
					: "";
				return `<${tag} class="environment-check"${href}>
					<span class="environment-check-dot ${check.state}"></span>
					<span class="environment-check-name" title="${escapeHtml(check.name)}">${escapeHtml(check.name)}</span>
					<span class="environment-check-state ${check.state}">${label}</span>
				</${tag}>`;
			})
			.join("");
		const checkState = pullRequest.failedCount > 0 ? "failed" : pullRequest.pendingCount > 0 ? "pending" : "passed";
		const checkLabel =
			pullRequest.failedCount > 0
				? `${pullRequest.failedCount} check${pullRequest.failedCount === 1 ? "" : "s"} failed`
				: pullRequest.pendingCount > 0
					? `${pullRequest.pendingCount} check${pullRequest.pendingCount === 1 ? "" : "s"} pending`
					: "Checks successful";
		const checkSummary = pullRequest.checks.length
			? `<details class="environment-check-disclosure">
					<summary>
						<span class="environment-check-icon ${checkState}" aria-hidden="true"></span>
						<span>${checkLabel}</span>
					</summary>
					<div class="environment-checks">${checks}</div>
					<div class="environment-actions">
						${renderMonitorControl(status.monitoring)}
						${hasFailures ? '<button id="environment-fix-checks" class="environment-fix-button" type="button">Fix</button>' : ""}
					</div>
				</details>`
			: '<div class="environment-pr-meta">No checks reported yet.</div>';
		const stateLabel = pullRequestStateLabel(pullRequest);
		const stateClass = pullRequestStateClass(pullRequest);
		pullRequestSection = `<a class="environment-row environment-pr-link" href="${escapeHtml(pullRequest.url)}" target="_blank" rel="noreferrer" title="#${pullRequest.number} · ${pullRequest.isDraft ? "Draft" : escapeHtml(pullRequest.state.toLowerCase())} · ${escapeHtml(pullRequest.headRefName)} -> ${escapeHtml(pullRequest.baseRefName)}">
				<span class="environment-row-icon">${environmentIcon("branch")}</span>
				<span class="environment-pr-title"><span class="environment-pr-state ${stateClass}">${escapeHtml(stateLabel)}</span><span class="environment-pr-title-text">${escapeHtml(pullRequest.title)}</span></span>
			</a>
			<div class="environment-pr-meta"><span class="environment-pr-branch">#${pullRequest.number} · ${escapeHtml(pullRequest.headRefName)} -> ${escapeHtml(pullRequest.baseRefName)}</span></div>
			${checkSummary}`;
	} else {
		const createPullRequest =
			git.isRepo && pullRequest.kind === "none"
				? `<button id="environment-create-pr" class="environment-row environment-command-row" type="button">
						<span class="environment-row-icon">${environmentIcon("branch")}</span>
						<span class="environment-row-label">Create pull request</span>
						<span class="environment-row-caret" aria-hidden="true"></span>
					</button>`
				: "";
		pullRequestSection = `<div class="environment-empty">${escapeHtml(pullRequest.message)}</div>
			${createPullRequest}
			${pullRequest.kind === "none" ? "" : `<div class="environment-actions">${renderMonitorControl(status.monitoring)}</div>`}`;
	}
	environmentContent.innerHTML = `<div class="environment-card">
		<div class="environment-section">${changes}</div>
		<div class="environment-section">${pullRequestSection}</div>
	</div>`;
	const fixButton = environmentContent.querySelector<HTMLButtonElement>("#environment-fix-checks");
	fixButton?.addEventListener("click", async () => {
		fixButton.disabled = true;
		fixButton.textContent = "Starting fix...";
		try {
			renderEnvironment(await window.piDesktop.fixPrChecks());
		} catch (error) {
			showError(error);
			fixButton.disabled = false;
			fixButton.textContent = "Fix";
		}
	});
	const monitorToggle = environmentContent.querySelector<HTMLInputElement>("#environment-auto-fix");
	monitorToggle?.addEventListener("change", async () => {
		monitorToggle.disabled = true;
		try {
			renderEnvironment(await window.piDesktop.setPrMonitor(monitorToggle.checked));
		} catch (error) {
			showError(error);
			monitorToggle.disabled = false;
		}
	});
	environmentContent.querySelector("#environment-review-changes")?.addEventListener("click", () => {
		openReviewPanel("working-tree");
	});
	environmentContent.querySelector("#environment-commit-push")?.addEventListener("click", () => {
		draftEnvironmentAction(
			"Review the current changes, then commit and push them. Follow the repository instructions and ask before any action that requires approval.",
		);
	});
	environmentContent.querySelector("#environment-create-pr")?.addEventListener("click", () => {
		draftEnvironmentAction(
			"Create a pull request for the current branch. Review the changes and repository PR instructions first, and show me the proposed title and description before creating it.",
		);
	});
}

function diffScope(): "working-tree" | "staged" | "last-turn" {
	const value = reviewScopeSelect.value;
	return value === "staged" || value === "last-turn" ? value : "working-tree";
}

function reviewCommentsStorageKey(): string | undefined {
	const identity = state?.sessionFile ?? state?.sessionId;
	return identity ? `pi-review-comments:${identity}` : undefined;
}

function isReviewDraftComment(value: unknown): value is ReviewDraftComment {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const comment = value as Partial<ReviewDraftComment>;
	return (
		typeof comment.id === "string" &&
		typeof comment.filePath === "string" &&
		typeof comment.body === "string" &&
		(comment.side === "old" || comment.side === "new") &&
		comment.status === "draft"
	);
}

function loadReviewComments(): void {
	const key = reviewCommentsStorageKey();
	if (!key) {
		reviewComments = [];
		renderReviewCommentsBadge();
		return;
	}
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
		reviewComments = Array.isArray(parsed) ? parsed.filter(isReviewDraftComment) : [];
	} catch {
		reviewComments = [];
	}
	renderReviewCommentsBadge();
}

function persistReviewComments(): void {
	const key = reviewCommentsStorageKey();
	if (!key) return;
	const drafts = reviewComments.filter((comment) => comment.status === "draft");
	if (drafts.length > 0) {
		localStorage.setItem(key, JSON.stringify(drafts));
	} else {
		localStorage.removeItem(key);
	}
}

function getDraftComments(): ReviewDraftComment[] {
	return reviewComments.filter((comment) => comment.status === "draft");
}

function renderReview(diff: ParsedDiff): void {
	reviewContent.replaceChildren();
	if (diff.files.length === 0) {
		const empty = document.createElement("div");
		empty.className = "review-empty";
		empty.textContent =
			diffScope() === "last-turn"
				? "No changes in last turn"
				: diffScope() === "staged"
					? "No staged changes"
					: "No changes";
		reviewContent.append(empty);
		reviewStats.textContent = "";
		return;
	}
	reviewStats.innerHTML = `<span class="add-count">+${diff.totalAdditions}</span> <span class="del-count">-${diff.totalDeletions}</span>`;
	for (const file of diff.files) {
		reviewContent.append(renderDiffFile(file));
	}
}

function renderDiffFile(file: DiffFile): HTMLElement {
	const section = document.createElement("section");
	section.className = "diff-file";
	const header = document.createElement("div");
	header.className = "diff-file-header";
	const name = document.createElement("span");
	name.className = "diff-file-name";
	const icon = document.createElement("span");
	icon.className = "file-icon";
	icon.textContent = fileStatusIcon(file.status);
	name.append(icon, document.createTextNode(file.newPath));
	const stats = document.createElement("span");
	stats.className = "diff-file-stats";
	stats.innerHTML = `<span class="add-count">+${file.additions}</span> <span class="del-count">-${file.deletions}</span>`;
	header.append(name, stats);
	section.append(header);

	for (const hunk of file.hunks) {
		section.append(renderDiffHunk(file, hunk));
	}

	return section;
}

function fileStatusIcon(status: DiffFile["status"]): string {
	switch (status) {
		case "added":
			return "+";
		case "deleted":
			return "-";
		case "renamed":
			return ">";
		default:
			return "o";
	}
}

function escapeHtml(str: string): string {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderDiffHunk(file: DiffFile, hunk: DiffHunk): HTMLElement {
	const hunkEl = document.createElement("div");
	hunkEl.className = "diff-hunk";
	const hunkHeader = document.createElement("div");
	hunkHeader.className = "diff-hunk-header";
	hunkHeader.textContent = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@${
		hunk.header ? ` ${hunk.header}` : ""
	}`;
	hunkEl.append(hunkHeader);
	for (const line of hunk.lines) {
		hunkEl.append(renderDiffLine(file, line));
		for (const comment of reviewComments.filter(
			(candidate) =>
				candidate.filePath === file.newPath &&
				candidate.endOldLine === line.oldLine &&
				candidate.endNewLine === line.newLine &&
				candidate.status === "draft",
		)) {
			hunkEl.append(renderDraftComment(comment));
		}
		if (
			activeCommentAnchor &&
			activeCommentAnchor.filePath === file.newPath &&
			activeCommentAnchor.endOldLine === line.oldLine &&
			activeCommentAnchor.endNewLine === line.newLine
		) {
			hunkEl.append(createCommentBox(file));
		}
	}
	return hunkEl;
}

function lineIndex(line: DiffLine): number {
	return line.newLine ?? line.oldLine ?? 0;
}

function anchorStartIndex(anchor: ReviewCommentAnchor): number {
	return anchor.startNewLine ?? anchor.startOldLine ?? 0;
}

function anchorEndIndex(anchor: ReviewCommentAnchor): number {
	return anchor.endNewLine ?? anchor.endOldLine ?? 0;
}

function isLineInActiveRange(file: DiffFile, line: DiffLine): boolean {
	if (!activeCommentAnchor || activeCommentAnchor.filePath !== file.newPath) return false;
	const current = lineIndex(line);
	const start = anchorStartIndex(activeCommentAnchor);
	const end = anchorEndIndex(activeCommentAnchor);
	return current >= Math.min(start, end) && current <= Math.max(start, end);
}

function isLineInDraftRange(file: DiffFile, line: DiffLine): boolean {
	const current = lineIndex(line);
	return reviewComments.some((comment) => {
		if (comment.filePath !== file.newPath || comment.status !== "draft") return false;
		const start = anchorStartIndex(comment);
		const end = anchorEndIndex(comment);
		return current >= Math.min(start, end) && current <= Math.max(start, end);
	});
}

function renderDiffLine(file: DiffFile, line: DiffLine): HTMLElement {
	const row = document.createElement("div");
	row.className = `diff-line ${line.type}`;
	row.classList.toggle("line-range-active", isLineInActiveRange(file, line));
	row.classList.toggle("line-range-draft", isLineInDraftRange(file, line));
	const oldLine = document.createElement("span");
	oldLine.className = "diff-line-number";
	oldLine.textContent = line.oldLine === undefined ? "" : String(line.oldLine);
	const newLine = document.createElement("span");
	newLine.className = "diff-line-number";
	newLine.textContent = line.newLine === undefined ? "" : String(line.newLine);
	const marker = document.createElement("span");
	marker.className = "diff-line-marker";
	marker.textContent = line.type === "add" ? "+" : line.type === "delete" ? "-" : " ";
	const text = document.createElement("code");
	text.className = "diff-line-text";
	text.textContent = line.text || " ";
	const action = document.createElement("span");
	action.className = "diff-line-action";
	const addComment = document.createElement("button");
	addComment.type = "button";
	addComment.className = "diff-add-comment-button";
	addComment.textContent = "+";
	addComment.title = "Add comment";
	addComment.addEventListener("mousedown", (event) => {
		if (event.button !== 0) return;
		event.preventDefault();
		rangeSelectStart = {
			filePath: file.newPath,
			oldLine: line.oldLine,
			newLine: line.newLine,
			side: line.type === "delete" ? "old" : "new",
		};
		activeCommentAnchor = {
			filePath: file.newPath,
			side: rangeSelectStart.side,
			startOldLine: line.oldLine,
			startNewLine: line.newLine,
			endOldLine: line.oldLine,
			endNewLine: line.newLine,
		};
		updateRangeHighlighting(file);
	});
	action.append(addComment);
	row.addEventListener("mouseenter", () => {
		if (!rangeSelectStart || rangeSelectStart.filePath !== file.newPath) return;
		const start = rangeSelectStart.newLine ?? rangeSelectStart.oldLine ?? 0;
		const end = line.newLine ?? line.oldLine ?? 0;
		if (start <= end) {
			activeCommentAnchor = {
				filePath: file.newPath,
				side: rangeSelectStart.side,
				startOldLine: rangeSelectStart.oldLine,
				startNewLine: rangeSelectStart.newLine,
				endOldLine: line.oldLine,
				endNewLine: line.newLine,
			};
		} else {
			activeCommentAnchor = {
				filePath: file.newPath,
				side: rangeSelectStart.side,
				startOldLine: line.oldLine,
				startNewLine: line.newLine,
				endOldLine: rangeSelectStart.oldLine,
				endNewLine: rangeSelectStart.newLine,
			};
		}
		updateRangeHighlighting(file);
	});
	row.append(oldLine, newLine, marker, action, text);
	diffLineMetadata.set(row, { file, line });
	return row;
}

function updateRangeHighlighting(file: DiffFile): void {
	for (const row of reviewContent.querySelectorAll<HTMLElement>(".diff-line")) {
		const metadata = diffLineMetadata.get(row);
		if (!metadata || metadata.file.newPath !== file.newPath) continue;
		row.classList.toggle("line-range-active", isLineInActiveRange(metadata.file, metadata.line));
	}
}

function commentRangeLabel(anchor: ReviewCommentAnchor, prefix: string): string {
	const side = anchor.side === "old" ? "L" : "R";
	const start = anchor.side === "old" ? anchor.startOldLine : anchor.startNewLine;
	const end = anchor.side === "old" ? anchor.endOldLine : anchor.endNewLine;
	if (start !== undefined && end !== undefined && start !== end) return `${prefix} ${side}${start}-${side}${end}`;
	return `${prefix} ${side}${start ?? end ?? ""}`.trim();
}

function createCommentBox(file: DiffFile): HTMLElement {
	const box = document.createElement("div");
	box.className = "review-comment-box";
	const header = document.createElement("div");
	header.className = "review-comment-header";
	const label = document.createElement("span");
	label.className = "review-comment-label";
	label.textContent = "Local comment";
	const anchor = document.createElement("span");
	anchor.className = "review-comment-anchor";
	anchor.textContent = activeCommentAnchor ? commentRangeLabel(activeCommentAnchor, "Comment on") : "Comment";
	header.append(label, anchor);
	box.append(header);

	const textarea = document.createElement("textarea");
	textarea.className = "review-comment-textarea";
	textarea.placeholder = "Request change";
	textarea.rows = 3;
	box.append(textarea);

	const actions = document.createElement("div");
	actions.className = "review-comment-actions";
	const cancel = document.createElement("button");
	cancel.type = "button";
	cancel.className = "review-btn-cancel";
	cancel.textContent = "Cancel";
	cancel.addEventListener("click", () => {
		activeCommentAnchor = undefined;
		if (reviewDiffData) renderReview(reviewDiffData);
	});
	const submit = document.createElement("button");
	submit.type = "button";
	submit.className = "review-btn-submit";
	submit.textContent = "Comment";
	submit.disabled = true;
	textarea.addEventListener("input", () => {
		submit.disabled = textarea.value.trim().length === 0;
	});
	submit.addEventListener("click", () => {
		const body = textarea.value.trim();
		if (body) saveDraftComment(file, body);
	});
	actions.append(cancel, submit);
	box.append(actions);

	requestAnimationFrame(() => textarea.focus());
	textarea.addEventListener("keydown", (event) => {
		if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			const body = textarea.value.trim();
			if (body) saveDraftComment(file, body);
		}
		if (event.key === "Escape") {
			activeCommentAnchor = undefined;
			if (reviewDiffData) renderReview(reviewDiffData);
		}
	});
	return box;
}

function saveDraftComment(file: DiffFile, body: string): void {
	if (!activeCommentAnchor) return;
	reviewComments.push({
		...activeCommentAnchor,
		id: `rc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		filePath: file.newPath,
		body,
		status: "draft",
		createdAt: Date.now(),
	});
	persistReviewComments();
	activeCommentAnchor = undefined;
	if (reviewDiffData) renderReview(reviewDiffData);
	renderReviewCommentsBadge();
	syncSendButtonState();
}

function removeDraftComment(commentId: string): void {
	reviewComments = reviewComments.filter((comment) => comment.id !== commentId);
	persistReviewComments();
	if (reviewDiffData) renderReview(reviewDiffData);
	renderReviewCommentsBadge();
	syncSendButtonState();
}

function renderDraftComment(comment: ReviewDraftComment): HTMLElement {
	const element = document.createElement("div");
	element.className = "review-draft-comment";
	const header = document.createElement("div");
	header.className = "review-draft-header";
	const range = document.createElement("span");
	range.className = "review-draft-range";
	range.textContent = commentRangeLabel(comment, "");
	header.append(range);
	const body = document.createElement("div");
	body.className = "review-draft-body";
	body.textContent = comment.body;
	const actions = document.createElement("div");
	actions.className = "review-draft-actions";
	const remove = document.createElement("button");
	remove.type = "button";
	remove.className = "review-draft-remove";
	remove.textContent = "Remove";
	remove.addEventListener("click", () => removeDraftComment(comment.id));
	actions.append(remove);
	element.append(header, body, actions);
	return element;
}

function renderReviewCommentsBadge(): void {
	const drafts = getDraftComments();
	reviewCommentsBadge.hidden = drafts.length === 0;
	if (drafts.length === 0) {
		reviewCommentsBadge.replaceChildren();
		return;
	}
	reviewCommentsBadge.innerHTML = `
		<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
		<span>${drafts.length} comment${drafts.length === 1 ? "" : "s"}</span>
	`;
}

function buildAllCommentsPrompt(extraMessage: string): string {
	const drafts = getDraftComments();
	if (drafts.length === 0) return extraMessage;
	const parts: string[] = [];
	if (drafts.length === 1) {
		const comment = drafts[0]!;
		const start = comment.side === "old" ? comment.startOldLine : comment.startNewLine;
		const end = comment.side === "old" ? comment.endOldLine : comment.endNewLine;
		let heading = `Review comment on ${comment.filePath}`;
		if (start !== undefined && end !== undefined && start !== end) heading += ` lines ${start}-${end}`;
		else if (start !== undefined) heading += ` line ${start}`;
		parts.push(`${heading}:\n\n${comment.body}`);
	} else {
		parts.push(
			`${drafts.length} review comments:\n\n${drafts
				.map((comment, index) => {
					const start = comment.side === "old" ? comment.startOldLine : comment.startNewLine;
					const end = comment.side === "old" ? comment.endOldLine : comment.endNewLine;
					let location = comment.filePath;
					if (start !== undefined && end !== undefined && start !== end) location += ` lines ${start}-${end}`;
					else if (start !== undefined) location += ` line ${start}`;
					return `${index + 1}. **${location}**: ${comment.body}`;
				})
				.join("\n")}`,
		);
	}

	if (reviewDiffData) {
		const contextBlocks: string[] = [];
		const seen = new Set<string>();
		for (const comment of drafts) {
			const file = reviewDiffData.files.find((candidate) => candidate.newPath === comment.filePath);
			if (!file) continue;
			const key = `${comment.filePath}:${anchorStartIndex(comment)}:${anchorEndIndex(comment)}`;
			if (seen.has(key)) continue;
			seen.add(key);
			const lines = getLinesForComment(file, comment);
			if (lines.length === 0) continue;
			contextBlocks.push(
				[
					"```diff",
					`--- a/${file.oldPath}`,
					`+++ b/${file.newPath}`,
					...lines.map((line) => `${line.type === "add" ? "+" : line.type === "delete" ? "-" : " "}${line.text}`),
					"```",
				].join("\n"),
			);
		}
		if (contextBlocks.length > 0) parts.push(`Diff context:\n${contextBlocks.join("\n\n")}`);
	}
	if (extraMessage) parts.push(extraMessage);
	return parts.join("\n\n");
}

function getLinesForComment(file: DiffFile, comment: ReviewDraftComment): DiffLine[] {
	const start = anchorStartIndex(comment);
	const end = anchorEndIndex(comment);
	const result: DiffLine[] = [];
	for (const hunk of file.hunks) {
		for (const line of hunk.lines) {
			const current = lineIndex(line);
			if (current >= Math.min(start, end) && current <= Math.max(start, end)) result.push(line);
		}
	}
	if (result.length > 0) return result;
	for (const hunk of file.hunks) {
		const hunkStart = hunk.newStart;
		const hunkEnd = hunk.newStart + hunk.newLines - 1;
		if (hunkEnd >= Math.min(start, end) && hunkStart <= Math.max(start, end)) return hunk.lines;
	}
	return [];
}

function markDraftCommentsSubmitted(): void {
	reviewComments = reviewComments.filter((comment) => comment.status !== "draft");
	persistReviewComments();
	activeCommentAnchor = undefined;
	renderReviewCommentsBadge();
	syncSendButtonState();
	if (reviewDiffData && layoutState.rightTab === "review") renderReview(reviewDiffData);
}

function queuedPromptPreview(prompt: DesktopQueuedPrompt): string {
	const text = prompt.text.trim();
	const imageText = prompt.imageCount > 0 ? `${prompt.imageCount} image${prompt.imageCount === 1 ? "" : "s"}` : "";
	if (text && imageText) return `${text} · ${imageText}`;
	return text || imageText || "Queued message";
}

function restoreQueuedPrompt(
	prompt: { text: string; images?: Array<{ type: "image"; data: string; mimeType: string }> } | undefined,
): void {
	if (!prompt) return;
	if (
		(promptInput.value.trim() || composerImages.length > 0 || composerFiles.length > 0) &&
		!confirm("Replace current draft?")
	) {
		return;
	}
	clearComposerAttachments();
	promptInput.value = prompt.text ?? "";
	composerImages = (prompt.images ?? []).map((image) => ({
		id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
		data: image.data,
		mimeType: image.mimeType,
		name: "Queued image",
		objectUrl: `data:${image.mimeType};base64,${image.data}`,
	}));
	renderComposerAttachments();
	autosizePrompt();
	syncSendButtonState();
	focusComposer();
	promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
}

function renderQueuedPrompts(): void {
	const queuedPrompts = state?.queuedPrompts ?? [];
	queuedPromptList.replaceChildren();
	queuedPromptList.hidden = queuedPrompts.length === 0;
	for (const prompt of queuedPrompts) {
		const item = document.createElement("div");
		item.className = "queued-prompt";
		const meta = document.createElement("div");
		meta.className = "queued-prompt-meta";
		const label = document.createElement("span");
		label.className = "queued-prompt-label";
		label.textContent = "Queued next";
		const preview = document.createElement("span");
		preview.className = "queued-prompt-preview";
		preview.textContent = queuedPromptPreview(prompt);
		meta.append(label, preview);
		const actions = document.createElement("div");
		actions.className = "queued-prompt-actions";
		const steer = document.createElement("button");
		steer.type = "button";
		steer.textContent = "Steer";
		steer.title = "Send this into the current run after the active tool finishes";
		steer.addEventListener("click", async () => {
			try {
				renderState(await window.piDesktop.steerQueuedPrompt(prompt.id));
				showStreamingIndicator();
			} catch (error) {
				showError(error);
			}
		});
		const edit = document.createElement("button");
		edit.type = "button";
		edit.textContent = "Edit";
		edit.addEventListener("click", async () => {
			try {
				const result = await window.piDesktop.takeQueuedPrompt(prompt.id);
				renderState(result.state);
				restoreQueuedPrompt(result.prompt);
			} catch (error) {
				showError(error);
			}
		});
		actions.append(steer, edit);
		item.append(meta, actions);
		queuedPromptList.append(item);
	}
}

function permissionModeLabel(mode: DesktopPermissionMode | undefined): string {
	if (mode === "ask") return "Ask before tools";
	if (mode === "acceptEdits") return "Allow edits";
	return "Full access";
}

function renderPermissionMode(): void {
	const mode = state?.permissionMode ?? "bypassPermissions";
	composerPermissionLabel.textContent = permissionModeLabel(mode);
	composerPermissionButton.dataset.permissionMode = mode;
	for (const item of composerPermissionMenu.querySelectorAll<HTMLButtonElement>("[data-permission-mode]")) {
		const selected = item.dataset.permissionMode === mode;
		item.classList.toggle("selected", selected);
		item.setAttribute("aria-checked", String(selected));
	}
}

function permissionInputPreview(input: unknown): string {
	const rendered = renderToolInput(input).replace(/\s+/g, " ").trim();
	return rendered.length > 180 ? `${rendered.slice(0, 177)}...` : rendered;
}

function renderPermissionRequests(): void {
	const requests = state?.permissionRequests ?? [];
	permissionRequestList.replaceChildren();
	permissionRequestList.hidden = requests.length === 0;
	for (const request of requests) {
		const card = document.createElement("section");
		card.className = "permission-request";
		const icon = document.createElement("div");
		icon.className = "permission-request-icon";
		icon.innerHTML =
			'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 2.8 7.6 7 10 4.2-2.4 7-5.5 7-10V6l-7-3Z" /></svg>';
		const copy = document.createElement("div");
		copy.className = "permission-request-copy";
		const title = document.createElement("strong");
		title.textContent = `Allow ${formatToolLabel(request.toolName)}?`;
		const reason = document.createElement("span");
		reason.textContent = request.reason;
		copy.append(title, reason);
		const previewText = permissionInputPreview(request.toolInput);
		if (previewText) {
			const preview = document.createElement("code");
			preview.textContent = previewText;
			preview.title = renderToolInput(request.toolInput);
			copy.append(preview);
		}
		const actions = document.createElement("div");
		actions.className = "permission-request-actions";
		const replies: Array<[DesktopPermissionReply, string]> = [
			["reject", "Deny"],
			["allowOnce", "Allow once"],
			["allowAlways", `Always allow ${formatToolLabel(request.toolName)}`],
		];
		for (const [reply, label] of replies) {
			const button = document.createElement("button");
			button.type = "button";
			button.dataset.permissionReply = reply;
			button.textContent = label;
			if (reply === "allowOnce") button.className = "primary";
			button.addEventListener("click", async () => {
				for (const action of actions.querySelectorAll<HTMLButtonElement>("button")) action.disabled = true;
				try {
					renderState(await window.piDesktop.resolvePermission(request.id, reply));
				} catch (error) {
					showError(error);
					for (const action of actions.querySelectorAll<HTMLButtonElement>("button")) action.disabled = false;
				}
			});
			actions.append(button);
		}
		copy.append(actions);
		card.append(icon, copy);
		permissionRequestList.append(card);
	}
}

function renderClarificationRequests(): void {
	const requests = state?.clarificationRequests ?? [];
	const activeIds = new Set(requests.map((request) => request.id));
	for (const id of clarificationDraftsById.keys()) {
		if (!activeIds.has(id)) clarificationDraftsById.delete(id);
	}
	clarificationRequestList.replaceChildren();
	clarificationRequestList.hidden = requests.length === 0;
	for (const request of requests) {
		const card = document.createElement("section");
		card.className = "clarification-request";
		const heading = document.createElement("div");
		heading.className = "clarification-request-heading";
		const badge = document.createElement("span");
		badge.textContent = "Input needed";
		const question = document.createElement("strong");
		question.textContent = request.question;
		heading.append(badge, question);

		const form = document.createElement("form");
		form.className = "clarification-request-form";
		const input = document.createElement("input");
		input.type = "text";
		input.placeholder = "Type your answer";
		input.setAttribute("aria-label", request.question);
		input.value = clarificationDraftsById.get(request.id) ?? "";
		const optionButtons: HTMLButtonElement[] = [];
		if (request.options?.length) {
			const options = document.createElement("div");
			options.className = "clarification-options";
			for (const option of request.options) {
				const button = document.createElement("button");
				button.type = "button";
				button.className = "clarification-option";
				button.textContent = option;
				button.setAttribute("aria-pressed", String(input.value === option));
				button.addEventListener("click", () => {
					input.value = option;
					clarificationDraftsById.set(request.id, option);
					for (const candidate of optionButtons) {
						candidate.setAttribute("aria-pressed", String(candidate === button));
					}
					submit.disabled = false;
				});
				optionButtons.push(button);
				options.append(button);
			}
			form.append(options);
		}

		const answerRow = document.createElement("div");
		answerRow.className = "clarification-answer-row";
		const submit = document.createElement("button");
		submit.type = "submit";
		submit.className = "primary";
		submit.textContent = "Continue";
		submit.disabled = !input.value.trim();
		const skip = document.createElement("button");
		skip.type = "button";
		skip.textContent = "Skip";
		input.addEventListener("input", () => {
			clarificationDraftsById.set(request.id, input.value);
			submit.disabled = !input.value.trim();
			for (const candidate of optionButtons) {
				candidate.setAttribute("aria-pressed", String(candidate.textContent === input.value));
			}
		});
		form.addEventListener("submit", async (event) => {
			event.preventDefault();
			const answer = input.value.trim();
			if (!answer) return;
			for (const action of form.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button, input")) {
				action.disabled = true;
			}
			try {
				clarificationDraftsById.delete(request.id);
				renderState(await window.piDesktop.resolveClarification(request.id, answer));
			} catch (error) {
				showError(error);
				for (const action of form.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button, input")) {
					action.disabled = false;
				}
			}
		});
		skip.addEventListener("click", async () => {
			for (const action of form.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button, input")) {
				action.disabled = true;
			}
			try {
				clarificationDraftsById.delete(request.id);
				renderState(await window.piDesktop.rejectClarification(request.id));
			} catch (error) {
				showError(error);
				for (const action of form.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button, input")) {
					action.disabled = false;
				}
			}
		});
		answerRow.append(input, skip, submit);
		form.append(answerRow);
		card.append(heading, form);
		clarificationRequestList.append(card);
	}
}

async function refreshReview(): Promise<void> {
	reviewContent.innerHTML = '<div class="review-empty">Loading diff...</div>';
	try {
		reviewDiffData = await window.piDesktop.getDiff(diffScope(), 3);
		renderReview(reviewDiffData);
	} catch (error) {
		reviewStats.textContent = "";
		reviewContent.innerHTML = '<div class="review-empty">Failed to load diff</div>';
		showError(error);
	}
}

document.addEventListener("mouseup", () => {
	if (!rangeSelectStart) return;
	const started = rangeSelectStart;
	rangeSelectStart = undefined;
	if (!activeCommentAnchor || activeCommentAnchor.filePath !== started.filePath || !reviewDiffData) return;
	renderReview(reviewDiffData);
});

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

async function refreshEnvironment(): Promise<void> {
	renderEnvironment(await window.piDesktop.environmentStatus());
}

async function refreshAfterSessionChange(): Promise<void> {
	await Promise.all([refreshModels(), refreshSessions(), refreshGit(), refreshEnvironment()]);
	renderMessages(await window.piDesktop.getMessages());
}

async function startNewSession(): Promise<void> {
	renderState(await window.piDesktop.newSession());
	await refreshAfterSessionChange();
	focusComposer();
}

async function switchToSession(sessionPath: string): Promise<void> {
	if (switchingSessionPath) return;
	const nextSession = sessions.find((session) => session.path === sessionPath);
	setSessionStatus(nextSession, undefined);
	if (sessionPath === state?.sessionFile) {
		focusComposer();
		renderSessionList();
		return;
	}
	switchingSessionPath = sessionPath;
	messagesEl.classList.add("loading-session");
	renderSessionList();
	try {
		renderState(await window.piDesktop.switchSession(sessionPath));
		sessionRecoveryError = undefined;
		switchingSessionPath = undefined;
		renderSessionList();
		renderMessages(await window.piDesktop.getMessages());
		messagesEl.classList.remove("loading-session");
		focusComposer();
		refreshModels().catch(showError);
		refreshGit().catch(showError);
	} catch (error) {
		sessionRecoveryError = {
			path: sessionPath,
			message: error instanceof Error ? error.message : String(error),
		};
		renderSessionList();
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
	const projectSessions = sessions
		.filter((candidate) => candidate.cwd === session.cwd && !isSessionArchived(candidate))
		.sort((a, b) => modifiedSessionTime(b) - modifiedSessionTime(a));
	const currentIndex = projectSessions.findIndex(
		(candidate) => candidate.id === session.id || candidate.path === session.path,
	);
	return (
		projectSessions.slice(Math.max(0, currentIndex + 1)).find((candidate) => !isActiveSession(candidate)) ??
		projectSessions
			.slice(0, Math.max(0, currentIndex))
			.reverse()
			.find((candidate) => !isActiveSession(candidate))
	);
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

function showToast(text: string, action?: { label: string; onClick: () => void }): void {
	closeComposerMenus();
	closeSettingsPopover();
	let container = document.querySelector<HTMLDivElement>(".toast-container");
	if (!container) {
		container = document.createElement("div");
		container.className = "toast-container";
		document.body.append(container);
	}
	const toast = document.createElement("div");
	toast.className = "toast";
	const message = document.createElement("span");
	message.textContent = text;
	toast.append(message);
	if (action) {
		const actionButton = document.createElement("button");
		actionButton.type = "button";
		actionButton.className = "toast-action";
		actionButton.textContent = action.label;
		actionButton.addEventListener("click", () => {
			action.onClick();
			toast.remove();
		});
		toast.append(actionButton);
	}
	container.append(toast);
	setTimeout(() => toast.classList.add("visible"), 0);
	setTimeout(() => {
		toast.classList.remove("visible");
		setTimeout(() => toast.remove(), 180);
	}, 5200);
}

function showDesktopMessage(labelText: string, text: string, variant: "notice" | "error" = "notice"): void {
	showToast(`${labelText}: ${text}`);
	if (variant === "error") console.error(text);
}

function focusComposer(): void {
	const focus = () => {
		if (state?.authRequired || composer.hidden) return;
		closeComposerMenus();
		closeSettingsPopover();
		promptInput.focus();
		const cursor = promptInput.value.length;
		promptInput.setSelectionRange(cursor, cursor);
	};
	focus();
	requestAnimationFrame(focus);
	setTimeout(focus, 50);
}

function autosizePrompt(): void {
	promptInput.style.height = "auto";
	promptInput.style.height = `${Math.min(promptInput.scrollHeight, 220)}px`;
	keepMessagesPinnedAfterComposerResize();
}

function syncSendButtonState(): void {
	if (isComposerBusy) {
		sendButton.disabled = isAbortingRun || Boolean(state?.authRequired);
		return;
	}
	sendButton.disabled =
		Boolean(state?.authRequired) ||
		(promptInput.value.trim().length === 0 &&
			composerImages.length === 0 &&
			composerFiles.length === 0 &&
			getDraftComments().length === 0);
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
			focusComposer();
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
			focusComposer();
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

function largeTextFromClipboard(event: ClipboardEvent): string {
	const text = event.clipboardData?.getData("text/plain") ?? "";
	return text.length >= pastedTextFileThreshold ? text : "";
}

async function addPastedTextFile(text: string): Promise<void> {
	const selection = await window.piDesktop.createTempTextFile(text);
	addComposerFileSelections([selection]);
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
	focusComposer();
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

async function sendCurrentComposer(mode: "send" | "queue" | "steer" = "send"): Promise<void> {
	const message = promptInput.value.trim();
	const hasDraftComments = getDraftComments().length > 0;
	if (!message && composerImages.length === 0 && composerFiles.length === 0 && !hasDraftComments) return;
	if (message.startsWith("/")) {
		if (mode !== "send" || isComposerBusy) {
			showError("Slash commands cannot be queued or steered.");
			return;
		}
		if (composerImages.length > 0 || composerFiles.length > 0 || hasDraftComments) {
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
	const promptText = buildAllCommentsPrompt(messageWithFileContext(message));
	clearComposerAttachments();
	autosizePrompt();
	setBusy(true);
	const optimisticMessageId = mode === "send" ? appendOptimisticUserMessage(promptText, images) : undefined;
	if (mode !== "queue") showStreamingIndicator();
	try {
		const payload = { text: promptText, images };
		renderState(
			await (mode === "queue"
				? window.piDesktop.queuePrompt(payload)
				: mode === "steer"
					? window.piDesktop.steerPrompt(payload)
					: window.piDesktop.prompt(payload)),
		);
		if (hasDraftComments) markDraftCommentsSubmitted();
		await refreshSessions();
	} catch (error) {
		if (optimisticMessageId) removeOptimisticUserMessage(optimisticMessageId);
		showError(error);
		setBusy(Boolean(state?.isStreaming));
	}
}

composer.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (isComposerBusy) {
		await abortCurrentRun();
		return;
	}
	await sendCurrentComposer();
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
	if (event.key !== "Enter" || event.shiftKey || event.altKey || event.isComposing) {
		return;
	}
	event.preventDefault();
	sendCurrentComposer(event.metaKey || event.ctrlKey ? "steer" : isComposerBusy ? "queue" : "send").catch(showError);
});

promptInput.addEventListener("input", () => {
	autosizePrompt();
	syncSendButtonState();
	syncComposerHint();
	renderSlashCommandMenu();
});

promptInput.addEventListener("paste", (event) => {
	const files = imageFilesFromClipboard(event);
	if (files.length > 0) {
		event.preventDefault();
		addComposerImageFiles(files).catch(showError);
		return;
	}
	const largeText = largeTextFromClipboard(event);
	if (!largeText) return;
	event.preventDefault();
	addPastedTextFile(largeText).catch(showError);
});

messagesEl.addEventListener("scroll", () => {
	shouldFollowMessages = isMessagesScrolledToBottom();
});

messagesEl.addEventListener("click", (event) => {
	if (event.defaultPrevented) return;
	const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : undefined;
	if (!anchor || !messagesEl.contains(anchor) || !isSupportedLinkHref(anchor.href)) return;
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
			await startNewSession();
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

toggleEnvironmentCardButton.addEventListener("click", (event) => {
	event.stopPropagation();
	setEnvironmentPopoverOpen(environmentPopover.hidden);
});

environmentPopover.addEventListener("click", (event) => {
	event.stopPropagation();
});

document.addEventListener("click", () => setEnvironmentPopoverOpen(false));

// Right panel tabs and terminal/browser panes
const terminalDefaultFontSize = 13;
const terminalMinFontSize = 10;
const terminalMaxFontSize = 24;
const terminalFontSizeStorageKey = "pi.desktop.terminalFontSize";

type TerminalContext = {
	created: boolean;
	fitAddon: FitAddon;
	focusListenersAttached: boolean;
	fontSize: number;
	id: string;
	resizeObserver?: ResizeObserver;
	term: Terminal;
};

const terminalContexts = new Map<string, TerminalContext>();
let didSubscribeTerminalIpc = false;

function terminalFontSizeKey(terminalId: string): string {
	return `${terminalFontSizeStorageKey}.${terminalId}`;
}

function loadTerminalFontSize(terminalId: string): number {
	const saved = Number(localStorage.getItem(terminalFontSizeKey(terminalId)));
	return Number.isFinite(saved) ? clamp(saved, terminalMinFontSize, terminalMaxFontSize) : terminalDefaultFontSize;
}

function rightPanelTabFromDataset(button: HTMLButtonElement): RightPanelTab | undefined {
	const tab = button.dataset.rightPanelTab;
	return isRightPanelTab(tab) ? tab : undefined;
}

function bottomPanelTabFromDataset(button: HTMLButtonElement): WindowPanelTab | undefined {
	const tab = button.dataset.bottomPanelTab;
	return isWindowPanelTab(tab) ? tab : undefined;
}

function resizeTerminal(terminalId?: string): void {
	const contexts = terminalId
		? [terminalContexts.get(terminalId)].filter((context): context is TerminalContext => Boolean(context))
		: [...terminalContexts.values()];
	for (const context of contexts) {
		if (!context.term || !context.fitAddon || context.term.element?.offsetParent === null) continue;
		context.fitAddon.fit();
		if (context.term.cols > 0 && context.term.rows > 0) {
			window.piDesktop.terminalResize(context.id, context.term.cols, context.term.rows);
		}
	}
}

function terminalZoomDelta(event: KeyboardEvent): number {
	if (!event.metaKey || event.ctrlKey || event.altKey) return 0;
	if (event.key === "+" || event.key === "=" || event.code === "NumpadAdd") return 1;
	if (event.key === "-" || event.key === "_" || event.code === "NumpadSubtract") return -1;
	return 0;
}

function setTerminalFontSize(context: TerminalContext, fontSize: number): void {
	const nextFontSize = clamp(fontSize, terminalMinFontSize, terminalMaxFontSize);
	if (nextFontSize === context.fontSize) return;
	context.fontSize = nextFontSize;
	localStorage.setItem(terminalFontSizeKey(context.id), String(nextFontSize));
	context.term.options.fontSize = nextFontSize;
	requestAnimationFrame(() => {
		resizeTerminal(context.id);
		context.term.refresh(0, context.term.rows - 1);
	});
}

function subscribeTerminalIpc(): void {
	if (didSubscribeTerminalIpc) return;
	didSubscribeTerminalIpc = true;
	window.piDesktop.onTerminalZoom((terminalId, delta) => {
		const context = terminalContexts.get(terminalId);
		if (context) setTerminalFontSize(context, context.fontSize + delta);
	});
	window.piDesktop.onTerminalData((terminalId, data) => {
		const context = terminalContexts.get(terminalId);
		if (data.includes("[terminal exited:") && context) {
			context.created = false;
		}
		context?.term.write(data);
	});
}

function createTerminalContext(id: string): TerminalContext {
	const existingContext = terminalContexts.get(id);
	if (existingContext) return existingContext;
	subscribeTerminalIpc();
	const fontSize = loadTerminalFontSize(id);
	const term = new Terminal({
		fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
		fontSize,
		lineHeight: 1.35,
		cursorBlink: true,
		theme: {
			background: "#151515",
			foreground: "#d4d4d4",
			cursor: "#d4d4d4",
			selectionBackground: "#264f78",
		},
	});
	const fitAddon = new FitAddon();
	const context: TerminalContext = {
		created: false,
		fitAddon,
		focusListenersAttached: false,
		fontSize,
		id,
		term,
	};
	terminalContexts.set(id, context);
	term.loadAddon(fitAddon);
	term.attachCustomKeyEventHandler((event) => {
		if (event.type !== "keydown") return true;
		const delta = terminalZoomDelta(event);
		if (delta === 0) return true;
		event.preventDefault();
		event.stopPropagation();
		setTerminalFontSize(context, context.fontSize + delta);
		return false;
	});
	term.onData(async (data) => {
		if (!context.created) {
			if (data !== "\r" && data !== "\n") return;
			context.created = true;
			try {
				await window.piDesktop.terminalCreate(context.id);
			} catch (error) {
				context.created = false;
				showError(error);
			}
			return;
		}
		window.piDesktop.terminalWrite(context.id, data);
	});
	return context;
}

function attachTerminalFocusListeners(context: TerminalContext): void {
	if (!context.term.element || context.focusListenersAttached) return;
	context.focusListenersAttached = true;
	context.term.element.addEventListener("focusin", () => {
		window.piDesktop.terminalFocus(context.id, true);
	});
	context.term.element.addEventListener("focusout", (event) => {
		if (event.relatedTarget instanceof Node && context.term.element?.contains(event.relatedTarget)) return;
		window.piDesktop.terminalFocus(context.id, false);
	});
}

window.addEventListener("beforeunload", () => {
	window.piDesktop.terminalDestroyAll();
});

function mountTerminal(terminalId: string, host: HTMLElement): void {
	const context = createTerminalContext(terminalId);
	if (context.term.element) {
		host.append(context.term.element);
	} else {
		context.term.open(host);
	}
	attachTerminalFocusListeners(context);
	if (!context.resizeObserver) {
		context.resizeObserver = new ResizeObserver(() => resizeTerminal(context.id));
		context.resizeObserver.observe(host);
	}
	if (!context.created) {
		context.created = true;
		window.piDesktop.terminalCreate(context.id).catch((error) => {
			context.created = false;
			showError(error);
		});
	}
	setTimeout(() => {
		resizeTerminal(context.id);
		context.term.refresh(0, context.term.rows - 1);
		context.term.focus();
	}, 0);
	setTimeout(() => resizeTerminal(context.id), 100);
}

function isBlankBrowserUrl(value: unknown): boolean {
	const trimmed = String(value ?? "").trim();
	return !trimmed || trimmed === "about:blank";
}

function browserTargetUrl(input: HTMLInputElement): string {
	return isBlankBrowserUrl(input.value) ? browserHomeUrl : input.value;
}

function openBrowserUrl(
	value: string,
	input: HTMLInputElement,
	frame: HTMLElement,
	options: { forceReload?: boolean } = {},
): void {
	const trimmed = isBlankBrowserUrl(value) ? browserHomeUrl : value.trim();
	const url = new URL(isBrowserUrl(trimmed) ? trimmed : `https://${trimmed}`);
	input.value = url.href;
	if (options.forceReload && frame.getAttribute("src") === url.href) {
		frame.setAttribute("src", "about:blank");
		requestAnimationFrame(() => frame.setAttribute("src", url.href));
		return;
	}
	frame.setAttribute("src", url.href);
}

function browserFrameUrl(frame: HTMLElement): string | null {
	try {
		const candidate = frame as HTMLElement & { getURL?: () => string };
		return typeof candidate.getURL === "function" ? candidate.getURL() : frame.getAttribute("src");
	} catch {
		return frame.getAttribute("src");
	}
}

function ensureBrowserLoaded(input: HTMLInputElement, frame: HTMLElement): void {
	const src = frame.getAttribute("src");
	const currentUrl = browserFrameUrl(frame);
	if (isBlankBrowserUrl(src) || isBlankBrowserUrl(currentUrl)) {
		openBrowserUrl(browserTargetUrl(input), input, frame, { forceReload: true });
	}
}

function setupBrowserFrame(input: HTMLInputElement, frame: HTMLElement): void {
	const syncInputUrl = (url: unknown): void => {
		if (!isBlankBrowserUrl(url)) input.value = String(url);
	};
	frame.addEventListener("did-navigate", (event) => {
		syncInputUrl((event as Event & { url?: string }).url);
	});
	frame.addEventListener("did-navigate-in-page", (event) => {
		syncInputUrl((event as Event & { url?: string }).url);
	});
	frame.addEventListener("did-fail-load", (event) => {
		const failure = event as Event & { errorCode?: number; isMainFrame?: boolean };
		if (failure.errorCode === -3 || failure.isMainFrame === false) return;
		setTimeout(() => openBrowserUrl(browserTargetUrl(input), input, frame, { forceReload: true }), 250);
	});
	frame.addEventListener("render-process-gone", () => {
		setTimeout(() => openBrowserUrl(browserTargetUrl(input), input, frame, { forceReload: true }), 250);
	});
	frame.addEventListener("did-stop-loading", () => {
		setTimeout(() => ensureBrowserLoaded(input, frame), 250);
	});
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
		mountTerminal("right", rightTerminalContainer);
	} else if (layoutState.rightTab === "browser") {
		ensureBrowserLoaded(browserUrlInput, browserFrame);
	} else if (layoutState.rightTab === "review") {
		refreshReview().catch(showError);
	}
}

function syncBottomPanelContent(): void {
	if (layoutState.bottomCollapsed) return;
	if (layoutState.bottomTab === "terminal") {
		mountTerminal("bottom", terminalContainer);
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

browserHomeButton.addEventListener("click", () => {
	try {
		openBrowserUrl(browserHomeUrl, browserUrlInput, browserFrame);
	} catch (error) {
		showError(error);
	}
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

bottomBrowserHomeButton.addEventListener("click", () => {
	try {
		openBrowserUrl(browserHomeUrl, bottomBrowserUrlInput, bottomBrowserFrame);
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

setupBrowserFrame(browserUrlInput, browserFrame);
setupBrowserFrame(bottomBrowserUrlInput, bottomBrowserFrame);

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

document.addEventListener("keydown", (event) => {
	if ((event.metaKey || event.ctrlKey) && event.key === "j") {
		event.preventDefault();
		toggleBottomPanel();
		return;
	}
	if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "n") {
		event.preventDefault();
		startNewSession().catch(showError);
		return;
	}
	if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "k") {
		event.preventDefault();
		sessionSearchInput.focus();
		sessionSearchInput.select();
		return;
	}
	if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "/") {
		event.preventDefault();
		const levels = state?.availableThinkingLevels ?? ["low", "medium", "high", "xhigh"];
		if (levels.length === 0) return;
		const current = (state?.thinkingLevel ?? "medium").toLowerCase();
		const currentIndex = levels.indexOf(current);
		const next = levels[(currentIndex + 1) % levels.length]!;
		window.piDesktop.setThinkingLevel(next).then(renderState).catch(showError);
		return;
	}
	if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key === "/") {
		event.preventDefault();
		toggleComposerMenu(composerModelButton, composerModelMenu);
		if (!composerModelMenu.hidden) {
			composerModelMenu.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
		}
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

composerContextUsageButton.addEventListener("mousedown", (event) => {
	event.preventDefault();
	event.stopPropagation();
	toggleComposerMenu(composerContextUsageButton, composerContextUsageMenu);
});

composerContextUsageButton.addEventListener("click", (event) => {
	event.stopPropagation();
	if (event.detail === 0) {
		toggleComposerMenu(composerContextUsageButton, composerContextUsageMenu);
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

composerPermissionButton.addEventListener("mousedown", (event) => {
	event.preventDefault();
	event.stopPropagation();
	toggleComposerMenu(composerPermissionButton, composerPermissionMenu);
});

composerPermissionButton.addEventListener("click", (event) => {
	event.stopPropagation();
	if (event.detail === 0) {
		toggleComposerMenu(composerPermissionButton, composerPermissionMenu);
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

composerPermissionMenu.addEventListener("click", async (event) => {
	event.stopPropagation();
	const button = (event.target as Element).closest<HTMLButtonElement>("[data-permission-mode]");
	const mode = button?.dataset.permissionMode;
	if (mode !== "ask" && mode !== "acceptEdits" && mode !== "bypassPermissions") return;
	try {
		renderState(await window.piDesktop.setPermissionMode(mode));
		closeComposerMenus();
	} catch (error) {
		showError(error);
	}
});

composerModelMenu.addEventListener("click", (event) => {
	event.stopPropagation();
});

composerContextUsageMenu.addEventListener("click", (event) => {
	event.stopPropagation();
});

composerCompactContext.addEventListener("click", async () => {
	if (composerCompactContext.disabled) return;
	closeComposerMenus();
	setBusy(true);
	upsertSessionNotice("compaction", "Preparing more context · compacting...", "running");
	try {
		renderState(await window.piDesktop.compact());
		renderMessages(await window.piDesktop.getMessages());
	} catch (error) {
		showError(error);
	} finally {
		setBusy(Boolean(state?.isStreaming));
	}
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
			composerPermissionButton.contains(event.target) ||
			composerPermissionMenu.contains(event.target) ||
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
		focusComposer();
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

refreshEnvironmentButton.addEventListener("click", () => {
	refreshEnvironment().catch(showError);
});

refreshReviewButton.addEventListener("click", () => {
	refreshReview().catch(showError);
});

reviewScopeSelect.addEventListener("change", () => {
	refreshReview().catch(showError);
});

refreshSessionsButton.addEventListener("click", () => {
	refreshSessions().catch(showError);
});

sessionSearchInput.addEventListener("input", () => {
	renderSessionList();
});

sessionSearchInput.addEventListener("keydown", (event) => {
	if (event.key !== "Escape") return;
	event.stopPropagation();
	sessionSearchInput.value = "";
	renderSessionList();
	focusComposer();
});

addProjectButton.addEventListener("click", async () => {
	try {
		const selections = await window.piDesktop.chooseContext("folder");
		const folder = selections.find((selection): selection is Extract<DesktopContextSelection, { type: "path" }> => {
			return selection.type === "path";
		});
		if (!folder) return;
		renderState(await window.piDesktop.setCwd(folder.path));
		renderState(await window.piDesktop.newSession());
		await refreshAfterSessionChange();
		focusComposer();
	} catch (error) {
		showError(error);
	}
});

composerWorkspaceButton.addEventListener("click", async () => {
	try {
		const selections = await window.piDesktop.chooseContext("folder");
		const folder = selections.find((selection): selection is Extract<DesktopContextSelection, { type: "path" }> => {
			return selection.type === "path";
		});
		if (!folder) return;
		renderState(await window.piDesktop.setCwd(folder.path));
		await refreshAfterSessionChange();
		focusComposer();
	} catch (error) {
		showError(error);
	}
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
window.piDesktop.onEnvironmentStatus(renderEnvironment);
window.piDesktop.onEvent((event) => {
	const typed = event as { type?: string; aborted?: boolean; errorMessage?: string } & DesktopToolExecutionEndEvent;
	if (typed.type === "desktop_session_status") {
		updateSessionRunningStatus(event as DesktopSessionStatusEvent);
	}
	if (typed.type === "desktop_environment_status") {
		const status = (event as { status?: DesktopEnvironmentStatus }).status;
		if (status) renderEnvironment(status);
	}
	if (typed.type === "agent_start") {
		activeAgentRun = true;
		const active = activeSession();
		if (active) {
			active.isRunning = true;
			setSessionStatus(active, "running");
		}
		setBusy(true);
		renderSessionList();
	}
	if (typed.type === "tool_execution_start" && typed.toolCallId) {
		activeToolExecutions.add(typed.toolCallId);
		setBusy(true);
		hideStreamingIndicator();
	}
	if (typed.type === "tool_execution_end" && typed.toolCallId) {
		activeToolExecutions.delete(typed.toolCallId);
		completedToolExecutions.set(typed.toolCallId, { isError: typed.isError === true });
		setBusy(isRunActive());
		window.piDesktop.getMessages().then(renderMessages).catch(showError);
	}
	if (typed.type === "agent_end") {
		if ((event as { willRetry?: boolean }).willRetry) {
			setBusy(true);
			return;
		}
		activeAgentRun = false;
		activeToolExecutions.clear();
		const active = activeSession();
		if (active) {
			active.isRunning = false;
			setSessionStatus(active, undefined);
		}
		setBusy(isRunActive());
		renderSessionList();
		Promise.all([
			refreshGit(),
			refreshSessions(),
			!environmentPopover.hidden ? refreshEnvironment() : Promise.resolve(),
		]).catch(showError);
	}
	if (typed.type === "compaction_end") {
		const text = typed.aborted
			? "Context compaction stopped"
			: typed.errorMessage
				? `Context compaction failed · ${typed.errorMessage}`
				: "Context compacted";
		upsertSessionNotice("compaction", text, typed.aborted || typed.errorMessage ? "error" : "complete");
	}
});

async function boot(): Promise<void> {
	try {
		applyLayoutState();
		syncResponsiveLayout();
		syncRightPanelContent();
		syncBottomPanelContent();
		applyTheme();
		renderState(await window.piDesktop.init());
		void refreshCurrentUser();
		await refreshAfterSessionChange();
	} finally {
		startupLoading.hidden = true;
	}
}

boot().catch(showError);

setInterval(() => {
	if (!environmentPopover.hidden) {
		refreshEnvironment().catch(showError);
	}
}, 30_000);
