# GitHub Copilot Instructions — Dynamia Tasks

> This file provides context for GitHub Copilot and other AI assistants working on this repository.
> For the full architecture reference see [ARCHITECTURE.md](../ARCHITECTURE.md).

---

## Project Overview

Dynamia Tasks is a **developer-first, local-only task manager** that runs as a plugin for IntelliJ IDEA and VS Code. It unifies tasks from multiple sources (GitHub Issues, local JSON files, and any third-party tool via the Connector system) into a single minimal checklist UI embedded in the IDE.

- **No cloud. No telemetry. No accounts.** Everything runs locally.
- **UI:** Nuxt 3 SPA (static, SPA mode) served by the local Node server.
- **Server:** Node.js + Nuxt Nitro (replaces the old Fastify server), runs per-project.
- **IDE hosts:** IntelliJ IDEA (JCEF WebView) and VS Code (WebviewPanel).
- **Extensibility:** Connector system — new task sources are first-class citizens.

---

## Monorepo Structure

```
dynamia-tasks/
├── packages/
│   ├── core/               # Shared TypeScript types + TaskConnector interface
│   ├── connector-local/    # Built-in: reads/writes .tasks/*.json
│   └── connector-github/   # Built-in: GitHub Issues REST API
└── apps/
    ├── web/                # Nuxt 3 SPA + Nitro server (replaces packages/server)
    ├── vscode/             # VS Code extension (TypeScript + esbuild)
    └── intellij/           # IntelliJ plugin (Kotlin + Gradle)
```

**Dependency graph:**

```
apps/web        → packages/core, packages/connector-local, packages/connector-github
apps/vscode     → apps/web (bundles server output)
apps/intellij   → apps/web (bundles Nuxt .output/)
packages/connector-local   → packages/core
packages/connector-github  → packages/core
packages/core              → (no internal deps)
```

---

## Core Rules — Always Follow

1. **No cloud backend.** The server (`apps/web` Nitro) runs entirely on the developer's machine.
2. **Never use `localStorage`** for config or tokens. Use the API: `PUT /api/config/connectors/:id`.
3. **Never check `connectorId` in the SPA.** Use `task.capabilities.*` to gate features:
   ```vue
   <CommentsSection v-if="task.capabilities.canComment" ... />
   ```
4. **All types come from `packages/core/src/types.ts`.** Do not duplicate type definitions anywhere.
5. **All task operations go through the server API** (`/api/connectors/:id/*`). The SPA never imports connector packages directly.
6. **Local task IDs must use `"local-{uuid}"` format.** Always use `crypto.randomUUID()`.
7. **Workspace items are references, never copies.** Only `{ connectorId, taskId }` stored in `workspace.json`.
8. **New connectors require zero changes** to `core`, `web`, `vscode`, or `intellij` — only add a new `packages/connector-{name}/` package.
9. **SPA `apiBase` defaults to `""` (same-origin).** When served by Nitro, the SPA calls `window.location.origin`. Set `NUXT_PUBLIC_API_BASE=http://localhost:7842` only for standalone dev (`nuxt dev` ≠ Nitro).

---

## TypeScript / Nuxt (apps/web)

- Framework: **Nuxt 3**, SPA mode (`ssr: false`), Nitro for server routes.
- Styling: **Tailwind CSS** with the custom `dt-*` color palette (defined in `nuxt.config.ts`).
- State: **Pinia** stores in `stores/` — `connectors`, `config`, `workspace`, `explorer`, `preferences`.
- API calls: always use the `useApi()` composable from `composables/useApi.ts`.
- Components: PascalCase Vue SFCs. All auto-imported (no explicit imports needed).
- Server routes (`server/api/`) are Nitro handlers; they replace the old standalone Fastify server.
- Do **not** add new `<script setup>` imports for stores/composables — Nuxt auto-imports them.

### Capability-Driven UI Pattern

```vue
<!-- CORRECT — check capabilities, never connectorId -->
<template>
  <SubtasksSection v-if="task.capabilities.canSubtasks" :task="task" />
  <CommentsSection v-if="task.capabilities.canComment" :task="task" />
</template>

<!-- WRONG — never do this -->
<template>
  <SubtasksSection v-if="task.connectorId === 'github'" :task="task" />
</template>
```

---

## Connector System

### Adding a New Connector

1. Create `packages/connector-{name}/` with `package.json`, `tsconfig.json`, and `src/index.ts`.
2. Implement `TaskConnector` from `@dynamia-tasks/core`:

```typescript
import type { TaskConnector, ConnectorTask, TaskFilter, NewTask, TaskPatch } from '@dynamia-tasks/core'

export class MyConnector implements TaskConnector {
  readonly id = 'my-connector'           // unique, lowercase kebab
  readonly name = 'My Source'
  readonly icon = ''
  readonly capabilities = {
    canCreate: true, canDelete: false, canEdit: true,
    canComment: false, canSubtasks: false, canAssign: false,
    canLabel: true, hasDetail: true, hasExplorer: false,
  }

  async isConfigured(): Promise<boolean> { ... }
  async configure(config: unknown): Promise<void> { ... }
  getConfigSchema() { return { fields: [...] } }

  async fetchTasks(filter?: TaskFilter): Promise<ConnectorTask[]> { ... }
  async getTask(id: string): Promise<ConnectorTask> { ... }
  async updateTask(id: string, patch: TaskPatch): Promise<ConnectorTask> { ... }
  async createTask(task: NewTask): Promise<ConnectorTask> { ... }
}
```

3. Register in the server connector registry. For Nuxt, this is in `apps/web/server/plugins/connectors.ts` (or equivalent server plugin).
4. ✅ Done — the SPA, workspace, and IDE plugins work automatically.

### `TaskConnector` Interface (summary)

| Method | Required | Notes |
|---|---|---|
| `isConfigured()` | ✅ | Returns `true` if connector is ready to use |
| `configure(config)` | ✅ | Receives the connector's config object |
| `getConfigSchema()` | ✅ | Drives the auto-rendered Settings form |
| `fetchTasks(filter?)` | ✅ | Returns `ConnectorTask[]` |
| `getTask(id)` | ✅ | Returns single `ConnectorTask` |
| `updateTask(id, patch)` | ✅ | Returns updated `ConnectorTask` |
| `createTask(task)` | ✅ if `canCreate` | Returns new `ConnectorTask` |
| `deleteTask?(id)` | Optional | Guard with `canDelete` |
| `fetchComments?(id)` | Optional | Guard with `canComment` |
| `addComment?(id, body)` | Optional | Guard with `canComment` |
| `fetchSubtasks?(id)` | Optional | Guard with `canSubtasks` |
| `fetchSources?()` | Optional | Guard with `hasExplorer` |

---

## Data Models

All models live in `packages/core/src/types.ts`. Never define task-related types elsewhere.

Key models:
- **`ConnectorTask`** — normalized task from any source
- **`TaskView`** — `ConnectorTask` + `connectorName`, `connectorIcon`, `capabilities` (UI-only, never persisted)
- **`WorkspaceItem`** — `{ connectorId, taskId, order, addedAt }` — reference only
- **`AppConfig`** — `{ connectors: {...}, ui: { theme, groupBy, defaultView } }`
- **`ConnectorCapabilities`** — declares what a connector supports

---

## Server API Routes

The Nuxt Nitro server exposes the full API. All routes are prefixed `/api/`:

| Category | Route | Method |
|---|---|---|
| Connectors | `/api/connectors` | `GET` |
| Connectors | `/api/connectors/:id/schema` | `GET` |
| Config | `/api/config` | `GET`, `PUT` |
| Config | `/api/config/connectors/:id` | `GET`, `PUT` |
| Tasks | `/api/connectors/:id/tasks` | `GET`, `POST` |
| Tasks | `/api/connectors/:id/tasks/:taskId` | `GET`, `PATCH`, `DELETE` |
| Comments | `/api/connectors/:id/tasks/:taskId/comments` | `GET`, `POST` |
| Subtasks | `/api/connectors/:id/tasks/:taskId/subtasks` | `GET`, `POST`, `DELETE` |
| Sources | `/api/connectors/:id/sources` | `GET` |
| Workspace | `/api/workspace` | `GET` |
| Workspace | `/api/workspace/add` | `POST` |
| Workspace | `/api/workspace/:connectorId/:taskId` | `DELETE` |
| Workspace | `/api/workspace/reorder` | `PATCH` |
| IDE | `/api/ide/open-file` | `POST` |
| IDE | `/api/ide/notify` | `POST` |
| Instance | `/api/instance` | `GET` |

**Error response shape:**
```json
{ "error": true, "message": "Human readable message", "code": "ERROR_CODE" }
```

Common codes: `CONNECTOR_NOT_FOUND`, `CONNECTOR_NOT_CONFIGURED`, `CAPABILITY_NOT_SUPPORTED`, `TASK_NOT_FOUND`, `UPSTREAM_AUTH_FAILED`, `CACHE_ONLY`.

---

## File System Conventions

```
~/.dynamiatasks/
├── config.json                          # Global config (tokens, UI prefs)
├── instances/<sha1(projectPath)[:12]>.json  # Port + PID registry per project
└── cache/{connectorId}-{sourceId}.json  # Offline cache

{projectRoot}/
├── .dynamiatasks/workspace.json         # This project's task list (gitignore)
└── .tasks/*.json                        # Local connector task files (committable)
```

- Local task files are **plain JSON arrays** of `ConnectorTask`-compatible objects.
- IDs must be globally unique: `"local-{uuid}"`.
- Syntax errors in `.tasks/*.json` must not crash the server — skip + log warning.

---

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Connector package | `connector-{name}` | `connector-jira` |
| Connector class | `{Name}Connector` | `JiraConnector` |
| Connector id | lowercase kebab | `"jira-cloud"` |
| Task ID (local) | `local-{uuid}` | `local-f3a1c2b4` |
| Task ID (github) | `{num}@{owner}/{repo}` | `142@org/repo` |
| Vue components | PascalCase | `TaskItem.vue` |
| Pinia stores | `use*Store` | `useWorkspaceStore` |
| API routes | kebab-case | `/api/connectors/:id/sub-tasks` |
| Nuxt server routes | `server/api/**` | `server/api/workspace/index.get.ts` |

---

## IntelliJ Plugin (apps/intellij)

- Language: **Kotlin**, build system: **Gradle** with IntelliJ Platform Plugin SDK.
- Min IDE version: `2025.1` (build `251`).
- The plugin spawns the Nuxt Nitro server as a child Node process via `ProcessBuilder`.
- Port discovery: parse stdout line `✓ dynamia-tasks server running on http://localhost:<PORT>` or read `~/.dynamiatasks/instances/<hash>.json`.
- JCEF panel injects `window.__dynamia_host = 'intellij'` before page load.
- IDE callback server handles `POST /ide/open-file` and `POST /ide/notify`.
- **Do NOT pass `--port`** to the server — let it auto-select.

---

## VS Code Extension (apps/vscode)

- Language: **TypeScript**, bundler: **esbuild** via `build.mjs`.
- Activation: `onStartupFinished`.
- The extension spawns the Nuxt Nitro server, discovers its port, then opens a `WebviewPanel` (sidebar `dynamia-tasks.view`).
- Injects `window.__dynamia_host = 'vscode'`.
- IDE callback server on an auto-selected port (from 7843) handles file-open and notifications.
- **Do NOT pass `--port`** to the server — let it auto-select.

---

## Testing Checklist

Before submitting a PR, verify:

- [ ] Works with only `local` connector (no GitHub token)
- [ ] Works with only `github` connector (no `.tasks/` folder)
- [ ] Both connectors active simultaneously in the same workspace
- [ ] Capabilities gate UI correctly (`local` tasks show no Comments section)
- [ ] Server returns `CAPABILITY_NOT_SUPPORTED` for unsupported operations
- [ ] Workspace handles gracefully a connector that is no longer configured
- [ ] `.tasks/*.json` syntax errors don't crash the server
- [ ] GitHub rate limit falls back to cache with `CACHE_ONLY` code
- [ ] Empty workspace shows empty state + CTA to open Explorer
