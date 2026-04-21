import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import type { AppConfig } from '@dynamia-tasks/core'

const CONFIG_DIR = path.join(os.homedir(), '.dynamiatasks')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')
const CACHE_DIR = path.join(CONFIG_DIR, 'cache')

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

