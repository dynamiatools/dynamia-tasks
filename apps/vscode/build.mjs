#!/usr/bin/env node
/**
 * Build script for the VS Code extension.
 * Bundles src/extension.ts → dist/extension.js using esbuild.
 * Also copies apps/web/cli.mjs + apps/web/.output/ → dist/web/ if they exist.
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

// ── copy web server bundle ──────────────────────────────────────────────────
const webRootDir   = path.resolve(__dirname, '../../apps/web')
const webOutputDir = path.resolve(webRootDir, '.output')
const webCliFile   = path.resolve(webRootDir, 'cli.mjs')
const destDir      = path.resolve(__dirname, 'dist/web')

if (fs.existsSync(webOutputDir) && fs.existsSync(webCliFile)) {
  fs.rmSync(destDir, { recursive: true, force: true })
  fs.mkdirSync(destDir, { recursive: true })
  fs.copyFileSync(webCliFile, path.join(destDir, 'cli.mjs'))
  copyDirSync(webOutputDir, path.join(destDir, '.output'))
  console.log('[build] Web server bundle copied → dist/web/')
} else {
  console.warn('[build] WARNING: apps/web/cli.mjs or apps/web/.output not found — run `pnpm build:web` first.')
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

