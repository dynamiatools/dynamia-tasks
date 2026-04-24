#!/usr/bin/env node
/**
 * Build script for the VS Code extension.
 * Bundles src/extension.ts → dist/extension.js using esbuild.
 * Also copies apps/web/.output/public/ → dist/web/ if it exists.
 */
import esbuild from 'esbuild'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isWatch    = process.argv.includes('--watch')

// ── bundle extension ────────────────────────────────────────────────────────
const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle:      true,
  outfile:     'dist/extension.js',
  external:    ['vscode'],         // vscode is provided at runtime by the IDE
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

// ── copy web output ─────────────────────────────────────────────────────────
const webOutputDir = path.resolve(__dirname, '../../apps/web/.output/public')
const destDir      = path.resolve(__dirname, 'dist/web')

if (fs.existsSync(webOutputDir)) {
  copyDirSync(webOutputDir, destDir)
  console.log('[build] Web output copied → dist/web/')
} else {
  console.warn('[build] WARNING: apps/web/.output/public not found — run `pnpm build:web` first.')
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

