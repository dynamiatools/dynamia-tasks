import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { TaskView, WorkspaceActiveTask } from '@dynamia-tasks/core'

interface WorkspaceResponse {
  items: TaskView[]
  activeTask: WorkspaceActiveTask | null
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const items = ref<TaskView[]>([])
  const activeTask = ref<WorkspaceActiveTask | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const svc = useTaskService()

  function applyWorkspaceResponse(res: WorkspaceResponse) {
    items.value = res.items
    activeTask.value = res.activeTask ?? null
  }

  async function load() {
    if (items.value.length === 0) loading.value = true
    error.value = null
    try {
      applyWorkspaceResponse(await svc.loadWorkspace())
    } catch (e: any) {
      error.value = e.message ?? 'Failed to load workspace'
    } finally {
      loading.value = false
    }
  }

  async function addTask(connectorId: string, taskId: string, optimisticTask?: TaskView) {
    const alreadyIn = items.value.some(t => t.connectorId === connectorId && t.id === taskId)
    if (optimisticTask && !alreadyIn) items.value = [...items.value, optimisticTask]

    try {
      applyWorkspaceResponse(await svc.addToWorkspace(connectorId, taskId))
    } catch {
      if (optimisticTask) {
        items.value = items.value.filter(t => !(t.connectorId === connectorId && t.id === taskId))
      }
    }
  }

  async function removeTask(connectorId: string, taskId: string) {
    const prev = [...items.value]
    const prevActive = activeTask.value
    items.value = items.value.filter(t => !(t.connectorId === connectorId && t.id === taskId))
    if (activeTask.value?.connectorId === connectorId && activeTask.value.taskId === taskId) {
      activeTask.value = null
    }

    try {
      applyWorkspaceResponse(await svc.removeFromWorkspace(connectorId, taskId))
    } catch {
      items.value = prev
      activeTask.value = prevActive
    }
  }

  async function toggleDone(task: TaskView) {
    const idx = items.value.findIndex(t => t.id === task.id && t.connectorId === task.connectorId)
    if (idx !== -1) items.value[idx] = { ...items.value[idx], done: !task.done }

    try {
      const updated = await svc.updateTask(task.connectorId, task.id, { done: !task.done })
      if (idx !== -1) items.value[idx] = { ...items.value[idx], ...updated }
    } catch {
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
      applyWorkspaceResponse(await svc.setActiveTask(task?.connectorId ?? null, task?.id ?? null))
    } catch {
      activeTask.value = previous
    }
  }

  async function reorderByKeys(orderedKeys: string[]) {
    const prev = [...items.value]
    const byKey = new Map(items.value.map(task => [`${task.connectorId}:${task.id}`, task]))
    const keySet = new Set(orderedKeys)

    const ordered = orderedKeys
      .map(key => byKey.get(key))
      .filter((task): task is TaskView => Boolean(task))
    const rest = items.value.filter(task => !keySet.has(`${task.connectorId}:${task.id}`))
    items.value = [...ordered, ...rest]

    try {
      const orderedItems = items.value.map((task, order) => ({
        connectorId: task.connectorId,
        taskId: task.id,
        order,
      }))
      applyWorkspaceResponse(await svc.reorderWorkspace(orderedItems))
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
      applyWorkspaceResponse(await svc.clearWorkspace())
    } catch {
      items.value = prev
      activeTask.value = prevActive
    }
  }

  const completedCount = computed(() => items.value.filter(t => t.done).length)
  const pendingCount = computed(() => items.value.length - completedCount.value)

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

