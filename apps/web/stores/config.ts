import { defineStore } from 'pinia'
import type { AppConfig } from '@dynamia-tasks/core'

export const useConfigStore = defineStore('config', () => {
  const config = ref<AppConfig | null>(null)
  const api = useApi()

  async function load() {
    config.value = await api.get<AppConfig>('/api/config')
  }

  async function saveConnectorConfig(connectorId: string, data: unknown) {
    await api.put(`/api/config/connectors/${connectorId}`, data)
    await load()
  }

  async function getConnectorConfig(connectorId: string) {
    return api.get<unknown>(`/api/config/connectors/${connectorId}`)
  }

  async function getSchema(connectorId: string) {
    return api.get<{ fields: any[] }>(`/api/connectors/${connectorId}/schema`)
  }

  return { config, load, saveConnectorConfig, getConnectorConfig, getSchema }
})

