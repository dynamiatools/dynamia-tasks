import { defineStore } from 'pinia'
import type { TaskView } from '@dynamia-tasks/core'

interface WorkspaceResponse {
  items: TaskView[]
  cached?: boolean
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const items = ref<TaskView[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const api = useApi()

  async function load() {
    loading.value = true
    error.value = null
    try {
      const res = await api.get<WorkspaceResponse>('/api/workspace')
      items.value = res.items
    } catch (e: any) {
      error.value = e.message ?? 'Failed to load workspace'
    } finally {
      loading.value = false
    }
  }

  async function addTask(connectorId: string, taskId: string) {
    const res = await api.post<WorkspaceResponse>('/api/workspace/add', { connectorId, taskId })
    items.value = res.items
  }

  async function removeTask(connectorId: string, taskId: string) {
    const encoded = encodeURIComponent(taskId)
    const res = await api.delete<WorkspaceResponse>(`/api/workspace/${connectorId}/${encoded}`)
    items.value = res.items
  }

  async function toggleDone(task: TaskView) {
    const encoded = encodeURIComponent(task.id)
    const res = await api.patch<{ task: TaskView }>(
      `/api/connectors/${task.connectorId}/tasks/${encoded}`,
      { done: !task.done }
    )
    const idx = items.value.findIndex(t => t.id === task.id && t.connectorId === task.connectorId)
    if (idx !== -1) {
      items.value[idx] = { ...items.value[idx], ...res.task }
    }
  }

  // Group by module/label/other
  const grouped = computed(() => {
    const groups: Record<string, TaskView[]> = {}
    for (const task of items.value) {
      const key = resolveModule(task)
      if (!groups[key]) groups[key] = []
      groups[key].push(task)
    }
    return groups
  })

  function resolveModule(task: TaskView): string {
    if (task.module) return task.module
    if (task.labels && task.labels.length > 0) return task.labels[0].name
    const match = task.title.match(/^\[([^\]]+)\]/)
    if (match) return match[1].toLowerCase()
    return 'other'
  }

  return { items, loading, error, grouped, load, addTask, removeTask, toggleDone }
})

