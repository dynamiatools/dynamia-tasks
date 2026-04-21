import { defineStore } from 'pinia'
import type { ConnectorCapabilities } from '@dynamia-tasks/core'

interface ConnectorInfo {
  id: string
  name: string
  icon: string
  capabilities: ConnectorCapabilities
  configured: boolean
}

export const useConnectorsStore = defineStore('connectors', () => {
  const connectors = ref<ConnectorInfo[]>([])
  const loading = ref(false)

  const api = useApi()

  async function load() {
    loading.value = true
    try {
      const res = await api.get<{ connectors: ConnectorInfo[] }>('/api/connectors')
      connectors.value = res.connectors
    } finally {
      loading.value = false
    }
  }

  function find(id: string) {
    return connectors.value.find(c => c.id === id)
  }

  return { connectors, loading, load, find }
})

