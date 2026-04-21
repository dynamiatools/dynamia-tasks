# VS Code Extension — `apps/vscode`

## Responsabilidad

Esta extensión integra Dynamia Tasks en VS Code como un panel lateral (WebviewPanel).

## Qué hace

1. Al activarse, inicia `packages/server` como proceso Node embebido en puerto `7842`
2. Levanta un servidor de callback HTTP en puerto `7843` para recibir peticiones del servidor Node
3. Abre un `WebviewPanel` con un `<iframe>` apuntando a `http://localhost:7842`
4. Inyecta `window.__dynamia_host = 'vscode'` en el HTML del panel
5. Sirve el output estático de `apps/web` (`apps/web/.output/public/`) embebido en el bundle de la extensión

## Callback IDE Contract

```
POST http://localhost:7843/ide/open-file
Body: { "path": "/absolute/path/file.ts", "line": 42 }
→ abre el archivo en el editor con vscode.workspace.openTextDocument + showTextDocument

POST http://localhost:7843/ide/notify
Body: { "type": "info|warning|error|success", "message": "..." }
→ llama a vscode.window.showInformationMessage / showErrorMessage / showWarningMessage
```

## Stack

- TypeScript + `vsce` para packaging
- Entry: `src/extension.ts`
- Exporta: `activate(context)` y `deactivate()`

## Build pendiente

```bash
# 1. Build de la SPA
pnpm build:web

# 2. Build de la extensión
cd apps/vscode
pnpm build

# 3. Empaquetar
vsce package
```

## Dependencias previstas

- `@dynamia-tasks/server` (workspace:*)
- `@dynamia-tasks/core` (workspace:*)
- `vscode` (peer, provideada por el IDE)

## Estructura esperada

```
apps/vscode/
├── package.json
├── tsconfig.json
├── src/
│   ├── extension.ts        # activate / deactivate
│   └── callbackServer.ts   # HTTP listener port 7843
└── dist/
    └── web/                # copy of apps/web/.output/public/
```

