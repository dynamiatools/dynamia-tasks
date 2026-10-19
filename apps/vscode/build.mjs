#!/usr/bin/env node
/**
 * Build script for the VS Code extension.
 * Bundles src/extension.ts → dist/extension.js using esbuild.
 * Copies apps/web/.output/public/ → dist/web/ (static SPA, no server needed).
 */
import esbuild from 'esbuild'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isWatch    = process.argv.includes('--watch')

// ── bundle extension ──────────────────────────────────────────────────────────
const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle:      true,
  outfile:     'dist/extension.js',
  external:    ['vscode'],
  format:      'cjs',
  platform:    'node',
  target:      'node18',
  sourcemap:   true,
  minify:      false,
})

if (isWatch) {
  await ctx.watch()
  console.log('[build] watching for changes…')
} else {
  await ctx.rebuild()
  await ctx.dispose()
  console.log('[build] extension bundled → dist/extension.js')
}

// ── copy bundled static SPA ───────────────────────────────────────────────────
const spaPublicDir = path.resolve(__dirname, '../../apps/web/.output/public')
const destDir      = path.resolve(__dirname, 'dist/web')

if (fs.existsSync(spaPublicDir)) {
  fs.rmSync(destDir, { recursive: true, force: true })
  copyDirSync(spaPublicDir, destDir)
  console.log('[build] Static SPA copied → dist/web/')
} else {
  console.warn('[build] WARNING: apps/web/.output/public not found — run `pnpm build:web` first.')
}

// ── copy bundled MCP server ───────────────────────────────────────────────────
// Built by `pnpm --filter @dynamia-tasks/mcp bundle`; the extension installs it to ~/.dynamiatasks/mcp/.
const mcpFile = path.resolve(__dirname, '../mcp/dist/dynamia-tasks-mcp.mjs')
if (fs.existsSync(mcpFile)) {
  fs.mkdirSync(path.resolve(__dirname, 'dist/mcp'), { recursive: true })
  fs.copyFileSync(mcpFile, path.resolve(__dirname, 'dist/mcp/dynamia-tasks-mcp.mjs'))
  console.log('[build] MCP server copied → dist/mcp/')
} else {
  console.warn('[build] WARNING: apps/mcp/dist/dynamia-tasks-mcp.mjs not found — run `pnpm build:mcp` first.')
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDirSync(srcPath, destPath)
    else fs.copyFileSync(srcPath, destPath)
  }
}
