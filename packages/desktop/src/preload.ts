import { contextBridge, ipcRenderer } from "electron";

const api = {
	init: () => ipcRenderer.invoke("pi:init"),
	getState: () => ipcRenderer.invoke("pi:get-state"),
	getMessages: () => ipcRenderer.invoke("pi:get-messages"),
	listSessions: () => ipcRenderer.invoke("pi:list-sessions"),
	newSession: () => ipcRenderer.invoke("pi:new-session"),
	switchSession: (sessionPath: string) => ipcRenderer.invoke("pi:switch-session", sessionPath),
	prompt: (message: string | { text: string; images?: Array<{ type: "image"; data: string; mimeType: string }> }) =>
		ipcRenderer.invoke("pi:prompt", message),
	abort: () => ipcRenderer.invoke("pi:abort"),
	chooseContext: (kind: "files" | "folder" | "workspace") => ipcRenderer.invoke("pi:choose-context", kind),
	setCwd: (cwd: string) => ipcRenderer.invoke("pi:set-cwd", cwd),
	listModels: () => ipcRenderer.invoke("pi:list-models"),
	setModel: (provider: string, id: string) => ipcRenderer.invoke("pi:set-model", provider, id),
	compact: (customInstructions?: string) => ipcRenderer.invoke("pi:compact", customInstructions),
	setSessionName: (name: string) => ipcRenderer.invoke("pi:set-session-name", name),
	reloadSession: () => ipcRenderer.invoke("pi:reload-session"),
	quit: () => ipcRenderer.invoke("pi:quit"),
	gitStatus: () => ipcRenderer.invoke("pi:git-status"),
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
