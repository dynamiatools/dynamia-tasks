<script setup lang="ts">
import { XMarkIcon, UserIcon } from '@heroicons/vue/20/solid'

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
    <AppBreadcrumb>
      <NuxtLink to="/explore" class="hover:text-dt-text transition-colors">explore</NuxtLink>
      <NuxtLink :to="`/explore/${connectorId}`" class="flex items-center gap-1 hover:text-dt-text transition-colors">
        <ConnectorIcon :connector-id="connectorId" class="text-dt-muted" />
        {{ connectorId }}
      </NuxtLink>
      <span class="text-dt-muted">{{ sourceId }}</span>
    </AppBreadcrumb>

    <!-- Filters -->
    <div class="mb-5 space-y-2">
      <div class="flex gap-3">
        <!-- Search -->
        <div class="relative flex-1">
          <AppInput
            v-model="explorer.query"
            placeholder="filter…"
          />
          <button
            v-if="explorer.query"
            class="absolute right-0 top-0.5 text-dt-dim hover:text-dt-text transition-colors"
            @click="explorer.query = ''"
          >
            <XMarkIcon class="size-3.5" />
          </button>
        </div>
        <!-- Status select -->
        <select
          v-model="explorer.status"
          class="border-b border-dt-border text-sm outline-none py-0.5 cursor-pointer bg-transparent text-dt-muted transition-colors focus:border-dt-accent"
        >
          <option value="open">open</option>
          <option value="closed">closed</option>
          <option value="all">all</option>
        </select>
      </div>

      <!-- Label chips -->
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
          class="text-[10px] px-1 text-dt-dim hover:text-dt-text transition-colors"
          @click="explorer.selectedLabels = []"
        >clear</button>
      </div>
    </div>

    <AppSpinner v-if="explorer.loading" />

    <div v-else-if="explorer.error" class="text-xs text-dt-danger space-y-1">
      <p>{{ explorer.error }}</p>
    </div>

    <div v-else-if="explorer.filteredTasks.length === 0" class="text-xs text-dt-dim space-y-1">
      <p>{{ explorer.query || explorer.selectedLabels.length ? 'no tasks match the current filters.' : 'no tasks found.' }}</p>
      <button
        v-if="explorer.query || explorer.selectedLabels.length"
        type="button"
        class="underline underline-offset-2 text-dt-muted hover:text-dt-text transition-colors"
        @click="explorer.query = ''; explorer.selectedLabels = []"
      >clear filters</button>
    </div>

    <ul v-else class="space-y-2.5">
      <li v-for="task in explorer.filteredTasks" :key="task.id" class="flex items-start gap-2.5">
        <!-- status indicator -->
        <span class="mt-0.5 shrink-0 text-dt-dim">
          <TaskStatusIcon :done="task.done" size="size-3.5" />
        </span>

        <div class="flex-1 min-w-0">
          <NuxtLink
            :to="`/task/${connectorId}/${encodeURIComponent(task.id)}`"
            class="transition-colors leading-snug"
            :class="task.done ? 'text-dt-dim hover:text-dt-muted' : 'text-dt-text hover:text-white'"
          >{{ task.title }}</NuxtLink>

          <div class="flex items-center gap-2 flex-wrap mt-1">
            <span class="text-[11px] text-dt-dim">
              {{ new Date(task.updatedAt ?? task.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}
            </span>
            <span
              v-for="a in (task.assignees ?? [])" :key="a.id"
              class="flex items-center gap-1 text-[11px] text-dt-dim"
            >
              <UserIcon class="size-2.5" />
              {{ a.login }}
            </span>
            <LabelBadge v-for="l in task.labels" :key="(l as any).name" :label="(l as any)" />
          </div>
        </div>

        <!-- Add / added button -->
        <AppButton
          v-if="!inWorkspace(task.id)"
          size="xs"
          variant="accent-outline"
          :loading="adding.has(task.id)"
          class="shrink-0 mt-0.5"
          @click="addToWorkspace(task)"
        >+ add</AppButton>
        <span v-else class="text-xs shrink-0 mt-0.5 flex items-center gap-0.5 text-dt-accent">
          <TaskStatusIcon :done="true" size="size-3" />
          added
        </span>
      </li>
    </ul>
  </div>
</template>

