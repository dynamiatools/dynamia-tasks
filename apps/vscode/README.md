# VS Code Extension — `apps/vscode`

## Responsibility

This extension integrates Dynamia Tasks into VS Code as a side panel (WebviewPanel).

## What It Does

1. On activation, starts `packages/server` as an embedded Node process **without** `--port`, letting the CLI auto-select the first free port from `7842`. The actual port is discovered by:
   - Parsing the stdout line `✓ dynamia-tasks server running on http://localhost:<PORT>`
   - Or reading `~/.dynamiatasks/instances/<sha1(projectPath)[0..12]>.json` → field `port`
2. Starts an IDE callback HTTP server on an auto-selected port (starting from 7843) and passes `--ide-callback http://127.0.0.1:<callbackPort>` to the Node server.
3. Opens a `WebviewPanel` with an `<iframe>` pointing to `http://localhost:<PORT>` (discovered in step 1).
4. Injects `window.__dynamia_host = 'vscode'` into the panel HTML. The SPA uses `window.location.origin` as its API base — no port is hardcoded in the frontend.
5. Serves the static output of `apps/web` (`apps/web/.output/public/`) bundled with the extension.

## Callback IDE Contract

The IDE callback server listens on an **auto-selected free port** (starting from 7843). The port is passed to the Node server via `--ide-callback http://127.0.0.1:<callbackPort>`.

```
POST http://127.0.0.1:<callbackPort>/ide/open-file
Body: { "path": "/absolute/path/file.ts", "line": 42 }
→ opens the file in the editor via vscode.workspace.openTextDocument + showTextDocument

POST http://127.0.0.1:<callbackPort>/ide/notify
Body: { "type": "info|warning|error|success", "message": "..." }
→ calls vscode.window.showInformationMessage / showErrorMessage / showWarningMessage
```

## Stack

- TypeScript + `vsce` for packaging
- Entry: `src/extension.ts`
- Exports: `activate(context)` and `deactivate()`

## Build

```bash
# 1. Build the SPA
pnpm build:web

# 2. Build the extension
cd apps/vscode
pnpm build

# 3. Package
vsce package
```

## Dependencies

- `@dynamia-tasks/server` (workspace:*)
- `@dynamia-tasks/core` (workspace:*)
- `vscode` (peer, provided by the IDE)

## Expected Structure

```
apps/vscode/
├── package.json
├── tsconfig.json
├── src/
│   ├── extension.ts        # activate / deactivate
│   └── callbackServer.ts   # HTTP listener on auto-selected port
└── dist/
    └── web/                # copy of apps/web/.output/public/
```

