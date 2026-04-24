<script setup lang="ts">
import { PlusIcon, ChevronRightIcon, Squares2X2Icon, ExclamationCircleIcon, XMarkIcon, MapPinIcon } from '@heroicons/vue/20/solid'
import { computed, onMounted } from 'vue'
import { useWorkspaceStore } from '../stores/workspace'
import { useConnectorsStore } from '../stores/connectors'
import { usePreferencesStore } from '../stores/preferences'

const workspace = useWorkspaceStore()
const connectors = useConnectorsStore()
const prefs = usePreferencesStore()

onMounted(async () => {
  prefs.load()
  await connectors.load()
  await workspace.load()
})

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
  if (!workspace.activeTask) return tasks
  return [...tasks].sort((a, b) => {
    const aActive = workspace.isActive(a) ? -1 : 0
    const bActive = workspace.isActive(b) ? -1 : 0
    return aActive - bActive
  })
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="sticky top-0 z-20 -mx-4 mb-5 border-b border-dt-border bg-dt-bg/95 px-4 py-3 backdrop-blur-md">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 min-w-0">
        <AppSectionLabel mb="mb-0">Workspace</AppSectionLabel>
        <span class="text-xs px-1.5 py-0.5 rounded bg-dt-raised border border-dt-border text-dt-muted font-mono">
           {{ workspace.completedCount }}/{{ workspace.items.length }}
        </span>
        </div>
        <NuxtLink
          to="/task/new"
          class="inline-flex shrink-0 items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border
               bg-dt-raised text-dt-accent border-dt-border hover:border-dt-accent hover:bg-dt-accent-deep transition-all"
        >
          <PlusIcon class="size-3" />
          New Task
        </NuxtLink>
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
          <ul :class="prefs.compactMode ? 'space-y-0.5' : 'space-y-3.5'">
            <li
              v-for="task in sortGroupTasks(tasks)"
              :key="task.id"
              class="flex items-start gap-3 rounded-md px-2 transition-colors"
              :class="[
                prefs.compactMode ? 'py-0.5' : 'py-1.5',
                workspace.isActive(task) ? 'border border-dt-accent bg-dt-accent-deep/30' : 'border border-transparent hover:border-dt-border'
              ]"
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

              <button
                class="text-dt-border hover:text-dt-danger transition-colors shrink-0 mt-0.5"
                @click="workspace.removeTask(task.connectorId, task.id)"
                title="Remove from workspace"
              >
                <XMarkIcon class="size-3" />
              </button>
            </li>
          </ul>
        </div>
      </template>

      <!-- autoGroups OFF: flat list -->
      <ul v-else :class="prefs.compactMode ? 'space-y-0.5' : 'space-y-3.5'">
        <li
          v-for="task in sortedItems"
          :key="task.id"
          class="flex items-start gap-3 rounded-md px-2 transition-colors"
          :class="[
            prefs.compactMode ? 'py-0.5' : 'py-1.5',
            workspace.isActive(task) ? 'border border-dt-accent bg-dt-accent-deep/30' : 'border border-transparent hover:border-dt-border'
          ]"
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

          <button
            class="text-dt-border hover:text-dt-danger transition-colors shrink-0 mt-0.5"
            @click="workspace.removeTask(task.connectorId, task.id)"
            title="Remove from workspace"
          >
            <XMarkIcon class="size-3" />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
