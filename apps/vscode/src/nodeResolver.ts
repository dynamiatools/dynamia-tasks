import * as fs   from 'node:fs'
import * as net  from 'node:net'
import * as path from 'node:path'
import * as os   from 'node:os'
import { execFileSync } from 'node:child_process'

const isWindows = process.platform === 'win32'

/**
 * Finds the first free TCP port at or above `startPort`.
 */
export function findFreePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    let port = startPort

    function tryNext() {
      if (port > startPort + 100) {
        reject(new Error(`No free port found starting from ${startPort}`))
        return
      }
      const srv = net.createServer()
      srv.once('error', () => { port++; tryNext() })
      srv.once('listening', () => srv.close(() => resolve(port)))
      srv.listen(port, '127.0.0.1')
    }

    tryNext()
  })
}

/**
 * Locates the node executable, checking known paths for nvm, fnm, Volta, etc.
 * Falls back to bare `node` if nothing is found.
 */
export function resolveNodeExecutable(): string {
  const home = os.homedir()

  if (isWindows) {
    const appData  = process.env['APPDATA']      ?? path.join(home, 'AppData', 'Roaming')
    const localApp = process.env['LOCALAPPDATA'] ?? path.join(home, 'AppData', 'Local')

    const candidates = [
      'C:\\Program Files\\nodejs\\node.exe',
      'C:\\Program Files (x86)\\nodejs\\node.exe',
      path.join(home,     '.volta',  'bin', 'node.exe'),
      path.join(localApp, 'fnm',     'aliases', 'default', 'node.exe'),
      path.join(home,     'scoop',   'apps', 'nodejs', 'current', 'node.exe'),
      path.join(home,     'scoop',   'apps', 'nodejs-lts', 'current', 'node.exe'),
      'C:\\ProgramData\\chocolatey\\bin\\node.exe',
      path.join(localApp, 'Programs', 'nodejs', 'node.exe'),
    ]

    for (const c of candidates) {
      if (isExecutable(c)) return c
    }

    // nvm-windows: scan APPDATA\nvm\v*\node.exe, pick latest
    const nvmWinDir = path.join(appData, 'nvm')
    if (fs.existsSync(nvmWinDir)) {
      const hit = fs.readdirSync(nvmWinDir)
        .filter(d => d.startsWith('v'))
        .sort().reverse()
        .map(d => path.join(nvmWinDir, d, 'node.exe'))
        .find(isExecutable)
      if (hit) return hit
    }

    // where node
    try {
      const result = execFileSync('cmd.exe', ['/c', 'where node'], { timeout: 5000 }).toString().trim().split('\n')[0]?.trim()
      if (result && isExecutable(result)) return result
    } catch { /* ignore */ }

    return 'node'
  }

  // ── Unix / macOS ─────────────────────────────────────────────────────────
  const candidates = [
    '/usr/local/bin/node',
    '/usr/bin/node',
    '/opt/homebrew/bin/node',
    '/opt/homebrew/opt/node/bin/node',
    path.join(home, '.volta',  'bin', 'node'),
    path.join(home, '.fnm',    'aliases', 'default', 'bin', 'node'),
    path.join(home, '.local',  'bin', 'node'),
    path.join(home, 'bin',     'node'),
  ]

  for (const c of candidates) {
    if (isExecutable(c)) return c
  }

  // nvm
  const nvmDir = path.join(home, '.nvm', 'versions', 'node')
  if (fs.existsSync(nvmDir)) {
    const hit = fs.readdirSync(nvmDir).sort().reverse()
      .map(d => path.join(nvmDir, d, 'bin', 'node'))
      .find(isExecutable)
    if (hit) return hit
  }

  // fnm
  const fnmDirs = [
    path.join(home, '.fnm', 'node-versions'),
    path.join(home, '.local', 'share', 'fnm', 'node-versions'),
  ]
  for (const fnmDir of fnmDirs) {
    if (!fs.existsSync(fnmDir)) continue
    const hit = fs.readdirSync(fnmDir).sort().reverse()
      .map(d => path.join(fnmDir, d, 'installation', 'bin', 'node'))
      .find(isExecutable)
    if (hit) return hit
  }

  // Login shell fallback (respects .bashrc / .zshrc — picks up nvm/fnm shims)
  for (const shell of ['/bin/bash', '/bin/zsh', '/usr/bin/bash', '/usr/bin/zsh']) {
    if (!isExecutable(shell)) continue
    try {
      const result = execFileSync(shell, ['-l', '-c', 'which node'], { timeout: 5000 }).toString().trim()
      if (result && isExecutable(result)) return result
    } catch { /* ignore */ }
  }

  // which node with current PATH
  try {
    const result = execFileSync('which', ['node'], { timeout: 5000 }).toString().trim()
    if (result) return result
  } catch { /* ignore */ }

  return 'node'
}

/**
 * Resolves the path to cli.mjs.
 * Priority:
 *  1. Live monorepo path (dev mode)
 *  2. Bundled inside the extension's dist/web/ directory
 */
export function resolveServerBundle(extensionPath: string): string {
  const home = os.homedir()

  // 1. Live monorepo dev path
  const liveByHome = path.resolve(home, 'IdeaProjects/dynamia-tasks/apps/web/cli.mjs')
  if (fs.existsSync(liveByHome)) return liveByHome

  // 2. Relative to extension root (monorepo, other layouts)
  const relCandidates = [
    path.resolve(extensionPath, '../../apps/web/cli.mjs'),
    path.resolve(extensionPath, '../../../apps/web/cli.mjs'),
  ]
  for (const c of relCandidates) {
    if (fs.existsSync(c)) return c
  }

  // 3. Bundled with the extension
  const bundled = path.join(extensionPath, 'dist', 'web', 'cli.mjs')
  if (fs.existsSync(bundled)) return bundled

  throw new Error(
    'cli.mjs not found. Run `pnpm build:web` first, or reinstall the extension.'
  )
}

// ── helpers ───────────────────────────────────────────────────────────────

function isExecutable(p: string): boolean {
  try {
    fs.accessSync(p, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

