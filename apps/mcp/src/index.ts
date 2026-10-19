#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { initBridge } from '@dynamia-tools/ide-bridge'
import { NodeBridge } from '@dynamia-tools/ide-bridge/node'
import { findProjectRoot } from './project.js'
import { createServer } from './server.js'
import { VERSION } from './version.js'

// The plugins' settings page runs `node <file> --version` to check the install.
if (process.argv.includes('--version')) {
  console.log(`dynamia-tasks-mcp ${VERSION}`)
  process.exit(0)
}

// Project root: first argument, then DYNAMIA_TASKS_PROJECT, then the directory the client launched us in;
// in every case the nearest folder with .dynamia/tasks/ is used, and without one the server does nothing.
const start = process.argv.slice(2).find(a => !a.startsWith('--')) ?? process.env.DYNAMIA_TASKS_PROJECT ?? process.cwd()
const projectPath = findProjectRoot(start)

if (projectPath) initBridge(new NodeBridge({ projectPath }))
await createServer(projectPath).connect(new StdioServerTransport())
