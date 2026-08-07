# Dynamia Tasks

IDE plugin (VS Code + JetBrains/IntelliJ) that brings GitHub issues and local `.tasks/*.json` files into one checklist inside the IDE. Local-first, no cloud backend, no telemetry. MIT licensed.

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
  connector-local/   Reads/writes {project}/.tasks/*.json
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

**`pnpm test` is broken as written** — root script is `pnpm -r test`, but no package in the workspace defines a `test` script; it will error or no-op. There is no test framework anywhere in the repo (no vitest/jest, no `.test.ts` files) and no lint tooling (no ESLint/Prettier config; `apps/vscode`'s `"lint"` script is actually `tsc --noEmit`, a type-check, not a lint pass). No CI workflow exists (`.github/` has only `copilot-instructions.md`, no `workflows/`). Don't assume tests or CI gate anything — they don't, today.

## Secret storage

GitHub PAT storage goes through `ide.secrets` (OS-keychain-backed: VS Code `SecretStorage`, IntelliJ `PasswordSafe`), not the plaintext `ide.store`. `TaskService` (`packages/core/src/TaskService.ts`) automatically routes any connector config field declared as `type: 'password'` in `getConfigSchema()` to `ide.secrets`, keyed `dynamiatasks.secret.{connectorId}.{field}`, and strips it from the `AppConfig` blob persisted via `ide.store`. It also transparently migrates any legacy plaintext value still found inline in an existing `AppConfig.connectors[id]` the first time `init()`/`getConnectorConfig()` runs. New connectors get this for free by marking a field `type: 'password'` in their schema — don't add a parallel storage path for secrets, and don't persist a `type: 'password'` field's value anywhere except through this path.

## Known issues worth flagging before extending

- **Three inconsistent state-directory conventions are in play**: `.tasks/*.json` (actual local-connector storage, confirmed in code), `.dynamiatasks/workspace.json` per-project (what `TaskService.ts` actually writes) and `~/.dynamiatasks/...` (global config/cache per docs), plus a leftover `.dynamia/tasks/workspace.json` on disk that current code doesn't write to. Don't assume any of the docs' naming is current — check `TaskService.ts`/`ConfigService.ts`/`LocalConnector.ts` directly.
- `.tasks/backlog.json` is tracked in git despite `.gitignore` blanket-ignoring `.tasks/` (it was committed before the rule existed); `.tasks/comments.json` is ignored. `apps/web/dist` is untracked and not actually covered by `.gitignore` either. Don't assume gitignore patterns match reality — check `git status`/`git check-ignore` before relying on them.
- Version numbers are independent per artifact on purpose: root `package.json` 1.0.0, `apps/web` and `apps/vscode`/`apps/intellij` track their own versions. Don't "fix" this into a single version unless asked.

## Conventions

- Route all task operations through `TaskService`/connectors — never call a connector directly from `apps/web` UI code, and never reintroduce an HTTP API layer.
- Use capability-driven UI checks (`task.capabilities.canComment`, etc.), never `connectorId === 'github'` checks — this is followed consistently in the current code, keep it that way.
- Never use `localStorage` for connector config or tokens (CONTRIBUTING.md rule) — use `TaskService`, which routes `type: 'password'` fields to `ide.secrets` automatically (see above).
- Keep all task-related types in `packages/core/src/types.ts`.
- GitHub PAT scope guidance is kept consistent across `README.md`, `plugin.xml`, and `GithubConnector.getConfigSchema()` help text (classic `repo`, or fine-grained `Metadata`+`Issues`) — update all three together if it changes.
- Standard GitHub flow for PRs (fork → branch from `main` → focused commits); no enforced commit-message convention despite the git log looking conventional-commit-ish (`feat:` used almost universally, including for what are really fixes/refactors).
