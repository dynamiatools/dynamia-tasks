<script setup lang="ts">
const route = useRoute()
const connectorId = route.params.connectorId as string
const sourceId = decodeURIComponent(route.params.sourceId as string)

const explorer = useExplorerStore()
const workspace = useWorkspaceStore()
const connectors = useConnectorsStore()

const adding = ref<Set<string>>(new Set())

onMounted(async () => {
  await connectors.load()
  explorer.reset()
  await explorer.loadTasks(connectorId, { sourceId })
})

watch([() => explorer.query, () => explorer.status], async () => {
  await explorer.loadTasks(connectorId, { sourceId })
})

function addToWorkspace(task: any) {
  adding.value = new Set([...adding.value, task.id])
  workspace.addTask(connectorId, task.id, { ...task, connectorId }).finally(() => {
    adding.value.delete(task.id)
    adding.value = new Set(adding.value)
  })
}

const inWorkspace = (taskId: string) =>
  workspace.items.some(t => t.connectorId === connectorId && t.id === taskId)
</script>

<template>
  <div>
    <!-- Breadcrumb -->
    <p class="text-xs text-zinc-600 mb-4 flex items-center gap-1 flex-wrap">
      <NuxtLink to="/explore" class="hover:text-zinc-300 transition-colors">explore</NuxtLink>
      <span class="text-zinc-700">/</span>
      <NuxtLink :to="`/explore/${connectorId}`" class="flex items-center gap-1 hover:text-zinc-300 transition-colors">
        <ConnectorIcon :connector-id="connectorId" class="text-zinc-500" />
        {{ connectorId }}
      </NuxtLink>
      <span class="text-zinc-700">/</span>
      <span class="text-zinc-400">{{ sourceId }}</span>
    </p>

    <!-- Filters -->
    <div class="flex gap-3 mb-5">
      <input
        v-model="explorer.query"
        type="text"
        placeholder="filter…"
        class="bg-transparent border-b border-zinc-700 focus:border-zinc-400 outline-none py-0.5 text-sm text-zinc-100 placeholder-zinc-600 flex-1 transition-colors"
      />
      <select
        v-model="explorer.status"
        class="bg-zinc-900 border-b border-zinc-700 text-sm text-zinc-300 outline-none py-0.5 cursor-pointer"
      >
        <option value="open">open</option>
        <option value="closed">closed</option>
        <option value="all">all</option>
      </select>
    </div>

    <div v-if="explorer.loading" class="text-zinc-500 animate-pulse">loading…</div>
    <div v-else-if="explorer.tasks.length === 0" class="text-zinc-600">no tasks found.</div>
    <ul v-else class="space-y-2.5">
      <li v-for="task in explorer.tasks" :key="task.id" class="flex items-start gap-2.5">
        <!-- status indicator -->
        <span class="mt-0.5 shrink-0 text-zinc-600">
          <svg v-if="task.done" width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.15"/>
            <path d="M4.5 7l2 2 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg v-else width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </span>

        <div class="flex-1 min-w-0">
          <NuxtLink
            :to="`/task/${connectorId}/${encodeURIComponent(task.id)}`"
            class="transition-colors"
            :class="task.done ? 'text-zinc-600 hover:text-zinc-400' : 'text-zinc-200 hover:text-white'"
          >{{ task.title }}</NuxtLink>
          <div v-if="task.labels?.length" class="flex gap-1 flex-wrap mt-1">
            <LabelBadge v-for="l in task.labels" :key="(l as any).name" :label="(l as any)" />
          </div>
        </div>

        <button
          v-if="!inWorkspace(task.id)"
          class="text-xs text-zinc-600 hover:text-zinc-300 transition-colors shrink-0 mt-0.5"
          :disabled="adding.has(task.id)"
          @click="addToWorkspace(task)"
        >+ add</button>
        <span v-else class="text-xs text-emerald-600 shrink-0 mt-0.5">✓</span>
      </li>
    </ul>
  </div>
</template>

