<script setup lang="ts">
import type { TaskView } from '@dynamia-tasks/core'
import { PlusIcon, ChevronRightIcon, Squares2X2Icon, ExclamationCircleIcon, XMarkIcon, MapPinIcon, Bars3Icon, SparklesIcon } from '@heroicons/vue/20/solid'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useWorkspaceStore } from '../stores/workspace'
import { useConnectorsStore } from '../stores/connectors'
import { usePreferencesStore } from '../stores/preferences'

const workspace = useWorkspaceStore()
const connectors = useConnectorsStore()
const prefs = usePreferencesStore()
const FLAT_DRAG_SCOPE = '__flat__'
const draggingTaskKey = ref<string | null>(null)
const dragHandleTaskKey = ref<string | null>(null)
const draggingGroup = ref<string | null>(null)
const dropTargetTaskKey = ref<string | null>(null)
const showCongratsToast = ref(false)
const clearingWorkspace = ref(false)
const showClearWorkspaceDialog = ref(false)
const showRemoveTaskDialog = ref(false)
const pendingRemovalTask = ref<TaskView | null>(null)
const removingTask = ref(false)
let congratsTimer: ReturnType<typeof setTimeout> | null = null

const canClearWorkspace = computed(() =>
  workspace.items.length > 0 && workspace.completedCount === workspace.items.length
)

onMounted(async () => {
  prefs.load()
  await connectors.load()
  await workspace.load()
})

onBeforeUnmount(() => {
  if (congratsTimer) clearTimeout(congratsTimer)
})

watch(
  () => ({ total: workspace.items.length, done: workspace.completedCount }),
  (next, prev) => {
    const allCompletedNow = next.total > 2 && next.done === next.total
    const allCompletedBefore = (prev?.total ?? 0) > 2 && (prev?.done ?? 0) === (prev?.total ?? 0)

    if (allCompletedNow && !allCompletedBefore) {
      showCongratsToast.value = true
      if (congratsTimer) clearTimeout(congratsTimer)
      congratsTimer = setTimeout(() => {
        showCongratsToast.value = false
      }, 4200)
      return
    }

    if (!allCompletedNow) {
      showCongratsToast.value = false
    }
  }
)

const sortedItems = computed(() => {
  if (!workspace.activeTask) return workspace.items
  return [...workspace.items].sort((a, b) => {
    const aActive = workspace.isActive(a) ? -1 : 0
    const bActive = workspace.isActive(b) ? -1 : 0
    return aActive - bActive
  })
})

const sortedGroupedEntries = computed(() => {
  const entries = Object.entries(workspace.grouped)
  if (!workspace.activeTask) return entries

  const activeIndex = entries.findIndex(([, tasks]) => tasks.some((task) => workspace.isActive(task)))
  if (activeIndex <= 0) return entries

  const [activeEntry] = entries.splice(activeIndex, 1)
  entries.unshift(activeEntry)
  return entries
})

function sortGroupTasks(tasks: typeof workspace.items) {
  return tasks
}

function taskKey(task: TaskView): string {
  return `${task.connectorId}:${task.id}`
}

function onHandlePointerDown(task: TaskView) {
  dragHandleTaskKey.value = taskKey(task)
}

function resetDragState() {
  draggingTaskKey.value = null
  dragHandleTaskKey.value = null
  draggingGroup.value = null
  dropTargetTaskKey.value = null
}

function onItemDragStart(event: DragEvent, task: TaskView, group: string) {
  const key = taskKey(task)
  if (dragHandleTaskKey.value !== key) {
    event.preventDefault()
    return
  }

  draggingTaskKey.value = key
  draggingGroup.value = group
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', key)
  }
}

function onItemDragOver(event: DragEvent, task: TaskView, group: string) {
  if (!draggingTaskKey.value || draggingGroup.value !== group) return
  event.preventDefault()
  dropTargetTaskKey.value = taskKey(task)
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

async function onItemDrop(event: DragEvent, targetTask: TaskView, group: string) {
  event.preventDefault()
  const draggedKey = draggingTaskKey.value
  if (!draggedKey || draggingGroup.value !== group) {
    resetDragState()
    return
  }

  const targetKey = taskKey(targetTask)
  if (draggedKey === targetKey) {
    resetDragState()
    return
  }

  const groupedEntries = Object.entries(workspace.grouped)
  const groupTasks = groupedEntries.find(([groupName]) => groupName === group)?.[1] ?? []

  const sourceIndex = groupTasks.findIndex(task => taskKey(task) === draggedKey)
  const targetIndex = groupTasks.findIndex(task => taskKey(task) === targetKey)
  if (sourceIndex === -1 || targetIndex === -1) {
    resetDragState()
    return
  }

  const reorderedGroupTasks = [...groupTasks]
  const [moved] = reorderedGroupTasks.splice(sourceIndex, 1)
  reorderedGroupTasks.splice(targetIndex, 0, moved)

  const nextOrderedKeys = groupedEntries.flatMap(([groupName, tasks]) =>
    (groupName === group ? reorderedGroupTasks : tasks).map(task => taskKey(task))
  )

  await workspace.reorderByKeys(nextOrderedKeys)
  resetDragState()
}

function onFlatItemDragStart(event: DragEvent, task: TaskView) {
  const key = taskKey(task)
  if (dragHandleTaskKey.value !== key) {
    event.preventDefault()
    return
  }

  draggingTaskKey.value = key
  draggingGroup.value = FLAT_DRAG_SCOPE
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', key)
  }
}

function onFlatItemDragOver(event: DragEvent, task: TaskView) {
  if (!draggingTaskKey.value || draggingGroup.value !== FLAT_DRAG_SCOPE) return
  event.preventDefault()
  dropTargetTaskKey.value = taskKey(task)
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

async function onFlatItemDrop(event: DragEvent, targetTask: TaskView) {
  event.preventDefault()
  const draggedKey = draggingTaskKey.value
  if (!draggedKey || draggingGroup.value !== FLAT_DRAG_SCOPE) {
    resetDragState()
    return
  }

  const targetKey = taskKey(targetTask)
  if (draggedKey === targetKey) {
    resetDragState()
    return
  }

  const tasks = [...sortedItems.value]
  const sourceIndex = tasks.findIndex(task => taskKey(task) === draggedKey)
  const targetIndex = tasks.findIndex(task => taskKey(task) === targetKey)
  if (sourceIndex === -1 || targetIndex === -1) {
    resetDragState()
    return
  }

  const [moved] = tasks.splice(sourceIndex, 1)
  tasks.splice(targetIndex, 0, moved)

  await workspace.reorderByKeys(tasks.map(task => taskKey(task)))
  resetDragState()
}

async function clearWorkspaceCompleted() {
  if (!canClearWorkspace.value) return
  showClearWorkspaceDialog.value = true
}

async function confirmClearWorkspace() {
  if (!canClearWorkspace.value || clearingWorkspace.value) return

  clearingWorkspace.value = true
  try {
    await workspace.clearAllTasks()
    showCongratsToast.value = false
    showClearWorkspaceDialog.value = false
  } finally {
    clearingWorkspace.value = false
  }
}

function requestRemoveTask(task: TaskView) {
  pendingRemovalTask.value = task
  showRemoveTaskDialog.value = true
}

async function confirmRemoveTask() {
  if (!pendingRemovalTask.value || removingTask.value) return

  removingTask.value = true
  try {
    await workspace.removeTask(pendingRemovalTask.value.connectorId, pendingRemovalTask.value.id)
    showRemoveTaskDialog.value = false
    pendingRemovalTask.value = null
  } finally {
    removingTask.value = false
  }
}

function cancelRemoveTask() {
  showRemoveTaskDialog.value = false
  pendingRemovalTask.value = null
}
</script>

<template>
  <div>
    <AppConfirmDialog
      :open="showClearWorkspaceDialog"
      title="Clear workspace?"
      message="This will remove all tasks from the workspace list."
      confirm-text="Clear Workspace"
      cancel-text="Cancel"
      confirm-variant="danger"
      :loading="clearingWorkspace"
      @confirm="confirmClearWorkspace"
      @cancel="showClearWorkspaceDialog = false"
    />

    <AppConfirmDialog
      :open="showRemoveTaskDialog"
      title="Remove task from workspace?"
      :message="pendingRemovalTask ? `Task: ${pendingRemovalTask.title}` : ''"
      confirm-text="Remove Task"
      cancel-text="Cancel"
      confirm-variant="danger"
      :loading="removingTask"
      @confirm="confirmRemoveTask"
      @cancel="cancelRemoveTask"
    />

    <Transition name="congrats-float">
      <div
        v-if="showCongratsToast"
        class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4"
      >
        <div class="congrats-panel w-full max-w-2xl rounded-2xl border border-dt-accent/40 bg-dt-accent-deep/90 px-6 py-8 text-center shadow-2xl backdrop-blur-md">
          <div class="mx-auto mb-4 flex items-center justify-center gap-2 text-3xl font-black text-white">
            <span class="congrats-emoji" aria-hidden="true">🎉</span>
            <SparklesIcon class="size-8 text-dt-accent congrats-spark" />
          </div>
          <div>
            <p class="text-3xl sm:text-4xl font-black tracking-tight text-white">Amazing Work!</p>
            <p class="mt-2 text-base sm:text-lg text-dt-muted">You completed every task in your workspace.</p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Header -->
    <div class="sticky top-0 z-20 -mx-4 mb-5 bg-dt-bg/95 px-3 py-1 backdrop-blur-md">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 min-w-0">
        <AppSectionLabel mb="mb-0">Workspace</AppSectionLabel>
        <span class="text-xs px-1.5 py-0.5 rounded bg-dt-raised border border-dt-border text-dt-muted font-mono">
           {{ workspace.completedCount }}/{{ workspace.items.length }}
        </span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <button
            v-if="canClearWorkspace"
            type="button"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border border-dt-danger-bdr bg-dt-danger-bg text-dt-danger hover:bg-dt-danger-bg/80 transition-all disabled:opacity-60"
            :disabled="clearingWorkspace"
            @click="clearWorkspaceCompleted"
          >
            <span>{{ clearingWorkspace ? 'Clearing...' : 'Clear Workspace' }}</span>
          </button>

          <NuxtLink
            to="/task/new"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border
                 bg-dt-raised text-dt-accent border-dt-border hover:border-dt-accent hover:bg-dt-accent-deep transition-all"
          >
            <PlusIcon class="size-3" />
            New Task
          </NuxtLink>
        </div>
      </div>
    </div>

    <AppSpinner v-if="workspace.loading" />

    <div v-else-if="workspace.error" class="space-y-2">
      <div class="flex items-center gap-2 text-sm text-dt-danger">
        <ExclamationCircleIcon class="size-3.5 shrink-0" />
        {{ workspace.error }}
      </div>
      <p class="text-xs pl-5 text-dt-dim">
        Is the server running?
        <code class="font-mono px-1 py-0.5 rounded text-xs bg-dt-raised text-dt-text">pnpm dev:server</code>
      </p>
    </div>

    <div v-else-if="workspace.items.length === 0" class="flex flex-col items-center justify-center py-16 gap-5 text-center">
      <div class="w-12 h-12 rounded-xl flex items-center justify-center bg-dt-raised border border-dt-border">
        <Squares2X2Icon class="size-6 text-dt-dim" />
      </div>
      <div class="space-y-1">
        <p class="text-sm font-medium text-dt-text">Your workspace is empty</p>
        <p class="text-xs text-dt-dim">Add tasks from your connectors to track them here.</p>
      </div>
      <div class="flex flex-col gap-2 w-full max-w-[200px]">
        <NuxtLink
          v-for="c in connectors.connectors.filter((c: any) => c.capabilities.hasExplorer && c.configured)"
          :key="c.id"
          :to="`/explore/${c.id}`"
          class="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm bg-dt-raised text-dt-text border border-dt-border hover:border-dt-accent hover:text-white transition-all"
        >
          <ConnectorIcon :connector-id="c.id" class="shrink-0 text-dt-muted" />
          <span>Explore {{ c.name }}</span>
          <ChevronRightIcon class="size-3 ml-auto text-dt-dim" />
        </NuxtLink>
        <NuxtLink
          v-if="!connectors.connectors.some((c: any) => c.configured)"
          to="/settings"
          class="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm bg-dt-raised text-dt-text border border-dt-border hover:border-dt-accent hover:text-white transition-all"
        >
          <PlusIcon class="size-3.5 text-dt-muted" />
          <span>Configure a connector</span>
          <ChevronRightIcon class="size-3 ml-auto text-dt-dim" />
        </NuxtLink>
      </div>
    </div>

    <div v-else>
      <!-- autoGroups ON: grouped view -->
      <template v-if="prefs.autoGroups">
        <div v-for="[group, tasks] in sortedGroupedEntries" :key="group" class="mb-8">
          <p class="text-xs font-semibold text-dt-muted uppercase tracking-widest mb-3 pb-1.5 border-b border-dt-border">{{ group }}</p>
          <TransitionGroup tag="ul" name="task-reorder" :class="prefs.compactMode ? 'space-y-0.5' : 'space-y-3.5'">
            <li
              v-for="task in sortGroupTasks(tasks)"
              :key="taskKey(task)"
              class="group/task flex items-start gap-2 rounded-md px-2 transition-all duration-200"
              :class="[
                prefs.compactMode ? 'py-0.5' : 'py-1.5',
                workspace.isActive(task) ? 'border border-dt-accent bg-dt-accent-deep/30' : 'border border-transparent hover:border-dt-border',
                draggingTaskKey === taskKey(task) ? 'opacity-60 scale-[0.995]' : 'opacity-100',
                dropTargetTaskKey === taskKey(task) ? 'task-drop-target' : ''
              ]"
              :draggable="true"
              @dragstart="onItemDragStart($event, task, group)"
              @dragover="onItemDragOver($event, task, group)"
              @drop="onItemDrop($event, task, group)"
              @dragend="resetDragState"
            >
              <!-- done toggle -->
              <button
                class="mt-0.5 shrink-0 transition-colors"
                :class="task.done ? 'text-dt-accent hover:text-dt-accent/80' : 'text-dt-dim hover:text-dt-text'"
                @click="workspace.toggleDone(task)"
                :title="task.done ? 'Mark open' : 'Mark done'"
              >
                <TaskStatusIcon :done="task.done" size="size-4" />
              </button>

              <div class="flex-1 min-w-0">
                <div class="flex items-start gap-1.5">
                  <NuxtLink
                    :to="`/task/${task.connectorId}/${encodeURIComponent(task.id)}?from=workspace`"
                    class="min-w-0 flex-1 hover:text-white transition-colors leading-snug"
                    :class="task.done ? 'text-dt-dim' : 'text-dt-text'"
                  >{{ task.title }}</NuxtLink>
                  <span v-if="task.priority === 'high'" class="text-dt-danger text-xs shrink-0 mt-0.5">●</span>
                  <button
                    class="shrink-0 mt-0.5 rounded p-1 transition-colors"
                    :class="workspace.isActive(task)
                      ? 'text-dt-accent bg-dt-accent-deep/40 hover:text-dt-accent/80'
                      : 'text-dt-dim hover:text-dt-text hover:bg-dt-raised'"
                    @click="workspace.setActiveTask(workspace.isActive(task) ? null : task)"
                    :title="workspace.isActive(task) ? 'Clear active task' : 'Set as active task'"
                  >
                    <MapPinIcon class="size-3.5" />
                  </button>
                </div>
                <div v-if="prefs.showLabels && task.labels?.length || prefs.showOrigin" class="flex items-center gap-1.5 flex-wrap mt-1">
                  <span v-if="prefs.showOrigin" class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-dt-raised border border-dt-border text-dt-dim">
                    <ConnectorIcon :connector-id="task.connectorId" :size="10" />
                    {{ task.connectorId }}
                  </span>
                  <LabelBadge v-if="prefs.showLabels" v-for="l in task.labels" :key="l.name" :label="l" />
                </div>
                <p v-if="prefs.showDescription && task.description" class="text-[11px] text-dt-dim mt-1 line-clamp-2 leading-relaxed">{{ task.description }}</p>
              </div>

              <!-- right actions column: remove (top) + drag handle (bottom) -->
              <div class="shrink-0 flex flex-col items-center justify-between self-stretch gap-1">
                <button
                  class="text-dt-border hover:text-dt-danger transition-colors"
                  @click="requestRemoveTask(task)"
                  title="Remove from workspace"
                >
                  <XMarkIcon class="size-3" />
                </button>
                <button
                  type="button"
                  class="cursor-grab rounded px-0.5 py-0.5 text-dt-dim opacity-0 transition-all group-hover/task:opacity-50 hover:!opacity-100 hover:text-dt-text focus-visible:opacity-100"
                  title="Drag to reorder inside this group"
                  draggable="false"
                  @mousedown.stop="onHandlePointerDown(task)"
                  @touchstart.stop="onHandlePointerDown(task)"
                >
                  <Bars3Icon class="size-3" />
                </button>
              </div>
            </li>
          </TransitionGroup>
        </div>
      </template>

      <!-- autoGroups OFF: flat list -->
      <TransitionGroup v-else tag="ul" name="task-reorder" :class="prefs.compactMode ? 'space-y-0.5' : 'space-y-3.5'">
        <li
          v-for="task in sortedItems"
          :key="taskKey(task)"
          class="group/task flex items-start gap-2 rounded-md px-2 transition-all duration-200"
          :class="[
            prefs.compactMode ? 'py-0.5' : 'py-1.5',
            workspace.isActive(task) ? 'border border-dt-accent bg-dt-accent-deep/30' : 'border border-transparent hover:border-dt-border',
            draggingTaskKey === taskKey(task) ? 'opacity-60 scale-[0.995]' : 'opacity-100',
            dropTargetTaskKey === taskKey(task) ? 'task-drop-target' : ''
          ]"
          :draggable="true"
          @dragstart="onFlatItemDragStart($event, task)"
          @dragover="onFlatItemDragOver($event, task)"
          @drop="onFlatItemDrop($event, task)"
          @dragend="resetDragState"
        >
          <!-- done toggle -->
          <button
            class="mt-0.5 shrink-0 transition-colors"
            :class="task.done ? 'text-dt-accent hover:text-dt-accent/80' : 'text-dt-dim hover:text-dt-text'"
            @click="workspace.toggleDone(task)"
            :title="task.done ? 'Mark open' : 'Mark done'"
          >
            <TaskStatusIcon :done="task.done" size="size-4" />
          </button>

          <div class="flex-1 min-w-0">
            <div class="flex items-start gap-1.5">
              <NuxtLink
                :to="`/task/${task.connectorId}/${encodeURIComponent(task.id)}?from=workspace`"
                class="min-w-0 flex-1 hover:text-white transition-colors leading-snug"
                :class="task.done ? 'text-dt-dim' : 'text-dt-text'"
              >{{ task.title }}</NuxtLink>
              <span v-if="task.priority === 'high'" class="text-dt-danger text-xs shrink-0 mt-0.5">●</span>
              <button
                class="shrink-0 mt-0.5 rounded p-1 transition-colors"
                :class="workspace.isActive(task)
                  ? 'text-dt-accent bg-dt-accent-deep/40 hover:text-dt-accent/80'
                  : 'text-dt-dim hover:text-dt-text hover:bg-dt-raised'"
                @click="workspace.setActiveTask(workspace.isActive(task) ? null : task)"
                :title="workspace.isActive(task) ? 'Clear active task' : 'Set as active task'"
              >
                <MapPinIcon class="size-3.5" />
              </button>
            </div>
            <div v-if="prefs.showLabels && task.labels?.length || prefs.showOrigin" class="flex items-center gap-1.5 flex-wrap mt-1">
              <span v-if="prefs.showOrigin" class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-dt-raised border border-dt-border text-dt-dim">
                <ConnectorIcon :connector-id="task.connectorId" :size="10" />
                {{ task.connectorId }}
              </span>
              <LabelBadge v-if="prefs.showLabels" v-for="l in task.labels" :key="l.name" :label="l" />
            </div>
            <p v-if="prefs.showDescription && task.description" class="text-[11px] text-dt-dim mt-1 line-clamp-2 leading-relaxed">{{ task.description }}</p>
          </div>

          <!-- right actions column: remove (top) + drag handle (bottom) -->
          <div class="shrink-0 flex flex-col items-center justify-between self-stretch gap-1">
            <button
              class="text-dt-border hover:text-dt-danger transition-colors"
              @click="requestRemoveTask(task)"
              title="Remove from workspace"
            >
              <XMarkIcon class="size-3" />
            </button>
            <button
              type="button"
              class="cursor-grab rounded px-0.5 py-0.5 text-dt-dim opacity-0 transition-all group-hover/task:opacity-50 hover:!opacity-100 hover:text-dt-text focus-visible:opacity-100"
              title="Drag to reorder"
              draggable="false"
              @mousedown.stop="onHandlePointerDown(task)"
              @touchstart.stop="onHandlePointerDown(task)"
            >
              <Bars3Icon class="size-3" />
            </button>
          </div>
        </li>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.task-reorder-move {
  transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.congrats-float-enter-active,
.congrats-float-leave-active {
  transition: all 260ms ease;
}

.congrats-float-enter-from,
.congrats-float-leave-to {
  opacity: 0;
  transform: scale(0.93);
}

.congrats-panel {
  animation: congrats-pop 380ms cubic-bezier(0.16, 1, 0.3, 1);
}

.congrats-spark {
  animation: congrats-pulse 1200ms ease-in-out infinite;
}

.congrats-emoji {
  display: inline-block;
  animation: congrats-bounce 900ms ease-in-out infinite;
}

@keyframes congrats-pop {
  from {
    transform: translateY(12px) scale(0.94);
  }
  to {
    transform: translateY(0) scale(1);
  }
}

@keyframes congrats-bounce {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  40% {
    transform: translateY(-6px) rotate(-8deg);
  }
  70% {
    transform: translateY(-2px) rotate(6deg);
  }
}

@keyframes congrats-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
}

.task-reorder-enter-active,
.task-reorder-leave-active {
  transition: all 180ms ease;
}

.task-reorder-enter-from,
.task-reorder-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.task-drop-target {
  border-color: var(--dt-accent, #5d8cff);
  background: color-mix(in srgb, var(--dt-accent, #5d8cff) 10%, transparent);
}
</style>
