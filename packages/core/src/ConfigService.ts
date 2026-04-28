import { ide } from '@dynamia-tools/ide-bridge'
import type { AppConfig } from './types.js'

const DEFAULT_CONFIG: AppConfig = {
  connectors: {},
  ui: { theme: 'dark', groupBy: 'module', defaultView: 'workspace' },
}

const STORE_OPTIONS = { scope: 'global' as const }

/**
 * Centralized app config persistence.
 *
 * Behavior:
 * - Primary source: ide.store (global scope), isolated per IDE platform.
 * - Legacy fallback: ~/.dynamiatasks/config.json (read-only migration path).
 */
export class ConfigService {
  private storeKey(): string {
    return `dynamiatasks.config.${ide.env.getPlatform()}`
  }

  private legacyConfigPath(): string {
    return ide.path.join(ide.env.getHomePath(), '.dynamiatasks', 'config.json')
  }

  async load(): Promise<AppConfig> {
    const stored = await this.loadFromStore()
    if (stored) return stored

    const legacy = await this.loadFromLegacyFile()
    if (legacy) {
      await this.save(legacy)
      return legacy
    }

    return { ...DEFAULT_CONFIG, connectors: {} }
  }

  async save(config: AppConfig): Promise<void> {
    await ide.store.set(this.storeKey(), config, STORE_OPTIONS)
  }

  private async loadFromStore(): Promise<AppConfig | null> {
    try {
      const value = await ide.store.get<AppConfig>(this.storeKey(), STORE_OPTIONS)
      return this.normalizeConfig(value)
    } catch {
      return null
    }
  }

  private async loadFromLegacyFile(): Promise<AppConfig | null> {
    try {
      const raw = await ide.fs.readFile(this.legacyConfigPath())
      const parsed = JSON.parse(raw) as AppConfig
      return this.normalizeConfig(parsed)
    } catch {
      return null
    }
  }

  private normalizeConfig(value: unknown): AppConfig | null {
    if (!value || typeof value !== 'object') return null
    const config = value as Partial<AppConfig>
    const connectors = config.connectors && typeof config.connectors === 'object'
      ? config.connectors
      : {}
    const ui = config.ui ?? DEFAULT_CONFIG.ui

    return {
      connectors,
      ui: {
        theme: ui.theme === 'light' || ui.theme === 'dark' || ui.theme === 'system' ? ui.theme : DEFAULT_CONFIG.ui.theme,
        groupBy: ui.groupBy === 'module' || ui.groupBy === 'label' || ui.groupBy === 'connector' ? ui.groupBy : DEFAULT_CONFIG.ui.groupBy,
        defaultView: ui.defaultView === 'workspace' || ui.defaultView === 'explorer' ? ui.defaultView : DEFAULT_CONFIG.ui.defaultView,
      },
    }
  }
}

