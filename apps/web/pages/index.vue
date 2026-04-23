<script setup lang="ts">
import { PlusIcon, ChevronRightIcon, Squares2X2Icon, ExclamationCircleIcon, XMarkIcon } from '@heroicons/vue/20/solid'

const workspace = useWorkspaceStore()
const connectors = useConnectorsStore()

onMounted(async () => {
  await connectors.load()
  await workspace.load()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-5">
      <AppSectionLabel mb="mb-0">Workspace</AppSectionLabel>
      <NuxtLink
        to="/task/new"
        class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border
               bg-dt-raised text-dt-accent border-dt-border hover:border-dt-accent hover:bg-dt-accent-deep transition-all"
      >
        <PlusIcon class="size-3" />
        New Task
      </NuxtLink>
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
          v-for="c in connectors.connectors.filter(c => c.capabilities.hasExplorer && c.configured)"
          :key="c.id"
          :to="`/explore/${c.id}`"
          class="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm bg-dt-raised text-dt-text border border-dt-border hover:border-dt-accent hover:text-white transition-all"
        >
          <ConnectorIcon :connector-id="c.id" class="shrink-0 text-dt-muted" />
          <span>Explore {{ c.name }}</span>
          <ChevronRightIcon class="size-3 ml-auto text-dt-dim" />
        </NuxtLink>
        <NuxtLink
          v-if="!connectors.connectors.some(c => c.configured)"
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
      <div v-for="(tasks, group) in workspace.grouped" :key="group" class="mb-8">
        <p class="text-xs font-semibold text-dt-muted uppercase tracking-widest mb-3 pb-1.5 border-b border-dt-border">{{ group }}</p>
        <ul class="space-y-3.5">
          <li v-for="task in tasks" :key="task.id" class="flex items-start gap-3">
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
              <NuxtLink
                :to="`/task/${task.connectorId}/${encodeURIComponent(task.id)}?from=workspace`"
                class="hover:text-white transition-colors leading-snug"
                :class="task.done ? 'text-dt-dim' : 'text-dt-text'"
              >{{ task.title }}</NuxtLink>
              <span v-if="task.priority === 'high'" class="text-dt-danger ml-1.5 text-xs">●</span>
              <div v-if="task.labels?.length" class="flex gap-1 flex-wrap mt-1.5">
                <LabelBadge v-for="l in task.labels" :key="l.name" :label="l" />
              </div>
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
  </div>
</template>
