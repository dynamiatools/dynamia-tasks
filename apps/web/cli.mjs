#!/usr/bin/env node
/**
 * Dynamia Tasks — CLI launcher
 * Finds a free port, sets environment variables, then starts the Nitro server
 * in-process (same stdout → IntelliJ plugin can read the port discovery line).
 *
 * Usage:
 *   node cli.mjs [--port 7842] [--cwd /path/to/project] [--ide-callback http://localhost:PORT]
 */
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const args = process.argv.slice(2)

function getArg(flag, fallback) {
  const idx = args.indexOf(flag)
  if (idx !== -1 && args[idx + 1]) return args[idx + 1]
  return fallback
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port, '127.0.0.1')
  })
}

async function findFreePort(preferred) {
  for (let p = preferred; p < preferred + 50; p++) {
    if (await isPortFree(p)) return p
  }
  throw new Error(`No free port found starting from ${preferred}`)
}

const preferredPort = parseInt(getArg('--port', '7842'), 10)
const explicitPort = args.includes('--port')

const defaultCwd =
  process.env.DYNAMIA_PROJECT_PATH ??
  process.env.npm_config_local_prefix ??
  process.cwd()
const projectPath = getArg('--cwd', defaultCwd)
const ideCallbackUrl = getArg('--ide-callback', '')

async function main() {
  const port = explicitPort ? preferredPort : await findFreePort(preferredPort)

  if (!explicitPort && port !== preferredPort) {
    console.log(`⚠  Port ${preferredPort} is in use — using port ${port} instead`)
  }

  // Pass config to Nitro via environment variables
  process.env.PORT = String(port)
  process.env.NITRO_PORT = String(port)
  process.env.NITRO_HOST = '127.0.0.1'
  process.env.NUXT_PROJECT_PATH = projectPath
  if (ideCallbackUrl) process.env.NUXT_IDE_CALLBACK_URL = ideCallbackUrl

  // Start Nitro server in-process
  const serverEntry = path.join(__dirname, '.output', 'server', 'index.mjs')
  await import(serverEntry)
}

main().catch(e => {
  console.error('Failed to start server:', e)
  process.exit(1)
})

