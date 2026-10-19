# Dynamia Tasks

IDE plugin (VS Code + JetBrains/IntelliJ) that brings GitHub issues and local `.dynamia/tasks/*.json` files into one checklist inside the IDE. Local-first, no cloud backend, no telemetry. MIT licensed.

## Actual architecture (do not trust `README.md` / `.github/copilot-instructions.md` / `ARCHITECTURE.md` on this point)

**There is no server.** `README.md` and `.github/copilot-instructions.md` describe a Nitro/Node server process exposing `/api/connectors/:id/tasks` etc. That design was abandoned; the code was refactored away from it and the docs were never updated. `ARCHITECTURE.md`, referenced by both README and CONTRIBUTING, **does not exist**. Before proposing anything that touches "the server" or `apps/web/server/...`, verify against the code below — that path doesn't exist.

What's actually true:
- `apps/web` is a **Nuxt 3 SPA built with `ssr: false`** (`nuxt generate` → static `.output/public/`, no Nitro API routes at all).
- Connectors (`GithubConnector`, `LocalConnector`) run **client-side, inside the webview JS context** (JCEF for IntelliJ, VS Code `WebviewView`). `apps/web/plugins/connectors.client.ts` instantiates them and registers them into `packages/core/src/TaskService.ts`, a singleton service layer that replaced the old HTTP API entirely.
- GitHub REST calls (raw `fetch` to `api.github.com`, no octokit) happen directly from `packages/connector-github/src/GithubConnector.ts` inside the webview.
- Native IDE access (fs, store, clipboard, shell, theme) is delegated to the **external sibling repo** `../ide-bridge` (own git repo), pulled in via `file:../../../ide-bridge/ide-bridge`-style dependencies. **This repo cannot build standalone without that sibling checked out at the exact relative path.** See `../ide-bridge/CLAUDE.md` for that side.
- Auth is a **GitHub classic Personal Access Token**, entered by the user in Settings, sent client-side. No OAuth, no GitHub App, no `gh` CLI.

## Directory map

```
apps/
  web/           Nuxt 3 SPA (shared UI for both IDEs) — pages/, components/, stores/ (Pinia), plugins/connectors.client.ts, plugins/bridge.client.ts
  vscode/        VS Code extension — src/extension.ts is the entry point; build.mjs bundles + copies apps/web/.output/public → dist/web
  intellij/      IntelliJ plugin — plugin.xml, src/main/kotlin/tools/dynamia/tasks/ (DynamiaTasksStartupListener.kt, DynamiaTasksWindowFactory.kt, DynamiaTasksPanel.kt); build.gradle.kts copies the built SPA into plugin resources
packages/
  core/          Canonical types (types.ts), TaskConnector interface (connectors/types.ts), TaskService.ts (service layer), ConfigService.ts
  connector-local/   Reads/writes {project}/.dynamia/tasks/*.json
  connector-github/  GitHub REST client
```

New connectors: create `packages/connector-{name}/` (package.json, tsconfig.json, src/index.ts, a class implementing `TaskConnector` from `packages/core/src/connectors/types.ts`), then register it in **`apps/web/plugins/connectors.client.ts`** — CONTRIBUTING.md says "Server Registry" at `apps/web/server/utils/registry.ts`; that path doesn't exist, ignore it.

## Build commands

```bash
pnpm install
pnpm build            # nuxt generate for apps/web
pnpm build:intellij    # build web + ./apps/intellij/gradlew buildPlugin
pnpm build:vscode      # build web + esbuild + vsce package
pnpm dev               # apps/web dev server only
```

`pnpm test` runs vitest in `packages/core`, `connector-local` and `connector-github` (tests live in each package's `test/`, outside `src/` so `tsc` does not emit them; they use `NodeBridge` on a temp dir or a stubbed `fetch`). There are no UI tests and no lint tooling (no ESLint/Prettier config; `apps/vscode`'s `"lint"` script is actually `tsc --noEmit`, a type-check). No CI workflow exists (`.github/` has only `copilot-instructions.md`, no `workflows/`), so nothing gates a merge automatically.

The bridge is deny-by-default (see `../ide-bridge/CLAUDE.md`): `apps/vscode/src/extension.ts` and `DynamiaTasksPanel.kt` pass the only extras this plugin needs (read-only `~/.dynamiatasks`, the exact command `git config user.name`). Any new `ide.fs`/`ide.shell` use outside the project path must be added there.

## Secret storage

GitHub PAT storage goes through `ide.secrets` (OS-keychain-backed: VS Code `SecretStorage`, IntelliJ `PasswordSafe`), not the plaintext `ide.store`. `TaskService` (`packages/core/src/TaskService.ts`) automatically routes any connector config field declared as `type: 'password'` in `getConfigSchema()` to `ide.secrets`, keyed `dynamiatasks.secret.{connectorId}.{field}`, and strips it from the `AppConfig` blob persisted via `ide.store`. It also transparently migrates any legacy plaintext value still found inline in an existing `AppConfig.connectors[id]` the first time `init()`/`getConnectorConfig()` runs. New connectors get this for free by marking a field `type: 'password'` in their schema — don't add a parallel storage path for secrets, and don't persist a `type: 'password'` field's value anywhere except through this path.

## Known issues worth flagging before extending

- **All per-project state lives in `.dynamia/tasks/`** (`*.json` task lists, `workspace.json`, `comments.json`), resolved by `tasksDir()` in `packages/core/src/tasksDir.ts`. Never hardcode the path; `isTaskListFile()` excludes `workspace.json`/`comments.json` from task lists. `migrateLegacyState` copies the old `.tasks/*.json` and `.dynamiatasks/workspace.json` once (no overwrite, no delete). `~/.dynamiatasks/config.json` is only a read-only legacy fallback for global config.
- **External edits are detected by polling** (`watchTasksDir`, 2s, fingerprint of every `*.json` in the dir; paused while the webview is hidden), because the bridge has no `fs.watch`. `TaskService.onChange()` exposes it, `layouts/default.vue` subscribes, and pages `watch(useTasksVersion())`. Replace with a bridge-level watcher if polling cost matters.
- `.gitignore` ignores `.dynamia/*` except `.dynamia/tasks/`, and within it `workspace.json` and `comments.json`; `backlog.json` is tracked. Note `ms-workspace workspace-init` in single-repo mode excludes `.dynamia/` locally via `.git/info/exclude`, which would hide the backlog from git in that setup.
- Version numbers are independent per artifact on purpose: root `package.json` 1.0.0, `apps/web` and `apps/vscode`/`apps/intellij` track their own versions. Don't "fix" this into a single version unless asked.

## Conventions

- Route all task operations through `TaskService`/connectors — never call a connector directly from `apps/web` UI code, and never reintroduce an HTTP API layer.
- Use capability-driven UI checks (`task.capabilities.canComment`, etc.), never `connectorId === 'github'` checks — this is followed consistently in the current code, keep it that way.
- Never use `localStorage` for connector config or tokens (CONTRIBUTING.md rule) — use `TaskService`, which routes `type: 'password'` fields to `ide.secrets` automatically (see above).
- Keep all task-related types in `packages/core/src/types.ts`.
- GitHub PAT scope guidance is kept consistent across `README.md`, `plugin.xml`, and `GithubConnector.getConfigSchema()` help text (classic `repo`, or fine-grained `Metadata`+`Issues`) — update all three together if it changes.
- Standard GitHub flow for PRs (fork → branch from `main` → focused commits); no enforced commit-message convention despite the git log looking conventional-commit-ish (`feat:` used almost universally, including for what are really fixes/refactors).
