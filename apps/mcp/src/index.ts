#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { initBridge } from '@dynamia-tools/ide-bridge'
import { NodeBridge } from '@dynamia-tools/ide-bridge/node'
import { resolve } from 'node:path'
import { createServer } from './server.js'
import { VERSION } from './version.js'

// The plugins' settings page runs `node <file> --version` to check the install.
if (process.argv.includes('--version')) {
  console.log(`dynamia-tasks-mcp ${VERSION}`)
  process.exit(0)
}

// Project root: first argument, then DYNAMIA_TASKS_PROJECT, then the directory the client launched us in.
const projectPath = resolve(process.argv.slice(2).find(a => !a.startsWith('--')) ?? process.env.DYNAMIA_TASKS_PROJECT ?? process.cwd())

initBridge(new NodeBridge({ projectPath }))
await createServer(projectPath).connect(new StdioServerTransport())
