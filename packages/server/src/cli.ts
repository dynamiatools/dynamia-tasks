#!/usr/bin/env node
import { startServer } from './index.js'
import path from 'node:path'
import net from 'node:net'

const args = process.argv.slice(2)

function getArg(flag: string, fallback?: string): string | undefined {
  const idx = args.indexOf(flag)
  if (idx !== -1 && args[idx + 1]) return args[idx + 1]
  return fallback
}

/** Returns true if the given TCP port is available on 127.0.0.1 */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port, '127.0.0.1')
  })
}

/** Starting from `preferred`, find the first free port (max 50 attempts). */
async function findFreePort(preferred: number): Promise<number> {
  for (let p = preferred; p < preferred + 50; p++) {
    if (await isPortFree(p)) return p
  }
  throw new Error(`No free port found starting from ${preferred}`)
}

const preferredPort = parseInt(getArg('--port', '7842')!, 10)
const explicitPort = args.includes('--port')

// Default to monorepo root (two levels up from packages/server) for dev convenience
const defaultCwd = process.env.DYNAMIA_PROJECT_PATH
  ?? process.env.npm_config_local_prefix  // pnpm sets this to workspace root
  ?? process.cwd()
const projectPath = getArg('--cwd', defaultCwd)!
const ideCallbackUrl = getArg('--ide-callback')
const spaPath = getArg('--spa', path.join(process.cwd(), 'apps', 'web', '.output', 'public'))

async function main() {
  // If --port was explicitly provided, honour it strictly; otherwise auto-pick.
  const port = explicitPort ? preferredPort : await findFreePort(preferredPort)

  if (!explicitPort && port !== preferredPort) {
    console.log(`⚠  Port ${preferredPort} is in use — using port ${port} instead`)
  }

  await startServer({ port, projectPath, ideCallbackUrl, spaPath })
}

main().catch(e => {
  console.error('Failed to start server:', e)
  process.exit(1)
})
