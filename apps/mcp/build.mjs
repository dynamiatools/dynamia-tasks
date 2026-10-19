#!/usr/bin/env node
/**
 * Bundles src/index.ts → dist/dynamia-tasks-mcp.mjs: one self-contained file that runs
 * with `node dynamia-tasks-mcp.mjs [project]` and needs no node_modules. The VS Code
 * extension and the IntelliJ plugin ship this file and copy it to ~/.dynamiatasks/mcp/.
 * (`tsc` still builds dist/index.js for tests and type-checking.)
 */
import esbuild from 'esbuild'
import fs from 'node:fs'

const { version } = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/dynamia-tasks-mcp.mjs',
  format: 'esm',
  platform: 'node',
  target: 'node20',
  define: { __MCP_VERSION__: JSON.stringify(version) },
  // some bundled dependencies still use require()
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
})
console.log('[build] dist/dynamia-tasks-mcp.mjs')
