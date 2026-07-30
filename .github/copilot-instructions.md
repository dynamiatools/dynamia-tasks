# GitHub Copilot Instructions — Dynamia Tasks

> This file provides context for GitHub Copilot and other AI assistants working on this repository.
> See also [CLAUDE.md](../CLAUDE.md) for a peer-review-oriented summary of architecture and known issues.

---

## Project Overview

Dynamia Tasks is a **developer-first, local-only task manager** that runs as a plugin for IntelliJ IDEA and VS Code. It unifies tasks from multiple sources (GitHub Issues, local JSON files, and any third-party tool via the Connector system) into a single minimal checklist UI embedded in the IDE.

- **No cloud. No telemetry. No accounts.** Everything runs locally.
- **UI:** Nuxt 3 SPA, built statically (`ssr: false`, `nuxt generate`) and bundled into each IDE plugin. **There is no server** — no Nitro API, no child process, no HTTP layer of any kind.
- **Data access:** connectors run client-side, inside the webview's own JS context, and call `ide.fs` / `ide.store` / `ide.env` (the [ide-bridge](../../ide-bridge) library) directly.
- **IDE hosts:** IntelliJ IDEA (JCEF WebView) and VS Code (WebviewView).
- **Extensibility:** Connector system — new task sources are first-class citizens.

---

## Monorepo Structure

```
dynamia-tasks/
├── packages/
│   ├── core/               # Shared TypeScript types, TaskConnector interface, TaskService, ConfigService
│   ├── connector-local/    # Built-in: reads/writes .tasks/*.json
│   └── connector-github/   # Built-in: GitHub Issues REST API (client-side fetch, no octokit)
└── apps/
    ├── web/                # Nuxt 3 SPA (static build only, no Nitro server routes)
    ├── vscode/             # VS Code extension (TypeScript + esbuild)
    └── intellij/           # IntelliJ plugin (Kotlin + Gradle)
```

**Dependency graph:**

```
apps/web        → packages/core, packages/connector-local, packages/connector-github, ide-bridge (external sibling repo)
apps/vscode     → apps/web (bundles static .output/public/), ide-bridge-vscode (external)
apps/intellij   → apps/web (bundles static .output/public/), ide-bridge-intellij (external, published Maven artifact)
packages/connector-local   → packages/core
packages/connector-github  → packages/core
packages/core              → ide-bridge (external, file: dependency)
```

The `ide-bridge` project is a **separate sibling git repository** (`../ide-bridge` relative to this repo), referenced via `file:` dependencies at exact relative paths. This repo cannot build standalone without that sibling checked out alongside it.

---

## Core Rules — Always Follow

1. **No cloud backend, no server process.** All task/config/workspace logic runs in the webview via `TaskService` (`packages/core/src/TaskService.ts`), calling connectors directly.
2. **Never use `localStorage`** for config or tokens. Config goes through `ConfigService`, which persists via `ide.store` (see "Known Issue" below — this is not currently encrypted).
3. **Never check `connectorId` in the SPA.** Use `task.capabilities.*` to gate features:
   ```vue
   <CommentsSection v-if="task.capabilities.canComment" ... />
   ```
4. **All types come from `packages/core/src/types.ts`.** Do not duplicate type definitions anywhere.
5. **All task operations go through `taskService`** (`packages/core/src/TaskService.ts`, exposed via `useTaskService()` in `apps/web/composables/useTaskService.ts`). The SPA registers connector instances directly in `apps/web/plugins/connectors.client.ts` — there is no server API to route through.
6. **Local task IDs must use `"local-{uuid}"` format.** Always use `crypto.randomUUID()`.
7. **Workspace items are references, never copies.** Only `{ connectorId, taskId, order, addedAt }` stored in `{projectRoot}/.dynamiatasks/workspace.json`.
8. **New connectors require zero changes** to `core`, `vscode`, or `intellij` — add a new `packages/connector-{name}/` package and register it in `apps/web/plugins/connectors.client.ts`.
9. **`bridge.client.ts` must run before `connectors.client.ts`.** Nuxt plugins execute in alphabetical order (`b` < `c`), which is why the bridge init file is named that way — don't rename it without preserving the ordering.

---

## TypeScript / Nuxt (apps/web)

- Framework: **Nuxt 3**, SPA mode (`ssr: false`). `nuxt generate` produces a static site in `.output/public/` — there are no `server/api/*` routes.
- Styling: **Tailwind CSS** with a custom `dt-*` color palette (`nuxt.config.ts`).
- State: **Pinia** stores in `stores/` — `connectors`, `config`, `workspace`, `explorer`, `preferences`, `ideTheme`.
- Data access: call `useTaskService()` (wraps the `taskService` singleton from `@dynamia-tasks/core`) — never call a connector class directly from a component.
- Components: PascalCase Vue SFCs, auto-imported (no explicit imports needed).
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

3. Register it in `apps/web/plugins/connectors.client.ts`:
   ```typescript
   svc.register(new MyConnector())
   ```
4. Done — the SPA, workspace, and both IDE plugins pick it up automatically (they all bundle the same built SPA).

### `TaskConnector` Interface (summary)

| Method | Required | Notes |
|---|---|---|
| `isConfigured()` | Yes | Returns `true` if connector is ready to use |
| `configure(config)` | Yes | Receives the connector's config object |
| `getConfigSchema()` | Yes | Drives the auto-rendered Settings form |
| `fetchTasks(filter?)` | Yes | Returns `ConnectorTask[]` |
| `getTask(id)` | Yes | Returns single `ConnectorTask` |
| `updateTask(id, patch)` | Yes | Returns updated `ConnectorTask` |
| `createTask(task)` | Yes if `canCreate` | Returns new `ConnectorTask` |
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

## File System Conventions

```
ide.store (global scope, key "dynamiatasks.config.{platform}")
└── AppConfig                             # tokens, UI prefs — see ConfigService.ts

~/.dynamiatasks/config.json                # legacy config location, read-only migration fallback
                                            # (only used if ide.store has nothing yet; then re-saved into ide.store)

{projectRoot}/
├── .dynamiatasks/workspace.json          # this project's workspace list (gitignored)
└── .tasks/*.json                          # local connector task files (committable)
```

- Local task files are **plain JSON arrays** of `ConnectorTask`-compatible objects.
- IDs must be globally unique: `"local-{uuid}"`.
- Syntax errors in `.tasks/*.json` must not crash the app — `LocalConnector` skips the file and logs a warning (`console.warn`).
- **Known stray directory:** a `.dynamia/tasks/workspace.json` may exist from an earlier naming scheme — current code never writes there. If you see it, it's leftover state, not something to preserve or extend.

---

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Connector package | `connector-{name}` | `connector-jira` |
| Connector class | `{Name}Connector` | `JiraConnector` |
| Connector id | lowercase kebab | `"jira-cloud"` |
| Task ID (local) | `local-{uuid}` | `local-f3a1c2b4` |
| Vue components | PascalCase | `TaskItem.vue` |
| Pinia stores | `use*Store` | `useWorkspaceStore` |

---

## IntelliJ Plugin (apps/intellij)

- Language: **Kotlin**, build system: **Gradle** with IntelliJ Platform Gradle Plugin.
- Min IDE version: `2025.1` (build `251`).
- **No server, no child process.** `DynamiaTasksStartupListener.kt` runs on project open; `DynamiaTasksWindowFactory.kt`/`DynamiaTasksPanel.kt` host a JCEF panel that loads the bundled static SPA directly from plugin resources via `ide-bridge-intellij`.
- Bridge (fs/store/clipboard/shell/theme) comes from the external `tools.dynamia:ide-bridge-intellij` Maven artifact, not from anything in this repo.

## VS Code Extension (apps/vscode)

- Language: **TypeScript**, bundler: **esbuild** via `build.mjs`.
- Activation: `onStartupFinished` (see `src/extension.ts`).
- **No server, no child process.** `DynamiaWebView` (from the external `@dynamia-tools/ide-bridge-vscode` package) hosts a `WebviewView` (`dynamia-tasks.view`) that loads the bundled static SPA directly.

---

## GitHub Connector Auth

Classic Personal Access Token only, entered by the user in Settings (`GithubConnector.getConfigSchema()`), used directly in a `fetch` call from inside the webview (`Authorization: Bearer <token>`). No OAuth, no GitHub App, no `gh` CLI. Recommended scope per the connector's own help text: classic PAT with `repo` scope, or a fine-grained PAT with `Metadata` + `Issues` read/write — keep `README.md` and `plugin.xml` consistent with this if you touch scope guidance.

The token is persisted via `ide.secrets` (OS-keychain-backed: VS Code `SecretStorage`, IntelliJ `PasswordSafe`), not the generic `ide.store`. `TaskService` routes this automatically for any config field marked `type: 'password'` in the connector's schema — see `CLAUDE.md` for how the split/migration works.

---

## Testing Checklist

There is no automated test suite or CI in this repo (see `CLAUDE.md`). Before submitting a PR, manually verify:

- [ ] Works with only `local` connector (no GitHub token)
- [ ] Works with only `github` connector (no `.tasks/` folder)
- [ ] Both connectors active simultaneously in the same workspace
- [ ] Capabilities gate UI correctly (`local` tasks show no Comments section)
- [ ] Workspace handles gracefully a connector that is no longer configured
- [ ] `.tasks/*.json` syntax errors don't crash the app
- [ ] Empty workspace shows empty state + CTA to open Explorer
