import * as vscode from 'vscode'
import * as os from 'node:os'
import * as path from 'node:path'
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
    security: {
      // ConfigService still reads the pre-1.0 global config from here (read-only migration).
      fsReadOnlyRoots: [path.join(os.homedir(), '.dynamiatasks')],
      // LocalConnector.resolveAuthor(): author name for local comments.
      allowedCommands: [['git', 'config', 'user.name']],
    },
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

  await notifyOnUpdate(context, log)
}

export function deactivate() { /* nothing to tear down */ }

// ── "what's new" toast ──────────────────────────────────────────────────────────

const LAST_VERSION_KEY = 'dynamiaTasks.lastSeenVersion'

/**
 * Shows a one-time notification the first time the extension activates after an update
 * (version bump), linking to CHANGELOG.md. Silent on fresh installs (nothing to compare
 * against yet) and on every activation after the first at a given version.
 */
async function notifyOnUpdate(context: vscode.ExtensionContext, log: (msg: string) => void) {
  const currentVersion = context.extension.packageJSON.version as string
  const lastVersion = context.globalState.get<string>(LAST_VERSION_KEY)

  if (lastVersion === currentVersion) return
  await context.globalState.update(LAST_VERSION_KEY, currentVersion)

  if (!lastVersion) return // fresh install, not an update

  log(`[dynamia-tasks] updated ${lastVersion} → ${currentVersion}`)
  const choice = await vscode.window.showInformationMessage(
    `Dynamia Tasks updated to v${currentVersion}.`,
    'View Changelog',
  )
  if (choice === 'View Changelog') {
    void vscode.env.openExternal(
      vscode.Uri.parse('https://github.com/dynamiatools/dynamia-tasks/blob/main/apps/vscode/CHANGELOG.md'),
    )
  }
}

