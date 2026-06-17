# Pi Desktop

Pi Desktop is an Electron shell for `@earendil-works/pi-coding-agent`. It is intended to feel like a native desktop chat and coding-agent app while reusing the same Pi runtime, settings, model configuration, and session store as the CLI.

The desktop package is currently a bootstrap implementation. It runs the Pi agent in-process inside Electron's main process; it does not spawn `pi` as a child CLI process.

## Running Locally

From the repository root:

```bash
npm run start --workspace packages/desktop
```

Useful environment variables:

| Variable | Description |
|----------|-------------|
| `PI_DESKTOP_CWD` | Initial workspace directory. Defaults to the process cwd. |
| `PI_CODING_AGENT_SESSION_DIR` | Overrides the shared Pi session directory. |
| `PI_DESKTOP_SMOKE=1` | Runs the Electron smoke path and exits. Used by `npm run smoke`. |

Package scripts:

| Script | Description |
|--------|-------------|
| `npm run build --workspace packages/desktop` | Bundles the Electron main, preload, renderer, and CSS assets into `dist/`. |
| `npm run dev --workspace packages/desktop` | Runs the esbuild watcher. Start Electron separately after the first build. |
| `npm run start --workspace packages/desktop` | Builds and launches Electron. |
| `npm run smoke --workspace packages/desktop` | Builds, launches Electron in smoke mode, verifies core UI behavior, and exits. |

## Process Architecture

The app has the standard Electron split:

| Layer | File | Runs where | Responsibility |
|-------|------|------------|----------------|
| Main process | `src/main.ts` | Electron main / Node.js | Creates the BrowserWindow, owns the Pi `AgentSession`, talks to git, opens native file dialogs, exposes IPC handlers, publishes state and messages. |
| Preload bridge | `src/preload.ts` | Isolated preload context | Exposes a small `window.piDesktop` API with `contextBridge`; the renderer does not get direct Node or Electron access. |
| Renderer | `src/renderer.ts` | Chromium renderer | Owns UI state, panel layout, session list rendering, markdown rendering, composer behavior, model menu, and calls `window.piDesktop`. |
| Markup and style | `src/index.html`, `src/styles.css` | Chromium renderer | Static app shell, native-feeling dark/light themes, resizable/collapsible panels, and chat layout. |
| Build | `scripts/build.mjs` | Node.js | Uses esbuild to produce `dist/main.js`, `dist/preload.cjs`, `dist/renderer.js`, and `dist/styles.css`; also copies `index.html`. |

Security posture follows Electron's safer defaults for this bootstrap:

- `contextIsolation: true`
- `nodeIntegration: false`
- renderer access limited to the preload API

The main process still runs with the user's local permissions. Pi Desktop does not add a sandbox or permission layer beyond the existing Pi runtime behavior.

## Agent Runtime

`src/main.ts` imports the coding agent library directly:

```ts
createAgentSessionServices(...)
createAgentSessionFromServices(...)
SessionManager
```

Startup flow:

1. Resolve the working directory from `PI_DESKTOP_CWD` or `process.cwd()`.
2. Create Pi services with a provider allowlist and cache those services by cwd for the lifetime of the desktop process.
3. Resolve the session directory from Pi settings, unless `PI_CODING_AGENT_SESSION_DIR` overrides it.
4. Continue the most recent session for the workspace, or create/open a session when requested.
5. Subscribe to `AgentSession` events and push serialized state/messages to the renderer.

When the sidebar lists sessions, the main process also starts non-blocking service warmups for every project cwd represented in the session store. This keeps the first click into another project from doing all resource loading, model discovery, and Glean MCP connection work on the critical path. In-flight service creation is deduplicated, and cached services are disconnected on app quit.

The current provider allowlist is:

```ts
const providerAllowlist = ["glean"];
```

That keeps the bootstrap desktop app scoped to the Glean-backed model configuration for now.

## Shared Config And Data

Pi Desktop intentionally shares the CLI's source of truth:

| Data | Source |
|------|--------|
| Global settings | `~/.pi/agent/settings.json` through the coding-agent settings manager |
| Project settings | `.pi/settings.json` through the coding-agent settings manager |
| Session store | Pi `SessionManager`, normally under `~/.pi/agent/sessions/` |
| Model config | The same provider/model settings loaded by the coding-agent services |
| Workspace | The current Pi session cwd |

Session behavior mirrors CLI storage rather than creating a desktop-only database:

- `SessionManager.continueRecent(cwd, sessionDir)` is used on startup.
- `SessionManager.create(cwd, sessionDir)` is used for New Chat.
- `SessionManager.open(path, sessionDir, cwd)` is used when switching to an existing session.
- `SessionManager.listAll(sessionDir)` powers the sidebar session list.

The sidebar renders every project group from the shared session directory, including sessions created by the CLI when they are readable by the current user. Within each project, sessions are sorted by most recent activity and initially paginated to keep the panel dense; use Show more / Show less controls to expand or collapse that project's session list. Projects themselves are not hidden behind pagination.

## IPC Surface

The renderer only talks to the main process through `window.piDesktop`, which is defined in `src/preload.ts`.

| API | Main IPC channel | Purpose |
|-----|------------------|---------|
| `init()` | `pi:init` | Ensure the active desktop session exists and return state. |
| `getState()` | `pi:get-state` | Return current serialized state. |
| `getMessages()` | `pi:get-messages` | Return current serialized visible messages. |
| `listSessions()` | `pi:list-sessions` | Return sessions across all projects in the shared session directory. |
| `newSession()` | `pi:new-session` | Create a fresh session for the current cwd. |
| `switchSession(path)` | `pi:switch-session` | Open an existing session JSONL file. |
| `prompt(message)` | `pi:prompt` | Send a user prompt, or queue it as a follow-up if the agent is streaming. |
| `abort()` | `pi:abort` | Abort the active agent run. |
| `chooseContext(kind)` | `pi:choose-context` | Open native dialogs for file/folder context, or return the current workspace. |
| `setCwd(cwd)` | `pi:set-cwd` | Switch workspace and create/continue the appropriate session. |
| `listModels()` | `pi:list-models` | Return configured models from the shared Pi model registry. |
| `setModel(provider, id)` | `pi:set-model` | Update the active session model. |
| `gitStatus()` | `pi:git-status` | Read branch, short status, and diff stat for the current cwd. |
| `onState(handler)` | `pi:state` | Subscribe to pushed state updates. |
| `onMessages(handler)` | `pi:messages` | Subscribe to pushed message updates. |
| `onEvent(handler)` | `pi:event` | Subscribe to raw agent events for future UI features. |

The main process serializes agent messages into a renderer-safe shape before publishing. Text blocks are rendered as chat content, thinking blocks are preserved in serialized content but not displayed as assistant prose, image blocks render as attachments, and tool calls are grouped with their corresponding tool results.

## Renderer UI State

The renderer keeps short-lived UI preferences in browser `localStorage`:

| Key | Description |
|-----|-------------|
| `pi-desktop-theme` | `system`, `light`, or `dark`. |
| `pi-desktop-layout` | Left/right panel widths and collapsed state. |

Current layout behavior:

- Left project/session panel and right inspector panel are resizable.
- Both side panels are collapsible.
- The left panel auto-collapses below the responsive width threshold and auto-expands again only if it was auto-collapsed.
- The right panel starts collapsed by default.
- The sidebar renders all project groups and paginates sessions within each project.
- Switching sessions does not force a full sidebar refresh; project services are reused or warmed in the background when possible.
- The main chat pane clips horizontal overflow at the pane boundary; message contents remain unclipped so markdown tables and code blocks can scroll/render correctly.
- The composer add menu currently exposes only supported context actions. The model menu includes a local filter for narrowing model choices.

## Markdown Rendering

The renderer has a small local markdown renderer in `src/renderer.ts`. It currently supports:

- paragraphs
- headings
- unordered and ordered lists
- blockquotes
- fenced code blocks
- inline code and links
- horizontal rules (`---`, `***`, `___`)
- basic pipe tables
- image attachments from message content blocks

This is intentionally lightweight for the bootstrap. If markdown support grows much further, replacing it with a tested markdown parser should be preferred over expanding ad hoc parsing indefinitely.

## Smoke Coverage

`npm run smoke --workspace packages/desktop` launches Electron with `PI_DESKTOP_SMOKE=1`, drives the renderer from the main process, and prints a `PI_DESKTOP_SMOKE_RESULT` JSON payload.

The smoke path currently covers:

- session/state initialization
- all-project session listing with per-project pagination
- git status
- left/right panel resizing and collapse controls
- settings disclosure
- composer add/model menus and model filtering
- context picker availability
- markdown headings, code, tables, and horizontal rules
- hidden thinking-only messages
- tool result grouping
- prompt autosizing
- responsive left-panel auto-collapse
- basic overflow containment

Keep this smoke test updated when changing layout, markdown rendering, IPC shape, or session behavior.

## Current Limitations

- Packaging/signing is not implemented here yet; the package is a local development Electron app.
- The provider allowlist is hard-coded to `glean`.
- File/context attachment UI exists, but selected files are not yet threaded into the agent prompt as rich context.
- Plan mode, goal mode, create flows, and plugin management are not exposed in the desktop composer menu yet.
- The right inspector is basic: git status and run context only.
- Session tree navigation, fork/clone flows, and full CLI command parity are not implemented.
- Markdown rendering is partial and local to the renderer.
- There is no additional desktop permission model; the main process has local user permissions.
