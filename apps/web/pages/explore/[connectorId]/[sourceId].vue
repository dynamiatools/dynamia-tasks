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

watch(() => explorer.status, async () => {
  await explorer.loadTasks(connectorId, { sourceId })
})

function addToWorkspace(task: any) {
  adding.value = new Set([...adding.value, task.id])
  workspace.addTask(connectorId, task.id, { ...task, connectorId }).finally(() => {
    adding.value.delete(task.id)
    adding.value = new Set(adding.value)
  })
}

function toggleLabel(name: string) {
  const idx = explorer.selectedLabels.indexOf(name)
  if (idx >= 0) explorer.selectedLabels.splice(idx, 1)
  else explorer.selectedLabels.push(name)
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
    <div class="mb-5 space-y-2">
      <!-- Query + status row -->
      <div class="flex gap-3">
        <div class="relative flex-1">
          <input
            v-model="explorer.query"
            type="text"
            placeholder="filter…"
            class="w-full bg-transparent border-b outline-none py-0.5 text-sm placeholder-zinc-600 transition-colors"
            style="border-color: #3e3e42; color: #d4d4d4;"
            @focus="(e:any) => e.target.style.borderColor='#4d9375'"
            @blur="(e:any) => e.target.style.borderColor='#3e3e42'"
          />
          <button
            v-if="explorer.query"
            class="absolute right-0 top-0.5 text-zinc-600 hover:text-zinc-300 transition-colors"
            @click="explorer.query = ''"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <select
          v-model="explorer.status"
          class="border-b text-sm outline-none py-0.5 cursor-pointer transition-colors"
          style="background: transparent; border-color: #3e3e42; color: #858585;"
        >
          <option value="open">open</option>
          <option value="closed">closed</option>
          <option value="all">all</option>
        </select>
      </div>

      <!-- Label chips (only when labels exist) -->
      <div v-if="explorer.availableLabels.length > 0" class="flex gap-1.5 flex-wrap pt-0.5">
        <button
          v-for="label in explorer.availableLabels"
          :key="label.name"
          type="button"
          @click="toggleLabel(label.name)"
          class="transition-all"
          :class="explorer.selectedLabels.includes(label.name) ? 'opacity-100 scale-100' : 'opacity-50 hover:opacity-80'"
        >
          <LabelBadge :label="label" />
        </button>
        <button
          v-if="explorer.selectedLabels.length > 0"
          type="button"
          @click="explorer.selectedLabels = []"
          class="text-[10px] transition-colors px-1"
          style="color: #6a6a6a;"
          onmouseover="this.style.color='#d4d4d4'" onmouseout="this.style.color='#6a6a6a'"
        >clear</button>
      </div>
    </div>

    <div v-if="explorer.loading" class="flex items-center gap-2 text-sm" style="color: #858585;">
      <svg class="animate-spin" width="13" height="13" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="8 6"/>
      </svg>
      loading…
    </div>
    <div v-else-if="explorer.filteredTasks.length === 0" class="text-xs space-y-1" style="color: #6a6a6a;">
      <p>{{ explorer.query || explorer.selectedLabels.length ? 'no tasks match the current filters.' : 'no tasks found.' }}</p>
      <button
        v-if="explorer.query || explorer.selectedLabels.length"
        type="button"
        class="underline underline-offset-2 transition-colors"
        style="color: #858585;"
        @click="explorer.query = ''; explorer.selectedLabels = []"
      >clear filters</button>
    </div>
    <ul v-else class="space-y-2.5">
      <li v-for="task in explorer.filteredTasks" :key="task.id" class="flex items-start gap-2.5">
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
            class="transition-colors leading-snug"
            :class="task.done ? 'text-zinc-600 hover:text-zinc-400' : 'text-zinc-200 hover:text-white'"
          >{{ task.title }}</NuxtLink>

          <!-- Meta row: date + assignees + labels -->
          <div class="flex items-center gap-2 flex-wrap mt-1">
            <!-- Date -->
            <span class="text-[11px]" style="color: #6a6a6a;">
              {{ new Date(task.updatedAt ?? task.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}
            </span>
            <!-- Assignees -->
            <span
              v-for="a in (task.assignees ?? [])"
              :key="a.id"
              class="flex items-center gap-1 text-[11px]"
              style="color: #6a6a6a;"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="4" r="2.5" stroke="currentColor" stroke-width="1.3"/>
                <path d="M1.5 10.5c0-2.21 2.015-4 4.5-4s4.5 1.79 4.5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              {{ a.login }}
            </span>
            <!-- Labels -->
            <LabelBadge v-for="l in task.labels" :key="(l as any).name" :label="(l as any)" />
          </div>
        </div>

        <button
          v-if="!inWorkspace(task.id)"
          class="text-xs px-2 py-0.5 rounded transition-colors shrink-0 mt-0.5 disabled:opacity-40"
          :disabled="adding.has(task.id)"
          style="background: #2d2d30; color: #4d9375; border: 1px solid #3e3e42;"
          onmouseover="this.style.borderColor='#4d9375'; this.style.background='#1a2e24'"
          onmouseout="this.style.borderColor='#3e3e42'; this.style.background='#2d2d30'"
          @click="addToWorkspace(task)"
        >+ add</button>
        <span v-else class="text-xs shrink-0 mt-0.5 flex items-center gap-0.5" style="color: #4d9375;">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          added
        </span>
      </li>
    </ul>
  </div>
</template>

