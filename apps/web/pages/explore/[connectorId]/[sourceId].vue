<script setup lang="ts">
const route = useRoute()
const connectorId = route.params.connectorId as string
const sourceId = decodeURIComponent(route.params.sourceId as string)

const explorer = useExplorerStore()
const workspace = useWorkspaceStore()
const connectors = useConnectorsStore()

const adding = ref<string | null>(null)

onMounted(async () => {
  await connectors.load()
  explorer.reset()
  await explorer.loadTasks(connectorId, { sourceId })
})

watch([() => explorer.query, () => explorer.status], async () => {
  await explorer.loadTasks(connectorId, { sourceId })
})

async function addToWorkspace(taskId: string) {
  adding.value = taskId
  try {
    await workspace.addTask(connectorId, taskId)
  } finally {
    adding.value = null
  }
}

const inWorkspace = (taskId: string) =>
  workspace.items.some(t => t.connectorId === connectorId && t.id === taskId)
</script>

<template>
  <div>
    <p class="text-xs text-gray-400 mb-3">
      <NuxtLink to="/explore" class="hover:underline">explore</NuxtLink>
      / <NuxtLink :to="`/explore/${connectorId}`" class="hover:underline">{{ connectorId }}</NuxtLink>
      / {{ sourceId }}
    </p>

    <div class="flex gap-2 mb-4">
      <input
        v-model="explorer.query"
        type="text"
        placeholder="filter..."
        class="border-b border-gray-300 focus:border-black outline-none px-0 py-0.5 text-sm font-mono flex-1"
      />
      <select v-model="explorer.status" class="border-b border-gray-300 text-sm font-mono bg-transparent outline-none">
        <option value="open">open</option>
        <option value="closed">closed</option>
        <option value="all">all</option>
      </select>
    </div>

    <div v-if="explorer.loading">loading...</div>
    <div v-else-if="explorer.tasks.length === 0" class="text-gray-500">no tasks found.</div>
    <ul v-else>
      <li v-for="task in explorer.tasks" :key="task.id" class="flex items-start gap-2 py-0.5">
        <span class="text-gray-300 shrink-0">{{ task.done ? '[x]' : '[ ]' }}</span>
        <div class="flex-1 min-w-0">
          <NuxtLink
            :to="`/task/${connectorId}/${encodeURIComponent(task.id)}`"
            class="hover:underline"
            :class="task.done ? 'text-gray-400 line-through' : ''"
          >{{ task.title }}</NuxtLink>
          <span v-if="task.labels?.length" class="text-gray-400 ml-2 text-xs">
            {{ task.labels.map((l: any) => l.name).join(' ') }}
          </span>
        </div>
        <button
          v-if="!inWorkspace(task.id)"
          class="text-xs text-gray-400 hover:text-black shrink-0"
          :disabled="adding === task.id"
          @click="addToWorkspace(task.id)"
        >+ add</button>
        <span v-else class="text-xs text-gray-400 shrink-0">added</span>
      </li>
    </ul>
  </div>
</template>

