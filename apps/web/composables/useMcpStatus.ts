import { ide } from '@dynamia-tools/ide-bridge'

export type McpCheckState = 'idle' | 'checking' | 'ok' | 'fail'

export interface McpCheck {
  state: McpCheckState
  detail: string
}

const idle = (): McpCheck => ({ state: 'idle', detail: '' })

/**
 * Where the VS Code extension and the IntelliJ plugin install the MCP server.
 * Keep in sync with `MCP_INSTALLED_FILE` (apps/vscode/src/extension.ts) and `McpInstaller.kt`;
 * both hosts allow reading ~/.dynamiatasks and running exactly the two `node ... --version` commands below.
 */
export function useMcpStatus() {
  const file = ref('')
  const project = ref('')
  const installed = ref<McpCheck>(idle())
  const node = ref<McpCheck>(idle())
  const server = ref<McpCheck>(idle())

  const quote = (s: string) => `"${s.replace(/"/g, '\\"')}"`
  const claudeCommand = computed(() => `claude mcp add dynamia-tasks -- node ${quote(file.value)} ${quote(project.value)}`)
  const jsonConfig = computed(() => JSON.stringify({
    mcpServers: { 'dynamia-tasks': { command: 'node', args: [file.value, project.value] } },
  }, null, 2))

  async function run(cmd: string[]): Promise<{ ok: boolean; out: string }> {
    try {
      const r = await ide.shell.exec(cmd[0]!, cmd.slice(1), { timeout: 5000 })
      return { ok: r.exitCode === 0, out: (r.stdout || r.stderr).trim() }
    } catch (e) {
      return { ok: false, out: (e as Error).message }
    }
  }

  async function check() {
    file.value = ide.path.join(ide.env.getHomePath(), '.dynamiatasks', 'mcp', 'dynamia-tasks-mcp.mjs')
    project.value = ide.env.getProjectPath()
    installed.value = node.value = server.value = { state: 'checking', detail: '' }

    const exists = await ide.fs.exists(file.value).catch(() => false)
    installed.value = exists
      ? { state: 'ok', detail: file.value }
      : { state: 'fail', detail: 'Not installed yet. It is copied when the plugin starts; restart the IDE after updating.' }

    const n = await run(['node', '--version'])
    node.value = n.ok
      ? { state: 'ok', detail: n.out }
      : { state: 'fail', detail: 'Node.js was not found in the IDE\'s PATH. Install Node 20+ and restart the IDE.' }

    if (!exists || !n.ok) {
      server.value = { state: 'fail', detail: 'Skipped until the file and Node are available.' }
      return
    }
    const s = await run(['node', file.value, '--version'])
    server.value = s.ok
      ? { state: 'ok', detail: s.out }
      : { state: 'fail', detail: s.out || 'The server did not start.' }
  }

  async function copy(text: string, what: string) {
    await ide.clipboard.writeText(text)
    await ide.ui.notify('info', `${what} copied to the clipboard`)
  }

  return { file, project, installed, node, server, claudeCommand, jsonConfig, check, copy }
}
