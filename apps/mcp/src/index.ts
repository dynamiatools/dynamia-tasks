#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { initBridge } from '@dynamia-tools/ide-bridge'
import { NodeBridge } from '@dynamia-tools/ide-bridge/node'
import { resolve } from 'node:path'
import { createServer } from './server.js'

// Project root: first argument, then DYNAMIA_TASKS_PROJECT, then the directory the client launched us in.
const projectPath = resolve(process.argv[2] ?? process.env.DYNAMIA_TASKS_PROJECT ?? process.cwd())

initBridge(new NodeBridge({ projectPath }))
await createServer(projectPath).connect(new StdioServerTransport())
