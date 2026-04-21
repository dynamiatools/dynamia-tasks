import { defineStore } from 'pinia'
import type { ConnectorTask, ConnectorSource } from '@dynamia-tasks/core'

export const useExplorerStore = defineStore('explorer', () => {
  const sources = ref<ConnectorSource[]>([])
  const tasks = ref<ConnectorTask[]>([])
  const loading = ref(false)
  const query = ref('')
  const status = ref<'open' | 'closed' | 'all'>('open')

  const api = useApi()

  async function loadSources(connectorId: string) {
    loading.value = true
    try {
      const res = await api.get<{ sources: ConnectorSource[] }>(`/api/connectors/${connectorId}/sources`)
      sources.value = res.sources
    } catch {
      sources.value = []
    } finally {
      loading.value = false
    }
  }

  async function loadTasks(connectorId: string, filter?: Record<string, unknown>) {
    loading.value = true
    try {
      const params = new URLSearchParams()
      if (filter?.sourceId) params.set('sourceId', String(filter.sourceId))
      if (query.value) params.set('query', query.value)
      params.set('status', status.value)
      const res = await api.get<{ tasks: ConnectorTask[] }>(
        `/api/connectors/${connectorId}/tasks?${params.toString()}`
      )
      tasks.value = Array.isArray(res.tasks) ? res.tasks : []
    } catch {
      tasks.value = []
    } finally {
      loading.value = false
    }
  }

  function reset() {
    sources.value = []
    tasks.value = []
    query.value = ''
    status.value = 'open'
  }

  return { sources, tasks, loading, query, status, loadSources, loadTasks, reset }
})

