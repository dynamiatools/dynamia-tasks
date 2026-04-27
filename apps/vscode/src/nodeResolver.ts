import * as fs   from 'node:fs'
import * as net  from 'node:net'
import * as path from 'node:path'
import * as os   from 'node:os'

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
 * Resolves the path to cli.mjs.
 * Priority:
 *  1. Live monorepo path (dev mode)
 *  2. Bundled inside the extension's dist/web/ directory
 */
export function resolveServerBundle(extensionPath: string): string {
  const home = os.homedir()

  const explicit = process.env['DYNAMIA_SERVER_BUNDLE']
  if (explicit && fs.existsSync(explicit)) return explicit

  // 1. Relative to extension root (monorepo, other layouts)
  const relCandidates = [
    path.resolve(extensionPath, '../../apps/web/cli.mjs'),
    path.resolve(extensionPath, '../../../apps/web/cli.mjs'),
  ]
  for (const c of relCandidates) {
    if (fs.existsSync(c)) return c
  }

  // 2. Bundled with the extension
  const bundled = path.join(extensionPath, 'dist', 'web', 'cli.mjs')
  if (fs.existsSync(bundled)) return bundled

  // 3. Live monorepo fallback for local development only
  if (process.env['DYNAMIA_USE_LIVE_WEB_BUNDLE'] === '1') {
    const liveByHome = path.resolve(home, 'IdeaProjects/dynamia-tasks/apps/web/cli.mjs')
    if (fs.existsSync(liveByHome)) return liveByHome
  }

  throw new Error(
    'cli.mjs not found. Run `pnpm build:web` first, or reinstall the extension.'
  )
}

// ── helpers ───────────────────────────────────────────────────────────────
