# Dynamia Tasks — Architecture Reference

> **Purpose:** This document is the single source of truth for architecture, data models, API contracts, and implementation guidelines for both human developers and LLM agents working on this project.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Core Concepts](#3-core-concepts)
4. [Connector System](#4-connector-system)
5. [Built-in Connectors](#5-built-in-connectors)
6. [Data Models](#6-data-models)
7. [File System Layout](#7-file-system-layout)
8. [Node Server](#8-node-server)
9. [Workspace System](#9-workspace-system)
10. [IDE Bridge](#10-ide-bridge)
11. [Nuxt SPA](#11-nuxt-spa)
12. [IDE Plugins](#12-ide-plugins)
13. [Implementation Plan](#13-implementation-plan)
14. [Agent Guidelines](#14-agent-guidelines)

---

## 1. Project Overview

Dynamia Tasks is a **developer-first task manager** that unifies tasks from any source into a single minimal checklist UI — fast, no friction, no cloud. It runs entirely local as a plugin for IntelliJ IDEA and VS Code.

### Philosophy

- No friction. No overengineering.
- Fast > perfect. UI matters. Dev-first always.
- Everything is a file. LLM-friendly by design.
- One codebase, multiple IDE hosts.
- **Open by design** — new task sources are first-class citizens via the Connector system.

### Key Characteristics

| Property | Value |
|---|---|
| UI Framework | Nuxt 3 (SPA mode, static output) |
| Server | Node.js + Fastify (local, per-project) |
| IDE Support | IntelliJ IDEA (JCEF), VS Code (Webview) |
| Task Sources | Via **Connectors** — extensible, pluggable |
| Built-in Connectors | `local` (JSON files), `github` (REST API) |
| Auth | Per-connector (PAT for GitHub, none for local) |
| Config Storage | `~/.dynamiatasks/config.json` |
| Workspace Storage | `{project}/.dynamiatasks/workspace.json` |

---

## 2. Monorepo Structure

```
dynamia-tasks/
├── package.json                   # pnpm workspaces root
├── pnpm-workspace.yaml
├── tsconfig.base.json
│
├── packages/
│   ├── core/                      # Shared types, connector interface, utils
│   ├── server/                    # Fastify local server + connector registry
│   ├── connector-local/           # Built-in: local JSON tasks
│   └── connector-github/          # Built-in: GitHub Issues
│
└── apps/
    ├── web/                       # Nuxt 3 SPA
    ├── vscode/                    # VS Code extension (TypeScript)
    └── intellij/                  # IntelliJ plugin (Kotlin)
```

### Package Dependency Graph

```
apps/web                 → packages/core
apps/vscode              → packages/core, packages/server
apps/intellij            → (Kotlin — spawns server as child process)
packages/server          → packages/core, packages/connector-local, packages/connector-github
packages/connector-local → packages/core
packages/connector-github→ packages/core
packages/core            → (no internal deps)
```

> **Adding a new connector:** create `packages/connector-{name}/`, implement `TaskConnector`, register in `packages/server/src/connectors/registry.ts`. No changes needed in `core`, `web`, or IDE plugins.

### Root `package.json` Scripts

```json
{
  "scripts": {
    "dev:web":    "pnpm --filter web dev",
    "dev:server": "pnpm --filter server dev",
    "build:web":  "pnpm --filter web build",
    "build:all":  "pnpm -r build",
    "test":       "pnpm -r test"
  }
}
```

---

## 3. Core Concepts

### Connectors

A **connector** is a package that knows how to read and write tasks from a specific source (GitHub, local files, Jira, Linear, Notion, etc.). Every connector implements the same `TaskConnector` interface defined in `packages/core`.

The server maintains a **connector registry**. The SPA never talks to GitHub, the filesystem, or any external service directly — it always goes through the server, which delegates to the appropriate connector.

### Tasks

All tasks, regardless of source, are represented as a `ConnectorTask` — a normalized model that every connector must map its native format to. The SPA only ever works with `ConnectorTask` and `TaskView`.

### Workspace

A workspace is **per project** (per IDE project root). It is a curated ordered list of tasks the developer has chosen to work on. Items reference tasks by `connectorId + taskId` — the workspace never copies task data.

### Grouping

Tasks in the workspace view are grouped using this priority chain:

1. `task.module` (explicit field on `ConnectorTask`)
2. `task.labels[0].name` (first label)
3. `[Module]` prefix pattern in title → `[Billing] Fix IVA` → module `billing`
4. Fallback: `"other"`

---

## 4. Connector System

### `TaskConnector` Interface

```typescript
// packages/core/src/connectors/types.ts

export interface TaskFilter {
  query?: string                    // title/text search
  labels?: string[]
  status?: 'open' | 'closed' | 'all'
  page?: number
  perPage?: number
  [key: string]: unknown            // connector-specific extra filters
}

export interface NewTask {
  title: string
  description?: string
  module?: string
  labels?: string[]
  [key: string]: unknown            // connector-specific fields
}

export interface TaskPatch {
  title?: string
  description?: string
  done?: boolean
  module?: string
  labels?: string[]
  priority?: 'high' | 'medium' | 'low'
}

export interface ConnectorCapabilities {
  canCreate: boolean                // can create new tasks
  canDelete: boolean                // can delete tasks
  canEdit: boolean                  // can edit title/description
  canComment: boolean               // supports comments
  canSubtasks: boolean              // supports subtask hierarchy
  canAssign: boolean                // supports assignees
  canLabel: boolean                 // supports labels/tags
  hasDetail: boolean                // has a rich detail view
  hasExplorer: boolean              // has a browsable explorer (vs just flat list)
}

export interface ConnectorSource {
  id: string                        // "dynamia-tools/dynamia-erp"
  name: string                      // "dynamia-erp"
  group?: string                    // "dynamia-tools" (org, project, team)
  metadata?: unknown
}

export interface ConnectorConfigSchema {
  fields: ConfigField[]
}

export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'password' | 'select' | 'multiselect' | 'boolean'
  required: boolean
  placeholder?: string
  helpText?: string
  options?: { label: string; value: string }[]
}

export interface TaskConnector {
  // ── Identity ─────────────────────────────────────────
  readonly id: string               // unique: "github", "local", "jira"
  readonly name: string             // display: "GitHub Issues"
  readonly icon: string             // svg string or emoji fallback
  readonly capabilities: ConnectorCapabilities

  // ── Lifecycle ────────────────────────────────────────
  isConfigured(): Promise<boolean>
  configure(config: unknown): Promise<void>
  getConfigSchema(): ConnectorConfigSchema

  // ── Task CRUD ────────────────────────────────────────
  fetchTasks(filter?: TaskFilter): Promise<ConnectorTask[]>
  getTask(id: string): Promise<ConnectorTask>
  updateTask(id: string, patch: TaskPatch): Promise<ConnectorTask>
  createTask(task: NewTask): Promise<ConnectorTask>        // if canCreate
  deleteTask?(id: string): Promise<void>                   // if canDelete

  // ── Extended (optional, guarded by capabilities) ─────
  fetchComments?(taskId: string): Promise<TaskComment[]>   // if canComment
  addComment?(taskId: string, body: string): Promise<TaskComment>
  fetchSubtasks?(taskId: string): Promise<ConnectorTask[]> // if canSubtasks
  addSubtask?(parentId: string, childId: string): Promise<void>
  removeSubtask?(parentId: string, childId: string): Promise<void>

  // ── Explorer ─────────────────────────────────────────
  fetchSources?(): Promise<ConnectorSource[]>              // if hasExplorer
}
```

### Connector Registry

```typescript
// packages/server/src/connectors/registry.ts
import { LocalConnector }  from '@dynamia-tasks/connector-local'
import { GithubConnector } from '@dynamia-tasks/connector-github'
import type { TaskConnector } from '@dynamia-tasks/core'

const registry = new Map<string, TaskConnector>()

export function registerConnector(connector: TaskConnector) {
  registry.set(connector.id, connector)
}

export function getConnector(id: string): TaskConnector {
  const c = registry.get(id)
  if (!c) throw new Error(`Unknown connector: "${id}"`)
  return c
}

export function listConnectors(): TaskConnector[] {
  return [...registry.values()]
}

// Built-in connectors
registerConnector(new LocalConnector())
registerConnector(new GithubConnector())

// Third-party connectors (future):
// import { JiraConnector } from '@dynamia-tasks/connector-jira'
// registerConnector(new JiraConnector())
```

### Settings Auto-Render via Schema

The Settings UI renders a config form for any connector dynamically — no hardcoded forms per connector:

```typescript
// Example schema returned by GithubConnector.getConfigSchema()
{
  fields: [
    { key: 'token',  label: 'Personal Access Token', type: 'password',     required: true,  placeholder: 'ghp_...' },
    { key: 'orgs',   label: 'Organizations',          type: 'multiselect',  required: false, helpText: 'GitHub orgs to browse' },
    { key: 'repos',  label: 'Repositories',           type: 'multiselect',  required: false, helpText: 'Specific repos (owner/repo)' },
  ]
}
```

---

## 5. Built-in Connectors

### `connector-local`

Reads and writes tasks from `.tasks/*.json` files in the project directory.

```typescript
export class LocalConnector implements TaskConnector {
  readonly id = 'local'
  readonly name = 'Local Tasks'
  readonly icon = '📁'
  readonly capabilities = {
    canCreate:   true,
    canDelete:   true,
    canEdit:     true,
    canComment:  false,
    canSubtasks: false,
    canAssign:   false,
    canLabel:    true,
    hasDetail:   false,
    hasExplorer: false,
  }
}
```

- **Config:** `projectPath` injected by server at startup (not user-facing).
- **Storage:** `{projectPath}/.tasks/*.json` — one JSON array of `LocalTask` per file.
- **Task ID format:** `"local-{uuid}"`

### `connector-github`

Reads and writes GitHub Issues via the GitHub REST API.

```typescript
export class GithubConnector implements TaskConnector {
  readonly id = 'github'
  readonly name = 'GitHub Issues'
  readonly icon = '🐙'
  readonly capabilities = {
    canCreate:   true,
    canDelete:   false,          // GH does not allow deleting issues via API
    canEdit:     true,
    canComment:  true,
    canSubtasks: true,           // via Sub-Issues REST API (GA April 2025)
    canAssign:   true,
    canLabel:    true,
    hasDetail:   true,
    hasExplorer: true,
  }
}
```

- **Config:** `token`, `orgs[]`, `repos[]`.
- **Task ID format:** `"{issueNumber}@{owner}/{repo}"` — e.g. `"142@dynamia-tools/dynamia-erp"`.
- **Sub-issues:** uses GitHub's native Sub-Issues REST API (not Markdown task lists).
- **Auth header:** `Authorization: Bearer {token}` + `X-GitHub-Api-Version: 2022-11-28`.

### Creating a New Connector (Checklist)

1. `mkdir packages/connector-{name}`
2. Implement `TaskConnector` from `@dynamia-tasks/core`
3. Map native objects → `ConnectorTask` in a `toConnectorTask()` helper
4. Implement `getConfigSchema()` so Settings auto-renders the form
5. Register in `packages/server/src/connectors/registry.ts`
6. ✅ Done — server, SPA, and workspace work automatically

**No changes required in:** `packages/core`, `apps/web`, `apps/vscode`, `apps/intellij`.

---

## 6. Data Models

All types live in `packages/core/src/types.ts`.

### `ConnectorTask`

```typescript
export interface ConnectorTask {
  // Identity
  id: string                        // connector-native ID
  connectorId: string               // "local" | "github" | ...
  sourceId?: string                 // repo, project, board — connector-specific

  // Content
  title: string
  description?: string              // Markdown
  done: boolean

  // Classification
  module?: string
  labels?: TaskLabel[]
  priority?: 'high' | 'medium' | 'low'

  // People
  assignees?: TaskUser[]
  author?: TaskUser

  // Counts (for list view)
  commentsCount?: number
  subtasksCount?: number
  subtasksDoneCount?: number

  // Timestamps
  createdAt: string                 // ISO 8601
  updatedAt: string                 // ISO 8601

  // Connector-specific passthrough
  meta?: Record<string, unknown>
}

export interface TaskLabel {
  id: string
  name: string
  color?: string                    // hex without #
}

export interface TaskUser {
  id: string
  login: string
  avatarUrl?: string
}
```

### `TaskComment`

```typescript
export interface TaskComment {
  id: string
  body: string                      // Markdown
  author: TaskUser
  createdAt: string
  updatedAt: string
}
```

### `WorkspaceItem`

```typescript
export interface WorkspaceItem {
  connectorId: string               // "local" | "github" | "jira" | ...
  taskId: string                    // connector-native task ID
  addedAt: string                   // ISO 8601
  order: number                     // display order, 0-based
}

export interface Workspace {
  projectPath: string
  items: WorkspaceItem[]
}
```

### `TaskView` (UI-only, never persisted)

```typescript
export interface TaskView extends ConnectorTask {
  connectorName: string
  connectorIcon: string
  capabilities: ConnectorCapabilities
}
```

### `AppConfig`

```typescript
export interface AppConfig {
  connectors: {
    [connectorId: string]: unknown  // each connector owns its config shape
  }
  ui: {
    theme: 'light' | 'dark' | 'system'
    groupBy: 'module' | 'label' | 'connector'
    defaultView: 'workspace' | 'explorer'
  }
}
```

---

## 7. File System Layout

```
~/.dynamiatasks/
├── config.json                         # Global config (all connectors + UI)
├── instances/
│   └── <sha1(projectPath)[0..12]>.json # Active server: { port, pid, projectPath, startedAt }
└── cache/
    └── {connectorId}-{sourceId}.json   # Per-connector offline cache

{projectRoot}/
├── .dynamiatasks/
│   └── workspace.json                  # This project's workspace
└── .tasks/                             # local connector task files
    ├── backlog.json
    └── sprint-may-2026.json
```

### `~/.dynamiatasks/config.json`

```json
{
  "connectors": {
    "github": {
      "token": "ghp_xxxxxxxxxxxxxxxxxxxx",
      "orgs": ["dynamia-tools"],
      "repos": []
    },
    "local": {}
  },
  "ui": {
    "theme": "dark",
    "groupBy": "module",
    "defaultView": "workspace"
  }
}
```

### `{project}/.dynamiatasks/workspace.json`

```json
{
  "projectPath": "/home/mario/projects/dynamia-erp",
  "items": [
    { "connectorId": "github", "taskId": "142@dynamia-tools/dynamia-erp", "addedAt": "2026-04-21T10:00:00Z", "order": 0 },
    { "connectorId": "github", "taskId": "98@dynamia-tools/dynamia-erp",  "addedAt": "2026-04-21T10:01:00Z", "order": 1 },
    { "connectorId": "local",  "taskId": "local-f3a1c2b4",                "addedAt": "2026-04-21T10:02:00Z", "order": 2 }
  ]
}
```

### `{project}/.tasks/backlog.json`

```json
[
  {
    "id": "local-f3a1c2b4",
    "title": "Refactor IVA calculation",
    "description": "Move logic to `IvaService`, add unit tests.",
    "done": false,
    "module": "billing",
    "labels": [{ "id": "refactor", "name": "refactor" }],
    "priority": "high",
    "createdAt": "2026-04-20T09:00:00Z",
    "updatedAt": "2026-04-20T09:00:00Z"
  }
]
```

> **LLM Agent Note:** `.tasks/*.json` files are plain JSON arrays. Agents can read and write tasks directly. IDs must be unique across ALL files. Use `"local-{uuid}"` format.

---

## 8. Node Server

**Location:** `packages/server/`  
**Runtime:** Node.js 20+  
**Framework:** Fastify 4  
**Default Port:** 7842 (auto-selects next free port if occupied; up to +50 attempts)

The server is the single entry point for all operations. It owns the connector registry and routes all task operations to the correct connector.

On startup the server writes `~/.dynamiatasks/instances/<sha1(projectPath)[0..12]>.json` with the actual port, PID, and project path — enabling IDE plugins to discover the port without hardcoding it. The file is removed on graceful shutdown (SIGINT / SIGTERM).

### Startup

```typescript
// packages/server/src/index.ts
interface ServerOptions {
  port: number
  projectPath: string
  ideCallbackUrl?: string
  spaPath: string
}

export async function startServer(options: ServerOptions): Promise<void>
```

### Full API Contract

#### Connectors (meta)

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/connectors` | List all registered connectors with capabilities + config status |
| `GET` | `/api/connectors/:id/schema` | Config schema for a connector (drives Settings UI) |
| `GET` | `/api/connectors/:id/configured` | `{ configured: boolean }` |

#### Config

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/config` | Full `AppConfig` |
| `PUT` | `/api/config` | Save full config |
| `GET` | `/api/config/connectors/:id` | Config for a single connector |
| `PUT` | `/api/config/connectors/:id` | Save config for a single connector |

#### Tasks (connector-agnostic)

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/connectors/:id/tasks` | Fetch tasks (accepts filter query params) |
| `GET` | `/api/connectors/:id/tasks/:taskId` | Task detail |
| `POST` | `/api/connectors/:id/tasks` | Create task |
| `PATCH` | `/api/connectors/:id/tasks/:taskId` | Update task |
| `DELETE` | `/api/connectors/:id/tasks/:taskId` | Delete task |

#### Extended Task Operations

| Method | Route | Capability Required |
|---|---|---|
| `GET` | `/api/connectors/:id/tasks/:taskId/comments` | `canComment` |
| `POST` | `/api/connectors/:id/tasks/:taskId/comments` | `canComment` |
| `GET` | `/api/connectors/:id/tasks/:taskId/subtasks` | `canSubtasks` |
| `POST` | `/api/connectors/:id/tasks/:taskId/subtasks` | `canSubtasks` |
| `DELETE` | `/api/connectors/:id/tasks/:taskId/subtasks/:childId` | `canSubtasks` |

#### Sources (Explorer)

| Method | Route | Capability Required |
|---|---|---|
| `GET` | `/api/connectors/:id/sources` | `hasExplorer` |

#### Workspace

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/workspace` | Workspace with resolved `TaskView[]` |
| `POST` | `/api/workspace/add` | Add item `{ connectorId, taskId }` |
| `DELETE` | `/api/workspace/:connectorId/:taskId` | Remove item |
| `PATCH` | `/api/workspace/reorder` | Reorder `{ items: WorkspaceItem[] }` |

#### Instance Registry

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/instance` | Runtime info: `{ port, projectPath, pid, startedAt }` |



| Method | Route | Description |
|---|---|---|
| `POST` | `/api/ide/open-file` | Request IDE to open file `{ path, line? }` |
| `POST` | `/api/ide/notify` | Request native notification `{ type, message }` |

### Generic Route Handler Pattern

```typescript
// All connector task routes follow the same pattern
fastify.get('/api/connectors/:id/tasks', async (req, reply) => {
  const connector = getConnector(req.params.id)
  const tasks = await connector.fetchTasks(req.query as TaskFilter)
  return { tasks }
})

// Capability guard example
fastify.post('/api/connectors/:id/tasks/:taskId/comments', async (req, reply) => {
  const connector = getConnector(req.params.id)
  if (!connector.capabilities.canComment || !connector.addComment) {
    return reply.code(405).send({ error: true, code: 'CAPABILITY_NOT_SUPPORTED' })
  }
  const comment = await connector.addComment(req.params.taskId, req.body.body)
  return { comment }
})
```

### Offline Cache

```typescript
async function fetchWithCache(connector: TaskConnector, filter: TaskFilter) {
  try {
    const tasks = await connector.fetchTasks(filter)
    await writeCache(connector.id, tasks)
    return { tasks, cached: false }
  } catch {
    const cached = await readCache(connector.id)
    if (cached) return { tasks: cached.data, cached: true, cachedAt: cached.ts }
    throw { code: 'UPSTREAM_UNAVAILABLE' }
  }
}
```

---

## 9. Workspace System

### Lifecycle

```
1. IDE opens project at {projectPath}
2. Server starts with --cwd {projectPath}
3. LocalConnector receives projectPath at registration time
4. SPA loads → GET /api/workspace
5. Server resolves each WorkspaceItem via its connector
6. Returns unified TaskView[] to SPA
7. User browses Explorer → "Add to workspace"
8. POST /api/workspace/add { connectorId, taskId }
9. Workspace reloads
```

### Item Resolution

```typescript
async function resolveWorkspaceItem(item: WorkspaceItem): Promise<TaskView> {
  const connector = getConnector(item.connectorId)
  const task = await connector.getTask(item.taskId)
  return {
    ...task,
    connectorName: connector.name,
    connectorIcon: connector.icon,
    capabilities: connector.capabilities,
  }
}
```

Removing from workspace removes the reference from `workspace.json` only — never deletes the underlying task.

---

## 10. IDE Bridge

### Architecture

```
SPA (Nuxt)
  └─ same-origin fetch() for all task/connector/workspace ops
     (window.location.origin used as apiBase — no hardcoded port)
  └─ fetch() → <origin>/api/ide/* for IDE-native ops

Node Server (auto-selected port, default 7842)
  └─ /api/ide/* → forwards to IDE callback server

IDE Plugin (callback server on auto-selected port)
  └─ /ide/open-file → native IDE API
  └─ /ide/notify    → native IDE API
```

### IDE Callback Contract

```
POST /ide/open-file
Body: { "path": "/absolute/path/file.java", "line": 42 }
Response: { "ok": true }

POST /ide/notify
Body: { "type": "info|warning|error|success", "message": "..." }
Response: { "ok": true }
```

### IDE Detection in SPA

IntelliJ injects before page load via JCEF:

```javascript
window.__dynamia_host = 'intellij'
```

VS Code sets it in the HTML wrapper. Used only for minor UI adjustments.

---

## 11. Nuxt SPA

**Location:** `apps/web/`  
**Mode:** SPA, no SSR  
**Output:** `apps/web/.output/public/`

### Nuxt Config

```typescript
export default defineNuxtConfig({
  ssr: false,
  runtimeConfig: {
    public: {
      // Empty → SPA uses window.location.origin (same-origin, works on any port).
      // Override with NUXT_PUBLIC_API_BASE=http://localhost:7842 for standalone dev.
      apiBase: '',
    },
  },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
})
```

### Pages

| Route | Description |
|---|---|
| `/` | Workspace — grouped checklist of active tasks |
| `/explore` | Explorer — connector picker |
| `/explore/:connectorId` | Source list for connector (repos, projects...) |
| `/explore/:connectorId/:sourceId` | Task list with filters |
| `/task/:connectorId/:taskId` | Task detail — capability-driven |
| `/settings` | All connectors config + UI preferences |
| `/settings/:connectorId` | Per-connector config form (auto-rendered from schema) |

### Capability-Driven UI (critical pattern)

The SPA **never checks `connectorId`**. It checks `capabilities`:

```vue
<!-- pages/task/[connectorId]/[taskId].vue -->
<template>
  <TaskHeader   :task="task" :canEdit="task.capabilities.canEdit" />
  <TaskBody     :task="task" :canEdit="task.capabilities.canEdit" />

  <CommentsSection
    v-if="task.capabilities.canComment"
    :connectorId="task.connectorId"
    :taskId="task.id"
  />

  <SubtasksSection
    v-if="task.capabilities.canSubtasks"
    :connectorId="task.connectorId"
    :taskId="task.id"
  />

  <AssigneesSection
    v-if="task.capabilities.canAssign"
    :task="task"
  />
</template>
```

### Pinia Stores

```
stores/
  connectors.ts    → registered connectors, capabilities, config status
  config.ts        → AppConfig, per-connector config
  workspace.ts     → WorkspaceItems + resolved TaskViews
  explorer.ts      → per-connector explorer state (sources, filters, results)
  ui.ts            → loading, active task, modals
```

### API Composable

```typescript
// composables/useApi.ts
export const useApi = () => {
  const configured = useRuntimeConfig().public.apiBase as string
  // When the SPA is served by the Dynamia Tasks server (production / IDE webview),
  // apiBase is empty and requests go to the same origin — correct on any port.
  const BASE = configured || (import.meta.client ? window.location.origin : '')

  return {
    get:    <T>(path: string)                => $fetch<T>(`${BASE}${path}`),
    post:   <T>(path: string, body: unknown) => $fetch<T>(`${BASE}${path}`, { method: 'POST', body }),
    patch:  <T>(path: string, body: unknown) => $fetch<T>(`${BASE}${path}`, { method: 'PATCH', body }),
    delete: <T>(path: string)               => $fetch<T>(`${BASE}${path}`, { method: 'DELETE' }),
  }
}
```

---

## 12. IDE Plugins

### VS Code Extension (`apps/vscode/`)

```typescript
// src/extension.ts
export async function activate(context: vscode.ExtensionContext) {
  const projectPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? ''
  const spaPath     = path.join(context.extensionPath, 'dist', 'web')

  // Auto-select a free callback port
  const callbackPort = await findFreePort(7843)
  const callbackServer = startIdeCallbackServer(callbackPort)

  // Start the Node server without --port so the CLI auto-selects a free port.
  // Discover the actual port from stdout line:
  //   "✓ dynamia-tasks server running on http://localhost:<PORT>"
  // or read ~/.dynamiatasks/instances/<hash>.json after the process starts.
  const serverProcess = startServer({ projectPath, ideCallbackUrl: `http://127.0.0.1:${callbackPort}`, spaPath })
  const serverPort = await discoverPort(serverProcess) // reads stdout

  const panel = vscode.window.createWebviewPanel(
    'dynamiaTasks', 'Dynamia Tasks', vscode.ViewColumn.Two,
    { enableScripts: true, retainContextWhenHidden: true }
  )
  panel.webview.html = `<!DOCTYPE html><html>
    <head><meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline'"></head>
    <body style="margin:0;height:100vh">
      <iframe src="http://localhost:${serverPort}" style="width:100%;height:100%;border:none"></iframe>
    </body></html>`
  // The SPA uses window.location.origin — no port hardcoded in the frontend.

  context.subscriptions.push(new vscode.Disposable(() => callbackServer.close()))
}
```

### IntelliJ Plugin (`apps/intellij/`)

Plugin structure:

```
src/main/kotlin/com/dynamia/tasks/
  DynamiaTasksPlugin.kt          # Startup activity
  DynamiaTasksWindowFactory.kt   # Tool window factory
  DynamiaTasksPanel.kt           # JCEF panel → injects window.__dynamia_host
  server/
    NodeServerManager.kt         # Spawns node server/index.js as child process
    IdeCallbackServer.kt         # HTTP server on port 7843
```

`NodeServerManager` launch command:

```kotlin
// Do NOT pass --port: the CLI auto-selects the first free port from 7842.
// Read the actual port from stdout or ~/.dynamiatasks/instances/<hash>.json.
ProcessBuilder(
  "node", serverBundlePath,
  "--cwd", project.basePath ?: homePath,
  "--ide-callback", "http://127.0.0.1:<callbackPort>"   // callback port also auto-selected
).start()
```

Port discovery (choose one):
1. **Stdout** — parse line `✓ dynamia-tasks server running on http://localhost:<PORT>`
2. **Instance file** — read `~/.dynamiatasks/instances/<sha1(projectPath)[0..12]>.json` → `port`
3. **API** — `GET http://localhost:<PORT>/api/instance` (useful to verify after discovery)

`IdeCallbackServer` implements `/ide/open-file` (via `OpenFileDescriptor`) and `/ide/notify` (via `Notifications.Bus`).

---

## 13. Implementation Plan

### Phase 1 — MVP (Days 1–3)

**Day 1: Foundation**
- [ ] Init pnpm monorepo with all packages
- [ ] Define all types in `packages/core/src/types.ts`
- [ ] Define `TaskConnector` interface in `packages/core/src/connectors/types.ts`
- [ ] Implement `connector-local` (fetchTasks, getTask, createTask, updateTask, deleteTask)
- [ ] Implement Fastify server with connector registry and all generic routes
- [ ] Init Nuxt SPA — WorkspaceView + SettingsView shells

**Day 2: GitHub + Workspace**
- [ ] Implement `connector-github` (fetchTasks, getTask, updateTask, fetchSources, createTask)
- [ ] Implement offline cache layer in server
- [ ] Implement ExplorerView (connector picker → source list → task list with filters)
- [ ] Implement "Add to workspace" action
- [ ] Implement workspace resolution → grouped checklist
- [ ] Implement toggle done (generic PATCH via connector)
- [ ] Implement Settings with auto-rendered connector config forms

**Day 3: IDE Plugins**
- [ ] VS Code extension: server startup + webview panel
- [ ] VS Code: IDE callback server (open-file, notify)
- [ ] IntelliJ plugin: JCEF panel + NodeServerManager + IdeCallbackServer
- [ ] Bundle Nuxt static output into both plugins

### Phase 2 — Detail + Extended Ops

- [ ] TaskDetailView with capability-driven sections
- [ ] GitHub comments (list + add)
- [ ] GitHub sub-issues (list, add, remove)
- [ ] Local tasks: full CRUD from UI
- [ ] File watcher for `.tasks/*.json` changes (chokidar)
- [ ] `/api/ide/open-file` integration from task detail

### Phase 3 — Polish + Ecosystem

- [ ] Dark mode
- [ ] Workspace drag-and-drop reorder
- [ ] Keyboard shortcuts
- [ ] Search across workspace
- [ ] Connector SDK documentation (for third-party authors)
- [ ] Example third-party connector (`connector-linear` or `connector-jira`)

---

## 14. Agent Guidelines

> This section is for LLM agents implementing this project.

### Rules

1. **Never create a backend in the cloud.** Everything runs locally.
2. **Never use `localStorage`** for config or tokens. Use `PUT /api/config/connectors/:id`.
3. **Never check `connectorId` in the SPA UI.** Use `task.capabilities.*` to gate features.
4. **All types come from `packages/core/src/types.ts`.** Do not duplicate type definitions.
5. **All task operations go through `/api/connectors/:id/*`** — never call connector packages from the SPA.
6. **Local task IDs must follow `"local-{uuid}"` format.** Use `crypto.randomUUID()`.
7. **Workspace items are references, not copies.** Only `{ connectorId, taskId }` in `workspace.json`.
8. **New connectors never require changes** to `core`, `web`, `vscode`, or `intellij`.
9. **SPA `apiBase` defaults to empty string (same-origin).** When served by the Node server the SPA calls `window.location.origin` — works on any port. Set `NUXT_PUBLIC_API_BASE=http://localhost:7842` only for standalone dev (Nuxt dev server ≠ Node server).

### File Modification Rules

| Path | Agent can modify? | Notes |
|---|---|---|
| `packages/core/src/types.ts` | ✅ | Single source of truth — all types here |
| `packages/core/src/connectors/types.ts` | ✅ | Connector interface — extend carefully |
| `packages/connector-*/src/**` | ✅ | Connector implementations |
| `packages/server/src/**` | ✅ | Server routes and registry |
| `apps/web/**` | ✅ | Nuxt SPA |
| `apps/vscode/src/**` | ✅ | VS Code extension |
| `apps/intellij/src/**` | ✅ | Kotlin plugin |
| `~/.dynamiatasks/config.json` | ⚠️ Via API only | Use `PUT /api/config` |
| `{project}/.tasks/*.json` | ⚠️ Via API or direct | Must maintain valid JSON array |
| `{project}/.dynamiatasks/workspace.json` | ⚠️ Via API only | Use workspace routes |

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Connector package | `connector-{name}` | `connector-github` |
| Connector class | `{Name}Connector` | `GithubConnector` |
| Connector id | lowercase kebab | `"github"`, `"local"`, `"jira-cloud"` |
| Task ID (local) | `local-{uuid}` | `local-f3a1c2b4` |
| Task ID (github) | `{num}@{owner}/{repo}` | `142@dynamia-tools/erp` |
| Vue components | PascalCase | `TaskItem.vue` |
| Pinia stores | `use*Store` | `useWorkspaceStore` |
| API routes | kebab-case | `/api/connectors/:id/sub-tasks` |

### Error Response Shape

```json
{ "error": true, "message": "Human readable message", "code": "ERROR_CODE" }
```

Common codes: `CONNECTOR_NOT_FOUND`, `CONNECTOR_NOT_CONFIGURED`, `CAPABILITY_NOT_SUPPORTED`,
`TASK_NOT_FOUND`, `WORKSPACE_NOT_FOUND`, `CACHE_ONLY`, `UPSTREAM_AUTH_FAILED`, `UPSTREAM_RATE_LIMITED`.

### Testing Checklist

- [ ] Works with only `local` connector (no GitHub token)
- [ ] Works with only `github` connector (no `.tasks/` folder)
- [ ] Both connectors active simultaneously in the same workspace
- [ ] Capabilities gate UI correctly (`local` tasks show no comments section)
- [ ] Server returns `CAPABILITY_NOT_SUPPORTED` for unsupported operations
- [ ] Workspace handles gracefully a connector that is no longer configured
- [ ] `.tasks/*.json` syntax errors don't crash server (skip + log warning)
- [ ] GitHub rate limit falls back to cache with `CACHE_ONLY` code
- [ ] Empty workspace shows empty state + CTA to open Explorer
