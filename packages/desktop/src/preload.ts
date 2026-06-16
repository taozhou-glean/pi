import { contextBridge, ipcRenderer } from "electron";

const api = {
	init: () => ipcRenderer.invoke("pi:init"),
	getState: () => ipcRenderer.invoke("pi:get-state"),
	getMessages: () => ipcRenderer.invoke("pi:get-messages"),
	listSessions: () => ipcRenderer.invoke("pi:list-sessions"),
	newSession: () => ipcRenderer.invoke("pi:new-session"),
	switchSession: (sessionPath: string) => ipcRenderer.invoke("pi:switch-session", sessionPath),
	prompt: (message: string) => ipcRenderer.invoke("pi:prompt", message),
	abort: () => ipcRenderer.invoke("pi:abort"),
	setCwd: (cwd: string) => ipcRenderer.invoke("pi:set-cwd", cwd),
	listModels: () => ipcRenderer.invoke("pi:list-models"),
	setModel: (provider: string, id: string) => ipcRenderer.invoke("pi:set-model", provider, id),
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
