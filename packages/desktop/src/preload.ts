import { contextBridge, ipcRenderer } from "electron";

const api = {
	init: () => ipcRenderer.invoke("pi:init"),
	getState: () => ipcRenderer.invoke("pi:get-state"),
	getCurrentUser: () => ipcRenderer.invoke("pi:get-current-user"),
	getMessages: () => ipcRenderer.invoke("pi:get-messages"),
	getSessionLog: () => ipcRenderer.invoke("pi:get-session-log"),
	getSessionDeepLink: () => ipcRenderer.invoke("pi:get-session-deep-link"),
	listSessions: () => ipcRenderer.invoke("pi:list-sessions"),
	newSession: () => ipcRenderer.invoke("pi:new-session"),
	switchSession: (sessionPath: string) => ipcRenderer.invoke("pi:switch-session", sessionPath),
	forkSession: (entryId: string) => ipcRenderer.invoke("pi:fork-session", entryId),
	setResponseFeedback: (entryId: string, rating: "positive" | "negative" | null) =>
		ipcRenderer.invoke("pi:set-response-feedback", entryId, rating),
	prompt: (message: string | { text: string; images?: Array<{ type: "image"; data: string; mimeType: string }> }) =>
		ipcRenderer.invoke("pi:prompt", message),
	queuePrompt: (
		message: string | { text: string; images?: Array<{ type: "image"; data: string; mimeType: string }> },
	) => ipcRenderer.invoke("pi:queue-prompt", message),
	steerPrompt: (
		message: string | { text: string; images?: Array<{ type: "image"; data: string; mimeType: string }> },
	) => ipcRenderer.invoke("pi:steer-prompt", message),
	takeQueuedPrompt: (id: string) => ipcRenderer.invoke("pi:take-queued-prompt", id),
	steerQueuedPrompt: (id: string) => ipcRenderer.invoke("pi:steer-queued-prompt", id),
	resolveClarification: (id: string, answer: string) => ipcRenderer.invoke("pi:resolve-clarification", id, answer),
	rejectClarification: (id: string) => ipcRenderer.invoke("pi:reject-clarification", id),
	setPermissionMode: (mode: "ask" | "acceptEdits" | "bypassPermissions") =>
		ipcRenderer.invoke("pi:set-permission-mode", mode),
	resolvePermission: (id: string, reply: "allowOnce" | "allowAlways" | "reject") =>
		ipcRenderer.invoke("pi:resolve-permission", id, reply),
	abort: () => ipcRenderer.invoke("pi:abort"),
	chooseContext: (kind: "files" | "folder" | "workspace") => ipcRenderer.invoke("pi:choose-context", kind),
	setCwd: (cwd: string) => ipcRenderer.invoke("pi:set-cwd", cwd),
	listModels: () => ipcRenderer.invoke("pi:list-models"),
	setModel: (provider: string, id: string) => ipcRenderer.invoke("pi:set-model", provider, id),
	setThinkingLevel: (level: string) => ipcRenderer.invoke("pi:set-thinking-level", level),
	compact: (customInstructions?: string) => ipcRenderer.invoke("pi:compact", customInstructions),
	setSessionName: (name: string) => ipcRenderer.invoke("pi:set-session-name", name),
	reloadSession: () => ipcRenderer.invoke("pi:reload-session"),
	login: () => ipcRenderer.invoke("pi:login"),
	logout: () => ipcRenderer.invoke("pi:logout"),
	quit: () => ipcRenderer.invoke("pi:quit"),
	gitStatus: () => ipcRenderer.invoke("pi:git-status"),
	environmentStatus: () => ipcRenderer.invoke("pi:environment-status"),
	setPrMonitor: (enabled: boolean) => ipcRenderer.invoke("pi:set-pr-monitor", enabled),
	fixPrChecks: () => ipcRenderer.invoke("pi:fix-pr-checks"),
	getDiff: (scope?: "working-tree" | "staged" | "last-turn", context?: number) =>
		ipcRenderer.invoke("pi:get-diff", scope, context),
	terminalCreate: (terminalId = "default") => ipcRenderer.invoke("pi:terminal-create", terminalId),
	terminalWrite: (terminalId: string, data: string) => ipcRenderer.send("pi:terminal-write", terminalId, data),
	terminalResize: (terminalId: string, cols: number, rows: number) =>
		ipcRenderer.send("pi:terminal-resize", terminalId, cols, rows),
	terminalDestroy: (terminalId?: string) => ipcRenderer.invoke("pi:terminal-destroy", terminalId),
	terminalDestroyAll: () => ipcRenderer.send("pi:terminal-destroy-all"),
	terminalFocus: (terminalId: string, focused: boolean) => ipcRenderer.send("pi:terminal-focus", terminalId, focused),
	onTerminalData: (handler: (terminalId: string, data: string) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, payload: { data?: unknown; terminalId?: unknown }) => {
			handler(typeof payload.terminalId === "string" ? payload.terminalId : "default", String(payload.data ?? ""));
		};
		ipcRenderer.on("pi:terminal-data", listener);
		return () => ipcRenderer.off("pi:terminal-data", listener);
	},
	onTerminalZoom: (handler: (terminalId: string, delta: number) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, payload: { delta?: unknown; terminalId?: unknown }) => {
			const terminalId = typeof payload.terminalId === "string" ? payload.terminalId : "default";
			const delta = typeof payload.delta === "number" ? payload.delta : 0;
			handler(terminalId, delta);
		};
		ipcRenderer.on("pi:terminal-zoom", listener);
		return () => ipcRenderer.off("pi:terminal-zoom", listener);
	},
	onState: (handler: (state: unknown) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, state: unknown) => handler(state);
		ipcRenderer.on("pi:state", listener);
		return () => ipcRenderer.off("pi:state", listener);
	},
	onMessages: (handler: (messages: unknown) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, messages: unknown) => handler(messages);
		ipcRenderer.on("pi:messages", listener);
		return () => ipcRenderer.off("pi:messages", listener);
	},
	onEvent: (handler: (event: unknown) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => handler(payload);
		ipcRenderer.on("pi:event", listener);
		return () => ipcRenderer.off("pi:event", listener);
	},
};

contextBridge.exposeInMainWorld("piDesktop", api);

export type PiDesktopApi = typeof api;
