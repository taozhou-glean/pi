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

type PiDesktopApi = {
	init(): Promise<DesktopState>;
	getState(): Promise<DesktopState>;
	getMessages(): Promise<DesktopMessage[]>;
	listSessions(): Promise<DesktopSessionInfo[]>;
	newSession(): Promise<DesktopState>;
	switchSession(sessionPath: string): Promise<DesktopState>;
	prompt(message: string): Promise<DesktopState>;
	abort(): Promise<DesktopState>;
	setCwd(cwd: string): Promise<DesktopState>;
	listModels(): Promise<DesktopModel[]>;
	setModel(provider: string, id: string): Promise<DesktopState>;
	gitStatus(): Promise<GitStatus>;
	onState(handler: (state: DesktopState) => void): () => void;
	onMessages(handler: (messages: DesktopMessage[]) => void): () => void;
	onEvent(handler: (event: unknown) => void): () => void;
};

declare global {
	interface Window {
		piDesktop: PiDesktopApi;
		__piDesktopTest?: {
			renderMessages(messages: DesktopMessage[]): void;
		};
	}
}

const cwdInput = document.querySelector<HTMLInputElement>("#cwd-input")!;
const changeCwdButton = document.querySelector<HTMLButtonElement>("#change-cwd")!;
const newSessionButton = document.querySelector<HTMLButtonElement>("#new-session")!;
const appEl = document.querySelector<HTMLDivElement>("#app")!;
const toggleLeftPanelButton = document.querySelector<HTMLButtonElement>("#toggle-left-panel")!;
const toggleRightPanelButton = document.querySelector<HTMLButtonElement>("#toggle-right-panel")!;
const leftResizer = document.querySelector<HTMLDivElement>("#left-resizer")!;
const rightResizer = document.querySelector<HTMLDivElement>("#right-resizer")!;
const refreshSessionsButton = document.querySelector<HTMLButtonElement>("#refresh-sessions")!;
const sessionList = document.querySelector<HTMLDivElement>("#session-list")!;
const modelSelect = document.querySelector<HTMLSelectElement>("#model-select")!;
const modelMeta = document.querySelector<HTMLDivElement>("#model-meta")!;
const themeSelect = document.querySelector<HTMLSelectElement>("#theme-select")!;
const gitBranch = document.querySelector<HTMLDivElement>("#git-branch")!;
const gitStatus = document.querySelector<HTMLDivElement>("#git-status")!;
const refreshGitButton = document.querySelector<HTMLButtonElement>("#refresh-git")!;
const sessionTitle = document.querySelector<HTMLDivElement>("#session-title")!;
const sessionMeta = document.querySelector<HTMLDivElement>("#session-meta")!;
const runState = document.querySelector<HTMLDivElement>("#run-state")!;
const workspaceName = document.querySelector<HTMLElement>("#workspace-name")!;
const sessionShortId = document.querySelector<HTMLElement>("#session-short-id")!;
const messageCount = document.querySelector<HTMLElement>("#message-count")!;
const queueCount = document.querySelector<HTMLElement>("#queue-count")!;
const contextSummary = document.querySelector<HTMLDivElement>("#context-summary")!;
const messagesEl = document.querySelector<HTMLElement>("#messages")!;
const composer = document.querySelector<HTMLFormElement>("#composer")!;
const promptInput = document.querySelector<HTMLTextAreaElement>("#prompt")!;
const sendButton = document.querySelector<HTMLButtonElement>("#send")!;
const abortButton = document.querySelector<HTMLButtonElement>("#abort")!;

let state: DesktopState | undefined;
let models: DesktopModel[] = [];
let sessions: DesktopSessionInfo[] = [];
const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
const themeStorageKey = "pi-desktop-theme";
const layoutStorageKey = "pi-desktop-layout";
const minLeftPanelWidth = 220;
const maxLeftPanelWidth = 520;
const minRightPanelWidth = 240;
const maxRightPanelWidth = 560;

type ThemePreference = "system" | "light" | "dark";

type LayoutState = {
	leftWidth: number;
	rightWidth: number;
	leftCollapsed: boolean;
	rightCollapsed: boolean;
};

const layoutState: LayoutState = loadLayoutState();

document.body.dataset.platform = navigator.platform.toLowerCase().includes("mac") ? "mac" : "other";

function getThemePreference(): ThemePreference {
	const saved = localStorage.getItem(themeStorageKey);
	return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
}

function applyTheme(preference: ThemePreference = getThemePreference()): void {
	const resolved = preference === "system" ? (themeMedia.matches ? "dark" : "light") : preference;
	document.body.dataset.theme = resolved;
	themeSelect.value = preference;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function loadLayoutState(): LayoutState {
	try {
		const parsed = JSON.parse(localStorage.getItem(layoutStorageKey) ?? "{}") as Partial<LayoutState>;
		return {
			leftWidth: clamp(Number(parsed.leftWidth) || 300, minLeftPanelWidth, maxLeftPanelWidth),
			rightWidth: clamp(Number(parsed.rightWidth) || 320, minRightPanelWidth, maxRightPanelWidth),
			leftCollapsed: parsed.leftCollapsed === true,
			rightCollapsed: parsed.rightCollapsed === true,
		};
	} catch {
		return { leftWidth: 300, rightWidth: 320, leftCollapsed: false, rightCollapsed: false };
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
	appEl.classList.toggle("left-collapsed", layoutState.leftCollapsed);
	appEl.classList.toggle("right-collapsed", layoutState.rightCollapsed);
	toggleLeftPanelButton.setAttribute("aria-pressed", String(!layoutState.leftCollapsed));
	toggleRightPanelButton.setAttribute("aria-pressed", String(!layoutState.rightCollapsed));
}

function setPanelWidth(side: "left" | "right", width: number): void {
	if (side === "left") {
		layoutState.leftWidth = clamp(width, minLeftPanelWidth, maxLeftPanelWidth);
		layoutState.leftCollapsed = false;
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

function setBusy(isBusy: boolean): void {
	sendButton.disabled = isBusy;
	abortButton.disabled = !isBusy;
	sendButton.textContent = isBusy ? "Working" : "Send";
	runState.textContent = isBusy ? "Running" : "Idle";
	runState.className = `run-state ${isBusy ? "running" : "idle"}`;
}

function roleLabel(role: string): string {
	if (role === "toolResult") return "Tool result";
	if (role === "assistant") return "Pi";
	if (role === "user") return "You";
	if (role === "custom") return "Context";
	return role;
}

function appendInlineMarkdown(parent: HTMLElement, text: string): void {
	const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
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
		} else {
			const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(raw);
			const href = linkMatch?.[2] ?? "";
			if (/^https?:\/\//i.test(href)) {
				const link = document.createElement("a");
				link.href = href;
				link.target = "_blank";
				link.rel = "noreferrer";
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

	for (const line of lines) {
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
		.filter(
			(block): block is Extract<DesktopContent, { type: "text" | "thinking" }> =>
				block.type === "text" || block.type === "thinking",
		)
		.map((block) => block.text)
		.filter(Boolean);
	return parts.join("\n\n") || message.text || "";
}

function renderContent(message: DesktopMessage): HTMLElement {
	const body = document.createElement("div");
	body.className = "message-body markdown";
	const text = contentText(message);
	if (text) renderMarkdown(body, text);
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

	const header = document.createElement("div");
	header.className = "message-header";
	const label = document.createElement("span");
	label.textContent = roleLabel(message.role);
	const time = document.createElement("time");
	time.textContent = message.timestamp
		? new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
		: "";
	header.append(label, time);
	row.append(header, renderContent(message));
	return row;
}

function createToolGroup(call: DesktopToolCall, result: DesktopMessage | undefined, collapsed: boolean): HTMLElement {
	const details = document.createElement("details");
	details.className = `tool-group ${result?.isError ? "error" : ""}`;
	details.open = !collapsed;

	const summary = document.createElement("summary");
	const name = document.createElement("span");
	name.className = "tool-name";
	name.textContent = call.name;
	const stateLabel = document.createElement("span");
	stateLabel.className = "tool-state";
	stateLabel.textContent = result ? (result.isError ? "failed" : "completed") : "running";
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
	messagesEl.innerHTML = "";
	if (messages.length === 0) {
		const empty = document.createElement("div");
		empty.className = "empty";
		empty.innerHTML = `
			<div class="empty-title">Start with the repo in front of you.</div>
			<div class="empty-copy">Ask Pi to inspect files, make a change, run tests, or explain the current branch.</div>
		`;
		messagesEl.append(empty);
		return;
	}

	for (let index = 0; index < messages.length; index++) {
		const message = messages[index]!;
		if (message.role === "toolResult") continue;
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
				tools.append(createToolGroup(call, result, hasNewerMessages));
			}
			row.append(tools);
		}
		messagesEl.append(row);
	}
	messagesEl.scrollTop = messagesEl.scrollHeight;
}

window.__piDesktopTest = { renderMessages };

function renderState(next: DesktopState): void {
	state = next;
	cwdInput.value = next.cwd;
	sessionTitle.textContent = next.sessionName || "Pi agent session";
	const model = next.model ? `${next.model.provider}/${next.model.id}` : "No model selected";
	sessionMeta.textContent = `${model} · ${next.thinkingLevel ?? "off"} thinking`;
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
		<div><span>Model</span><strong>${model}</strong></div>
	`;
	setBusy(next.isStreaming);

	const selectedValue = next.model ? `${next.model.provider}:${next.model.id}` : "";
	if (modelSelect.value !== selectedValue) {
		modelSelect.value = selectedValue;
	}
	renderSessionList();
}

function renderModels(): void {
	modelSelect.innerHTML = "";
	if (models.length === 0) {
		const option = document.createElement("option");
		option.value = "";
		option.textContent = "No configured models";
		modelSelect.append(option);
		modelSelect.disabled = true;
		return;
	}
	modelSelect.disabled = false;
	for (const model of models) {
		const option = document.createElement("option");
		option.value = `${model.provider}:${model.id}`;
		option.textContent = `${model.provider} / ${model.id}`;
		modelSelect.append(option);
	}
	if (state?.model) {
		modelSelect.value = `${state.model.provider}:${state.model.id}`;
	}
}

function renderSessionList(): void {
	sessionList.innerHTML = "";
	if (sessions.length === 0) {
		const empty = document.createElement("div");
		empty.className = "session-empty";
		empty.textContent = "No saved sessions in this store yet.";
		sessionList.append(empty);
		return;
	}

	const groups = new Map<string, DesktopSessionInfo[]>();
	for (const session of sessions) {
		const group = groups.get(session.cwd) ?? [];
		group.push(session);
		groups.set(session.cwd, group);
	}
	const orderedGroups = [...groups.entries()].sort(([cwdA, sessionsA], [cwdB, sessionsB]) => {
		if (cwdA === state?.cwd) return -1;
		if (cwdB === state?.cwd) return 1;
		return new Date(sessionsB[0]?.modified ?? 0).getTime() - new Date(sessionsA[0]?.modified ?? 0).getTime();
	});

	for (const [cwd, projectSessions] of orderedGroups) {
		const heading = document.createElement("div");
		heading.className = `session-group-heading ${cwd === state?.cwd ? "current" : ""}`;
		const label = document.createElement("span");
		label.textContent = cwd === state?.cwd ? `${basename(cwd)} · current` : basename(cwd);
		const count = document.createElement("small");
		count.textContent = String(projectSessions.length);
		heading.title = cwd;
		heading.append(label, count);
		sessionList.append(heading);

		for (const session of projectSessions) {
			const button = document.createElement("button");
			button.type = "button";
			button.className = `session-item ${session.id === state?.sessionId ? "active" : ""}`;
			const title = session.name || session.firstMessage || "Untitled session";
			button.innerHTML = `
			<span class="session-item-title">${title}</span>
			<span class="session-item-meta">${session.messageCount} messages · ${formatRelative(session.modified)}</span>
		`;
			button.addEventListener("click", async () => {
				try {
					renderState(await window.piDesktop.switchSession(session.path));
					await refreshAfterSessionChange();
				} catch (error) {
					showError(error);
				}
			});
			sessionList.append(button);
		}
	}
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
	renderSessionList();
}

async function refreshGit(): Promise<void> {
	renderGit(await window.piDesktop.gitStatus());
}

async function refreshAfterSessionChange(): Promise<void> {
	await Promise.all([refreshModels(), refreshSessions(), refreshGit()]);
	renderMessages(await window.piDesktop.getMessages());
}

function showError(error: unknown): void {
	const text = error instanceof Error ? error.message : String(error);
	const row = document.createElement("article");
	row.className = "message error";
	const header = document.createElement("div");
	header.className = "message-header";
	const label = document.createElement("span");
	label.textContent = "Desktop";
	header.append(label);
	const body = document.createElement("div");
	body.className = "message-body";
	body.textContent = text;
	row.append(header, body);
	messagesEl.append(row);
	messagesEl.scrollTop = messagesEl.scrollHeight;
}

composer.addEventListener("submit", async (event) => {
	event.preventDefault();
	const message = promptInput.value.trim();
	if (!message) return;
	promptInput.value = "";
	setBusy(true);
	try {
		renderState(await window.piDesktop.prompt(message));
		await refreshSessions();
	} catch (error) {
		showError(error);
		setBusy(false);
	}
});

promptInput.addEventListener("keydown", (event) => {
	if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
		composer.requestSubmit();
	}
});

abortButton.addEventListener("click", async () => {
	try {
		renderState(await window.piDesktop.abort());
	} catch (error) {
		showError(error);
	}
});

newSessionButton.addEventListener("click", async () => {
	try {
		renderState(await window.piDesktop.newSession());
		await refreshAfterSessionChange();
	} catch (error) {
		showError(error);
	}
});

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

toggleLeftPanelButton.addEventListener("click", () => {
	togglePanel("left");
});

toggleRightPanelButton.addEventListener("click", () => {
	togglePanel("right");
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

window.piDesktop.onState(renderState);
window.piDesktop.onMessages(renderMessages);
window.piDesktop.onEvent((event) => {
	const typed = event as { type?: string };
	if (typed.type === "agent_end") {
		Promise.all([refreshGit(), refreshSessions()]).catch(showError);
	}
});

async function boot(): Promise<void> {
	applyLayoutState();
	applyTheme();
	renderState(await window.piDesktop.init());
	await refreshAfterSessionChange();
}

boot().catch(showError);
