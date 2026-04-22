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
    <div v-if="workspace.loading" class="flex items-center gap-2 text-sm" style="color: #858585;">
      <svg class="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="8 6"/>
      </svg>
      loading…
    </div>

    <div v-else-if="workspace.error" class="space-y-2">
      <div class="flex items-center gap-2 text-sm" style="color: #f87171;">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
          <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        {{ workspace.error }}
      </div>
      <p class="text-xs pl-5" style="color: #6a6a6a;">
        Is the server running?
        <code class="font-mono px-1 py-0.5 rounded text-xs" style="background:#2d2d30; color:#d4d4d4;">pnpm dev:server</code>
      </p>
    </div>

    <div v-else-if="workspace.items.length === 0" class="flex flex-col items-center justify-center py-16 gap-5 text-center">
      <!-- Icon -->
      <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background:#2d2d30; border: 1px solid #3e3e42;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="color: #6a6a6a;">
          <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
          <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
          <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M17 13v8M13 17h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>

      <div class="space-y-1">
        <p class="text-sm font-medium" style="color: #d4d4d4;">Your workspace is empty</p>
        <p class="text-xs" style="color: #6a6a6a;">Add tasks from your connectors to track them here.</p>
      </div>

      <!-- CTA buttons -->
      <div class="flex flex-col gap-2 w-full max-w-[200px]">
        <NuxtLink
          v-for="c in connectors.connectors.filter(c => c.capabilities.hasExplorer && c.configured)"
          :key="c.id"
          :to="`/explore/${c.id}`"
          class="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors"
          style="background:#2d2d30; color:#d4d4d4; border: 1px solid #3e3e42;"
          onmouseover="this.style.borderColor='#4d9375'; this.style.color='#ffffff'"
          onmouseout="this.style.borderColor='#3e3e42'; this.style.color='#d4d4d4'"
        >
          <ConnectorIcon :connector-id="c.id" class="shrink-0" style="color:#858585;" />
          <span>Explore {{ c.name }}</span>
          <svg class="ml-auto" width="12" height="12" viewBox="0 0 12 12" fill="none" style="color:#6a6a6a;">
            <path d="M4.5 2.5l4 3.5-4 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </NuxtLink>

        <!-- If no connector is configured yet -->
        <NuxtLink
          v-if="!connectors.connectors.some(c => c.configured)"
          to="/settings"
          class="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors"
          style="background:#2d2d30; color:#d4d4d4; border: 1px solid #3e3e42;"
          onmouseover="this.style.borderColor='#4d9375'; this.style.color='#ffffff'"
          onmouseout="this.style.borderColor='#3e3e42'; this.style.color='#d4d4d4'"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="color:#858585;">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M7 4.5v5M4.5 7h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>Configure a connector</span>
          <svg class="ml-auto" width="12" height="12" viewBox="0 0 12 12" fill="none" style="color:#6a6a6a;">
            <path d="M4.5 2.5l4 3.5-4 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </NuxtLink>
      </div>
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
