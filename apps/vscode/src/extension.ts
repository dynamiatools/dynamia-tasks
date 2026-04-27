import * as vscode from 'vscode'
import * as path from 'node:path'
import * as os from 'node:os'
import { VsCodeBridgeHost, buildBridgeWebviewHtml } from '@dynamia-tools/ide-bridge-vscode'

// ── activation ────────────────────────────────────────────────────────────────

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('Dynamia Tasks')
  context.subscriptions.push(outputChannel)
  const log = (msg: string) => outputChannel.appendLine(msg)

  log('[dynamia-tasks] activating…')

  const provider = new DynamiaTasksViewProvider(context, log)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('dynamia-tasks.view', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('dynamia-tasks.open', () =>
      vscode.commands.executeCommand('dynamia-tasks.view.focus'),
    ),
    vscode.commands.registerCommand('dynamia-tasks.restart', () => provider.reload()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => provider.reload()),
  )
}

export function deactivate() { /* nothing to tear down */ }

// ── WebviewViewProvider ───────────────────────────────────────────────────────

class DynamiaTasksViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | null  = null
  private bridgeHost: VsCodeBridgeHost | null = null

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly log: (msg: string) => void,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _ctx: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this.view = webviewView
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'dist', 'web')),
      ],
    }
    void this.loadBridge(webviewView)
  }

  reload() {
    if (this.view) void this.loadBridge(this.view)
  }

  // ── private ──────────────────────────────────────────────────────────────

  private async loadBridge(webviewView: vscode.WebviewView): Promise<void> {
    const projectPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? os.homedir()
    this.log(`[dynamia-tasks] projectPath: ${projectPath}`)

    // Attach extension-host bridge (handles all ide.* calls from the SPA)
    this.bridgeHost = new VsCodeBridgeHost(webviewView.webview, projectPath)

    const devUrl    = process.env['DYNAMIA_DEV_URL']
    const spaDistDir = path.join(this.context.extensionPath, 'dist', 'web')

    webviewView.webview.html = await buildBridgeWebviewHtml({
      devUrl,
      spaDistDir: devUrl ? undefined : spaDistDir,
      webview:    webviewView.webview,
      projectPath,
      homePath:   os.homedir(),
    })

    this.log(`[dynamia-tasks] webview loaded (${devUrl ? `dev → ${devUrl}` : 'production'})`)
  }
}
