import * as vscode from 'vscode'
import * as os from 'node:os'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { DynamiaWebView } from '@dynamia-tools/ide-bridge-vscode'

// ── MCP server ────────────────────────────────────────────────────────────────

// Same location the web settings page and the IntelliJ plugin use.
const MCP_INSTALLED_FILE = path.join(os.homedir(), '.dynamiatasks', 'mcp', 'dynamia-tasks-mcp.mjs')

/** Copies the bundled MCP server to a stable path every client (Claude Code, IntelliJ, ...) can point at. */
function installMcpServer(context: vscode.ExtensionContext, log: (msg: string) => void): boolean {
  const bundled = path.join(context.extensionPath, 'dist', 'mcp', 'dynamia-tasks-mcp.mjs')
  if (!fs.existsSync(bundled)) {
    log('[dynamia-tasks] MCP server not bundled in this build')
    return false
  }
  try {
    const current = fs.existsSync(MCP_INSTALLED_FILE) ? fs.readFileSync(MCP_INSTALLED_FILE) : null
    const next = fs.readFileSync(bundled)
    if (!current || !current.equals(next)) {
      fs.mkdirSync(path.dirname(MCP_INSTALLED_FILE), { recursive: true })
      fs.writeFileSync(MCP_INSTALLED_FILE, next)
      log(`[dynamia-tasks] MCP server installed → ${MCP_INSTALLED_FILE}`)
    }
    return true
  } catch (e) {
    log(`[dynamia-tasks] could not install the MCP server: ${(e as Error).message}`)
    return false
  }
}

/**
 * Makes the server show up in VS Code's own MCP list (Copilot Chat etc.).
 * The API arrived in VS Code 1.101 and @types/vscode here is older, so it is feature-detected.
 */
function registerMcpProvider(context: vscode.ExtensionContext, log: (msg: string) => void) {
  // shortcut: untyped access; use the typed API once engines.vscode is raised to >=1.101.
  const lm = (vscode as any).lm
  const McpStdio = (vscode as any).McpStdioServerDefinition
  if (!lm?.registerMcpServerDefinitionProvider || !McpStdio) {
    log('[dynamia-tasks] this VS Code has no MCP provider API; use the command shown in Settings → MCP')
    return
  }
  const project = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  context.subscriptions.push(lm.registerMcpServerDefinitionProvider('dynamia-tasks.mcp', {
    provideMcpServerDefinitions: async () =>
      project ? [new McpStdio('Dynamia Tasks', 'node', [MCP_INSTALLED_FILE, project], {}, context.extension.packageJSON.version)] : [],
  }))
}

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
      // Settings → MCP checks Node and the installed MCP server (see apps/web/composables/useMcpStatus.ts).
      allowedCommands: [
        ['git', 'config', 'user.name'],
        ['node', '--version'],
        ['node', MCP_INSTALLED_FILE, '--version'],
      ],
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

  if (installMcpServer(context, log)) registerMcpProvider(context, log)

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

