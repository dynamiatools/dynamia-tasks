#!/usr/bin/env node
import { startServer } from './index.js'
import path from 'node:path'

const args = process.argv.slice(2)

function getArg(flag: string, fallback?: string): string | undefined {
  const idx = args.indexOf(flag)
  if (idx !== -1 && args[idx + 1]) return args[idx + 1]
  return fallback
}

const port = parseInt(getArg('--port', '7842')!, 10)
// Default to monorepo root (two levels up from packages/server) for dev convenience
const defaultCwd = process.env.DYNAMIA_PROJECT_PATH
  ?? process.env.npm_config_local_prefix  // pnpm sets this to workspace root
  ?? process.cwd()
const projectPath = getArg('--cwd', defaultCwd)!
const ideCallbackUrl = getArg('--ide-callback')
const spaPath = getArg('--spa', path.join(process.cwd(), 'apps', 'web', '.output', 'public'))

startServer({ port, projectPath, ideCallbackUrl, spaPath }).catch(e => {
  console.error('Failed to start server:', e)
  process.exit(1)
})


