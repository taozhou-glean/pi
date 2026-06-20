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
	getDiff: (scope?: "working-tree" | "staged" | "last-turn", context?: number) =>
		ipcRenderer.invoke("pi:get-diff", scope, context),
	terminalCreate: () => ipcRenderer.invoke("pi:terminal-create"),
	terminalWrite: (data: string) => ipcRenderer.send("pi:terminal-write", data),
	terminalResize: (cols: number, rows: number) => ipcRenderer.send("pi:terminal-resize", cols, rows),
	terminalDestroy: () => ipcRenderer.invoke("pi:terminal-destroy"),
	onTerminalData: (handler: (data: string) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, data: string) => handler(data);
		ipcRenderer.on("pi:terminal-data", listener);
		return () => ipcRenderer.off("pi:terminal-data", listener);
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
