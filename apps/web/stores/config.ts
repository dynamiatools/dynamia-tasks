import { defineStore } from 'pinia'
import type { AppConfig } from '@dynamia-tasks/core'

export const useConfigStore = defineStore('config', () => {
  const config = ref<AppConfig | null>(null)
  const svc = useTaskService()

  async function load() {
    config.value = await svc.loadConfig()
  }

  async function saveConnectorConfig(connectorId: string, data: unknown) {
    await svc.saveConnectorConfig(connectorId, data)
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

