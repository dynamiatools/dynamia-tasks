import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { TaskView, WorkspaceActiveTask } from '@dynamia-tasks/core'
import { useApi } from '../composables/useApi'

interface WorkspaceResponse {
  items: TaskView[]
  activeTask: WorkspaceActiveTask | null
  cached?: boolean
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const items = ref<TaskView[]>([])
  const activeTask = ref<WorkspaceActiveTask | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const api = useApi()

  function applyWorkspaceResponse(res: WorkspaceResponse) {
    items.value = res.items
    activeTask.value = res.activeTask ?? null
  }

  async function load() {
    // Only show loading spinner on first load (no items yet)
    if (items.value.length === 0) loading.value = true
    error.value = null
    try {
      const res = await api.get<WorkspaceResponse>('/api/workspace')
      applyWorkspaceResponse(res)
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
      applyWorkspaceResponse(res)
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
    const prevActive = activeTask.value
    items.value = items.value.filter(t => !(t.connectorId === connectorId && t.id === taskId))
    if (activeTask.value?.connectorId === connectorId && activeTask.value.taskId === taskId) {
      activeTask.value = null
    }

    try {
      const encoded = encodeURIComponent(taskId)
      const res = await api.delete<WorkspaceResponse>(`/api/workspace/${connectorId}/${encoded}`)
      applyWorkspaceResponse(res)
    } catch {
      items.value = prev
      activeTask.value = prevActive
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

  const activeTaskKey = computed(() => {
    if (!activeTask.value) return null
    return `${activeTask.value.connectorId}:${activeTask.value.taskId}`
  })

  function isActive(task: TaskView): boolean {
    return activeTaskKey.value === `${task.connectorId}:${task.id}`
  }

  async function setActiveTask(task: TaskView | null) {
    const previous = activeTask.value
    activeTask.value = task ? { connectorId: task.connectorId, taskId: task.id } : null

    try {
      const res = await api.patch<WorkspaceResponse>('/api/workspace/active', {
        connectorId: task?.connectorId ?? null,
        taskId: task?.id ?? null,
      })
      applyWorkspaceResponse(res)
    } catch {
      activeTask.value = previous
    }
  }

  async function reorderByKeys(orderedKeys: string[]) {
    const prev = [...items.value]
    const keySet = new Set(orderedKeys)
    const byKey = new Map(items.value.map(task => [`${task.connectorId}:${task.id}`, task]))

    const ordered = orderedKeys
      .map(key => byKey.get(key))
      .filter((task): task is TaskView => Boolean(task))

    // Keep tasks not present in payload at the end to avoid accidental data loss.
    const rest = items.value.filter(task => !keySet.has(`${task.connectorId}:${task.id}`))
    items.value = [...ordered, ...rest]

    try {
      const payloadItems = items.value.map((task, order) => ({
        connectorId: task.connectorId,
        taskId: task.id,
        order,
      }))

      const res = await api.patch<WorkspaceResponse>('/api/workspace/reorder', {
        items: payloadItems,
      })
      applyWorkspaceResponse(res)
    } catch {
      items.value = prev
    }
  }

  async function clearAllTasks() {
    const prev = [...items.value]
    const prevActive = activeTask.value

    items.value = []
    activeTask.value = null

    try {
      const res = await api.delete<WorkspaceResponse>('/api/workspace/clear')
      applyWorkspaceResponse(res)
    } catch {
      items.value = prev
      activeTask.value = prevActive
    }
  }

  const completedCount = computed(() => items.value.filter(t => t.done).length)
  const pendingCount = computed(() => items.value.length - completedCount.value)

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

  return {
    items,
    activeTask,
    loading,
    error,
    grouped,
    completedCount,
    pendingCount,
    load,
    addTask,
    removeTask,
    toggleDone,
    reorderByKeys,
    clearAllTasks,
    isActive,
    setActiveTask,
  }
})

