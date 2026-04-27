import * as vscode from 'vscode'
import { IdeCallbackServer } from './callbackServer'
import { ServerProcess }     from './serverProcess'
import { resolveServerBundle } from './nodeResolver'

let callbackServer: IdeCallbackServer | null = null
let serverProcess:  ServerProcess     | null = null
let viewProvider:   DynamiaTasksViewProvider | null = null

// ── activation ─────────────────────────────────────────────────────────────

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('Dynamia Tasks')
  context.subscriptions.push(outputChannel)
  const log = (msg: string) => outputChannel.appendLine(msg)

  log('[dynamia-tasks] extension activating…')

  // 1. Register the sidebar WebviewView provider immediately
  //    (VS Code shows the icon + empty panel while the server starts)
  const provider = new DynamiaTasksViewProvider(log)
  viewProvider = provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('dynamia-tasks.view', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  )

  // 2. Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('dynamia-tasks.open', () =>
      vscode.commands.executeCommand('dynamia-tasks.view.focus'),
    ),
    vscode.commands.registerCommand('dynamia-tasks.restart', () =>
      restart(context, log),
    ),
  )

  // 3. Bootstrap the server in the background
  bootstrap(context, log).catch(err => {
    const msg = err instanceof Error ? err.message : String(err)
    log(`[dynamia-tasks] bootstrap failed: ${msg}`)
    provider.showError(msg)
    vscode.window.showErrorMessage(`Dynamia Tasks failed to start: ${msg}`)
  })

  // 4. When the user opens a folder (or switches workspace), restart to pick up the new project
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => restart(context, log)),
  )
}

// ── deactivation ────────────────────────────────────────────────────────────

export function deactivate() {
  serverProcess?.stop()
  serverProcess = null
  callbackServer?.stop()
  callbackServer = null
  viewProvider = null
}

// ── bootstrap ───────────────────────────────────────────────────────────────

async function bootstrap(
  context: vscode.ExtensionContext,
  log: (msg: string) => void,
) {
  const projectPath =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
    require('node:os').homedir()
  log(`[dynamia-tasks] projectPath: ${projectPath}`)

  // Start IDE callback server
  const cb = new IdeCallbackServer()
  const callbackPort = await cb.start(7843)
  callbackServer = cb
  log(`[dynamia-tasks] callback server on :${callbackPort}`)

  // Use VS Code's own Node runtime by default; allow explicit override for debugging.
  const nodeExe      = process.env['DYNAMIA_NODE_EXE'] ?? process.execPath
  const serverBundle = resolveServerBundle(context.extensionPath)
  log(`[dynamia-tasks] node: ${nodeExe}`)
  log(`[dynamia-tasks] bundle: ${serverBundle}`)

  // Start Node server
  const srv = new ServerProcess(
    nodeExe,
    serverBundle,
    projectPath,
    `http://127.0.0.1:${callbackPort}`,
    log,
  )
  const serverPort = await srv.start()
  serverProcess = srv
  log(`[dynamia-tasks] Node server on :${serverPort} for ${projectPath}`)

  // Tell the view to load the app
  viewProvider?.setPort(serverPort)
}

// ── restart ──────────────────────────────────────────────────────────────

async function restart(
  context: vscode.ExtensionContext,
  log: (msg: string) => void,
) {
  log('[dynamia-tasks] restarting…')
  serverProcess?.stop();  serverProcess = null
  callbackServer?.stop(); callbackServer = null
  viewProvider?.showLoading()

  try {
    await bootstrap(context, log)
    vscode.window.showInformationMessage('Dynamia Tasks restarted.')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    viewProvider?.showError(msg)
    vscode.window.showErrorMessage(`Dynamia Tasks restart failed: ${msg}`)
  }
}

// ── WebviewViewProvider ──────────────────────────────────────────────────

class DynamiaTasksViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | null = null
  private port: number | null = null

  constructor(private readonly log: (msg: string) => void) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this.view = webviewView
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    }
    webviewView.webview.onDidReceiveMessage(message => {
      if (message?.command === 'restart') {
        void vscode.commands.executeCommand('dynamia-tasks.restart')
      }
    })

    if (this.port !== null) {
      webviewView.webview.html = this.buildAppHtml(this.port)
    } else {
      webviewView.webview.html = this.buildLoadingHtml()
    }
  }

  setPort(port: number) {
    this.port = port
    if (this.view) {
      this.view.webview.html = this.buildAppHtml(port)
      this.log(`[dynamia-tasks] sidebar view → http://localhost:${port}`)
    }
  }

  showLoading() {
    this.port = null
    if (this.view) this.view.webview.html = this.buildLoadingHtml()
  }

  showError(message: string) {
    if (this.view) this.view.webview.html = this.buildErrorHtml(message)
  }

  // ── HTML templates ──────────────────────────────────────────────────────

  private buildAppHtml(port: number): string {
    const origin = `http://localhost:${port}`
    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-src *;"
  >
  <style>
    html, body { margin:0; padding:0; width:100%; height:100vh; overflow:hidden; background:#1e1e1e; }
    iframe { width:100%; height:100%; border:none; display:block; }
  </style>
</head>
<body>
  <script>window.__dynamia_host = 'vscode'</script>
  <iframe src="${origin}" allow="*"
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals">
  </iframe>
</body>
</html>`
  }

  private buildLoadingHtml(): string {
    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      display:flex; align-items:center; justify-content:center;
      height:100vh; margin:0;
      font-family: var(--vscode-font-family, sans-serif);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      flex-direction: column; gap: 12px;
    }
    .spinner {
      width:24px; height:24px;
      border:2px solid var(--vscode-foreground);
      border-top-color:transparent;
      border-radius:50%;
      animation: spin .8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { font-size:12px; opacity:.7; margin:0; }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <p>Starting Dynamia Tasks…</p>
</body>
</html>`
  }

  private buildErrorHtml(message: string): string {
    const safe = message.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      display:flex; align-items:center; justify-content:center;
      height:100vh; margin:0; padding:16px; box-sizing:border-box;
      font-family: var(--vscode-font-family, sans-serif);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      flex-direction:column; gap:8px; text-align:center;
    }
    .icon { font-size:32px; }
    h4 { margin:0; font-size:13px; }
    p  { font-size:11px; opacity:.6; margin:0; word-break:break-word; }
    button {
      margin-top:8px; padding:4px 12px; cursor:pointer; font-size:12px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border:none; border-radius:2px;
    }
  </style>
</head>
<body>
  <div class="icon">⚠️</div>
  <h4>Dynamia Tasks failed to start</h4>
  <p>${safe}</p>
  <button onclick="executeCommand()">Retry</button>
  <script>
    const vscode = acquireVsCodeApi();
    function executeCommand() {
      vscode.postMessage({ command: 'restart' });
    }
  </script>
</body>
</html>`
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

