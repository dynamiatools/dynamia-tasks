import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import type { AppConfig } from '@dynamia-tasks/core'

const CONFIG_DIR = path.join(os.homedir(), '.dynamiatasks')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')
const CACHE_DIR = path.join(CONFIG_DIR, 'cache')
const INSTANCES_DIR = path.join(CONFIG_DIR, 'instances')

const DEFAULT_CONFIG: AppConfig = {
  connectors: {},
  ui: {
    theme: 'system',
    groupBy: 'module',
    defaultView: 'workspace',
  },
}

export async function readConfig(): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    return {
      connectors: parsed.connectors ?? {},
      ui: { ...DEFAULT_CONFIG.ui, ...(parsed.ui ?? {}) },
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function writeConfig(config: AppConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true })
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
}

export async function writeCache(connectorId: string, data: unknown): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true })
  await fs.writeFile(
    path.join(CACHE_DIR, `${connectorId}.json`),
    JSON.stringify({ ts: new Date().toISOString(), data }),
    'utf-8'
  )
}

export async function readCache(connectorId: string): Promise<{ ts: string; data: unknown } | null> {
  try {
    const raw = await fs.readFile(path.join(CACHE_DIR, `${connectorId}.json`), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ── Instance port registry ────────────────────────────────────────────────────

export function normalizeProjectPath(projectPath: string): string {
  const resolved = path.resolve(projectPath)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function instanceKey(projectPath: string): string {
  return crypto.createHash('sha1').update(normalizeProjectPath(projectPath)).digest('hex').slice(0, 12)
}

export interface InstanceInfo {
  port: number
  projectPath: string
  pid: number
  startedAt: string
}

export async function writeInstancePort(projectPath: string, port: number): Promise<InstanceInfo> {
  await fs.mkdir(INSTANCES_DIR, { recursive: true })
  const key = instanceKey(projectPath)
  const info: InstanceInfo = {
    port,
    projectPath,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  }
  await fs.writeFile(path.join(INSTANCES_DIR, `${key}.json`), JSON.stringify(info, null, 2), 'utf-8')
  return info
}

export async function removeInstancePort(projectPath: string): Promise<void> {
  try {
    const key = instanceKey(projectPath)
    await fs.unlink(path.join(INSTANCES_DIR, `${key}.json`))
  } catch { /* ignore */ }
}

export async function readInstancePort(projectPath: string): Promise<InstanceInfo | null> {
  try {
    const key = instanceKey(projectPath)
    const raw = await fs.readFile(path.join(INSTANCES_DIR, `${key}.json`), 'utf-8')
    return JSON.parse(raw) as InstanceInfo
  } catch {
    return null
  }
}

