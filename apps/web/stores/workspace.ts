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
    // Only show loading spinner on first load (no items yet)
    if (items.value.length === 0) loading.value = true
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

  async function addTask(connectorId: string, taskId: string, optimisticTask?: TaskView) {
    // Optimistic add if we already have the task data
    const alreadyIn = items.value.some(t => t.connectorId === connectorId && t.id === taskId)
    if (optimisticTask && !alreadyIn) {
      items.value = [...items.value, optimisticTask]
    }

    try {
      const res = await api.post<WorkspaceResponse>('/api/workspace/add', { connectorId, taskId })
      items.value = res.items
    } catch {
      // Revert optimistic add
      if (optimisticTask) {
        items.value = items.value.filter(t => !(t.connectorId === connectorId && t.id === taskId))
      }
    }
  }

  async function removeTask(connectorId: string, taskId: string) {
    // Optimistic remove
    const prev = [...items.value]
    items.value = items.value.filter(t => !(t.connectorId === connectorId && t.id === taskId))

    try {
      const encoded = encodeURIComponent(taskId)
      const res = await api.delete<WorkspaceResponse>(`/api/workspace/${connectorId}/${encoded}`)
      items.value = res.items
    } catch {
      items.value = prev
    }
  }

  async function toggleDone(task: TaskView) {
    // Optimistic update — flip immediately in UI
    const idx = items.value.findIndex(t => t.id === task.id && t.connectorId === task.connectorId)
    if (idx !== -1) items.value[idx] = { ...items.value[idx], done: !task.done }

    // Sync with server in background
    try {
      const encoded = encodeURIComponent(task.id)
      const res = await api.patch<{ task: TaskView }>(
        `/api/connectors/${task.connectorId}/tasks/${encoded}`,
        { done: !task.done }
      )
      if (idx !== -1) items.value[idx] = { ...items.value[idx], ...res.task }
    } catch {
      // Revert on error
      if (idx !== -1) items.value[idx] = { ...items.value[idx], done: task.done }
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

