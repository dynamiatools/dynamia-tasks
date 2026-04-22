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
    <div v-if="workspace.loading" class="text-zinc-500 animate-pulse">loading…</div>

    <div v-else-if="workspace.error" class="text-red-400">
      {{ workspace.error }}
      <p class="mt-1 text-zinc-500 text-xs">Is the server running? <code class="font-mono">pnpm dev:server</code></p>
    </div>

    <div v-else-if="workspace.items.length === 0" class="text-zinc-500">
      <p>workspace is empty.</p>
      <p class="mt-1 text-xs">
        <NuxtLink to="/explore" class="text-zinc-300 hover:text-white underline underline-offset-2">explore tasks</NuxtLink>
        to add some.
      </p>
    </div>

    <div v-else>
      <div v-for="(tasks, group) in workspace.grouped" :key="group" class="mb-8">
        <p class="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3 pb-1.5 border-b border-zinc-800">{{ group }}</p>
        <ul class="space-y-3.5">
          <li v-for="task in tasks" :key="task.id" class="flex items-start gap-3">
            <!-- done toggle -->
            <button
              class="mt-0.5 shrink-0 transition-colors"
              :class="task.done ? 'text-emerald-500 hover:text-emerald-400' : 'text-zinc-600 hover:text-zinc-300'"
              @click="workspace.toggleDone(task)"
              :title="task.done ? 'Mark open' : 'Mark done'"
            >
              <svg v-if="task.done" width="15" height="15" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.15"/>
                <path d="M4.5 7l2 2 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg v-else width="15" height="15" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
              </svg>
            </button>

            <div class="flex-1 min-w-0">
              <NuxtLink
                :to="`/task/${task.connectorId}/${encodeURIComponent(task.id)}`"
                class="hover:text-white transition-colors leading-snug"
                :class="task.done ? 'text-zinc-600' : 'text-zinc-200'"
              >{{ task.title }}</NuxtLink>
              <span v-if="task.priority === 'high'" class="text-red-400 ml-1.5 text-xs">●</span>
              <div v-if="task.labels?.length" class="flex gap-1 flex-wrap mt-1.5">
                <LabelBadge v-for="l in task.labels" :key="l.name" :label="l" />
              </div>
            </div>

            <button
              class="text-zinc-700 hover:text-red-400 transition-colors shrink-0 mt-0.5"
              @click="workspace.removeTask(task.connectorId, task.id)"
              title="Remove from workspace"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
