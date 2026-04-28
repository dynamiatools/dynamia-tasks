import * as vscode from 'vscode'
import { DynamiaWebView } from '@dynamia-tools/ide-bridge-vscode'

// ── activation ────────────────────────────────────────────────────────────────

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('Dynamia Tasks')
  context.subscriptions.push(outputChannel)
  const log = (msg: string) => outputChannel.appendLine(msg)

  log('[dynamia-tasks] activating…')

  const webview = new DynamiaWebView({
    extensionContext: context,
    log,
    debugMode: false,
  })

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('dynamia-tasks.view', webview, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('dynamia-tasks.open', () =>
      vscode.commands.executeCommand('dynamia-tasks.view.focus'),
    ),
    vscode.commands.registerCommand('dynamia-tasks.restart', () => webview.reload()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => webview.reload()),
  )
}

export function deactivate() { /* nothing to tear down */ }

