<script setup lang="ts">
const workspace = useWorkspaceStore()
const connectors = useConnectorsStore()

onMounted(async () => {
  await connectors.load()
  await workspace.load()
})
</script>

<template>
  <div>
    <div v-if="workspace.loading" class="text-gray-500">loading...</div>

    <div v-else-if="workspace.error" class="text-red-600">
      error: {{ workspace.error }}
      <p class="mt-1 text-gray-500 text-xs">Is the server running? <code>pnpm dev:server</code></p>
    </div>

    <div v-else-if="workspace.items.length === 0" class="text-gray-500">
      <p>workspace is empty.</p>
      <p class="mt-1">→ <NuxtLink to="/explore" class="underline">explore tasks</NuxtLink> to add some.</p>
    </div>

    <div v-else>
      <div v-for="(tasks, group) in workspace.grouped" :key="group" class="mb-6">
        <p class="text-xs text-gray-400 mb-1">{{ group }}</p>
        <ul>
          <li v-for="task in tasks" :key="task.id" class="flex items-start gap-2 py-0.5">
            <button
              class="mt-0.5 shrink-0 cursor-pointer"
              @click="workspace.toggleDone(task)"
              :title="task.done ? 'Mark open' : 'Mark done'"
            >
              <span v-if="task.done" class="text-gray-400">[x]</span>
              <span v-else>[ ]</span>
            </button>
            <div class="flex-1 min-w-0">
              <NuxtLink
                :to="`/task/${task.connectorId}/${encodeURIComponent(task.id)}`"
                class="hover:underline"
                :class="task.done ? 'line-through text-gray-400' : ''"
              >{{ task.title }}</NuxtLink>
              <span class="text-gray-400 ml-2">{{ task.connectorIcon }}</span>
              <span v-if="task.priority === 'high'" class="text-red-500 ml-1">!</span>
              <span v-if="task.labels?.length" class="text-gray-400 ml-2 text-xs">
                {{ task.labels.map(l => l.name).join(' ') }}
              </span>
            </div>
            <button
              class="text-gray-400 hover:text-red-500 text-xs shrink-0"
              @click="workspace.removeTask(task.connectorId, task.id)"
              title="Remove from workspace"
            >×</button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

