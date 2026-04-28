import { defineStore } from 'pinia'
import type { ConnectorInfo } from '@dynamia-tasks/core'

export const useConnectorsStore = defineStore('connectors', () => {
  const connectors = ref<ConnectorInfo[]>([])
  const loading = ref(false)

  const svc = useTaskService()

  async function load() {
    loading.value = true
    try {
      connectors.value = await svc.getConnectors()
    } finally {
      loading.value = false
    }
  }

  function find(id: string) {
    return connectors.value.find(c => c.id === id)
  }

  return { connectors, loading, load, find }
})

