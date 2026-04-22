import { defineStore } from 'pinia'
import type { ConnectorTask, ConnectorSource } from '@dynamia-tasks/core'

export const useExplorerStore = defineStore('explorer', () => {
  const sources = ref<ConnectorSource[]>([])
  const tasks = ref<ConnectorTask[]>([])
  const loading = ref(false)
  const query = ref('')
  const status = ref<'open' | 'closed' | 'all'>('open')
  const selectedLabels = ref<string[]>([])

  const api = useApi()

  // All unique labels across loaded tasks
  const availableLabels = computed(() => {
    const seen = new Map<string, { name: string; color?: string }>()
    for (const t of tasks.value) {
      for (const l of t.labels ?? []) {
        if (!seen.has(l.name)) seen.set(l.name, l)
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  })

  // Client-side filtering by query + labels — instant, no extra requests
  const filteredTasks = computed(() => {
    const q = query.value.trim().toLowerCase()
    return tasks.value.filter(t => {
      if (q && !t.title.toLowerCase().includes(q) &&
          !t.description?.toLowerCase().includes(q) &&
          !t.labels?.some(l => l.name.toLowerCase().includes(q))) return false
      if (selectedLabels.value.length > 0 &&
          !selectedLabels.value.every(sl => t.labels?.some(l => l.name === sl))) return false
      return true
    })
  })

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

  return { sources, tasks, filteredTasks, loading, query, status, loadSources, loadTasks, reset }
})
