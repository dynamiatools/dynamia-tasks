import { defineStore } from 'pinia'
import type { AppConfig } from '@dynamia-tasks/core'

type StructuredCloneFn = <T>(value: T) => T

function cloneSerializable<T>(value: T, context: string): T {
  try {
    const clone = (globalThis as { structuredClone?: StructuredCloneFn }).structuredClone
    if (typeof clone === 'function') return clone(value)
    return JSON.parse(JSON.stringify(value)) as T
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`[config] ${context} contains non-serializable data: ${detail}`)
  }
}

export const useConfigStore = defineStore('config', () => {
  const config = ref<AppConfig | null>(null)
  const svc = useTaskService()

  async function load() {
    config.value = await svc.loadConfig()
  }

  async function saveConnectorConfig(connectorId: string, data: unknown) {
    const safeData = cloneSerializable(data, `Connector "${connectorId}" config`)
    await svc.saveConnectorConfig(connectorId, safeData)
    await load()
  }

  async function getConnectorConfig(connectorId: string) {
    return svc.getConnectorConfig(connectorId)
  }

  async function getSchema(connectorId: string) {
    return svc.getSchema(connectorId)
  }

  return { config, load, saveConnectorConfig, getConnectorConfig, getSchema }
})
