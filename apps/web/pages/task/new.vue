<script setup lang="ts">
import type { TaskLabel } from '@dynamia-tasks/core'
import { ArrowLeftIcon } from '@heroicons/vue/20/solid'

interface ConnectorInfo {
  id: string
  name: string
  icon: string
  capabilities: { canCreate: boolean; hasExplorer: boolean; canLabel: boolean }
  configured: boolean
}

interface ConnectorSource {
  id: string
  name: string
  group?: string
}

const api = useApi()
const router = useRouter()

const connectors = ref<ConnectorInfo[]>([])
const sources = ref<ConnectorSource[]>([])
const availableLabels = ref<TaskLabel[]>([])

const selectedConnector = ref<ConnectorInfo | null>(null)
const selectedSourceId = ref<string>('')
const title = ref('')
const description = ref('')
const priority = ref<'high' | 'medium' | 'low' | ''>('')
const selectedLabels = ref<string[]>([])


const loadingConnectors = ref(true)
const loadingSources = ref(false)
const loadingLabels = ref(false)
const labelsError = ref('')
const submitting = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    const res = await api.get<{ connectors: ConnectorInfo[] }>('/api/connectors')
    connectors.value = res.connectors.filter(c => c.capabilities.canCreate && c.configured)
  } catch {
    error.value = 'Failed to load connectors'
  } finally {
    loadingConnectors.value = false
  }
})

watch(selectedConnector, async (c) => {
  selectedSourceId.value = ''
  sources.value = []
  availableLabels.value = []
  selectedLabels.value = []
  labelsError.value = ''
  if (!c) return
  if (c.capabilities.hasExplorer) {
    loadingSources.value = true
    try {
      const res = await api.get<{ sources: ConnectorSource[] }>(`/api/connectors/${c.id}/sources`)
      sources.value = res.sources
    } catch {
      error.value = 'Failed to load sources'
    } finally {
      loadingSources.value = false
    }
  } else {
    await loadLabels(c.id, '')
  }
})

watch(selectedSourceId, async (sourceId) => {
  availableLabels.value = []
  selectedLabels.value = []
  labelsError.value = ''
  if (selectedConnector.value && sourceId) {
    await loadLabels(selectedConnector.value.id, sourceId)
  }
})

async function loadLabels(connectorId: string, sourceId: string) {
  if (!selectedConnector.value?.capabilities.canLabel) return
  loadingLabels.value = true
  labelsError.value = ''
  try {
    const qs = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : ''
    const res = await api.get<{ labels: TaskLabel[] }>(`/api/connectors/${connectorId}/labels${qs}`)
    availableLabels.value = res.labels ?? []
  } catch (e: any) {
    labelsError.value = e?.data?.message ?? e?.message ?? 'Failed to load labels'
    availableLabels.value = []
  } finally {
    loadingLabels.value = false
  }
}

function onLabelCreate(name: string) {
  if (!availableLabels.value.some(l => l.name === name)) {
    availableLabels.value.push({ id: name, name })
  }
}

const needsSource = computed(() => selectedConnector.value?.capabilities.hasExplorer)
const canSubmit = computed(() =>
  !!selectedConnector.value &&
  (!needsSource.value || !!selectedSourceId.value) &&
  title.value.trim().length > 0
)

async function submit() {
  if (!canSubmit.value || !selectedConnector.value) return
  submitting.value = true
  error.value = ''
  try {
    const body: Record<string, unknown> = {
      title: title.value.trim(),
      description: description.value.trim() || undefined,
      labels: selectedLabels.value.length ? selectedLabels.value : undefined,
      priority: priority.value || undefined,
      sourceId: selectedSourceId.value || undefined,
    }
    const res = await api.post<{ task: { id: string; connectorId: string } }>(
      `/api/connectors/${selectedConnector.value.id}/tasks`,
      body
    )
    const created = res.task
    try {
      await api.post('/api/workspace/add', { connectorId: created.connectorId, taskId: created.id })
    } catch { /* non-fatal */ }
    await router.push('/')
  } catch (e: any) {
    error.value = e?.data?.message ?? e?.message ?? 'Failed to create task'
    submitting.value = false
  }
}
</script>

<template>
  <div class="max-w-xl mx-auto space-y-6 pb-20">
    <!-- Back + Title -->
    <div class="flex items-center gap-3">
      <NuxtLink to="/" class="text-dt-muted hover:text-dt-text transition-colors" title="Back to workspace">
        <ArrowLeftIcon class="size-4" />
      </NuxtLink>
      <h1 class="text-sm font-semibold text-dt-text">New Task</h1>
    </div>

    <AppSpinner v-if="loadingConnectors" />

    <template v-else>
      <AppAlert :message="error" />

      <!-- Step 1: Connector -->
      <section>
        <AppSectionLabel>Destination</AppSectionLabel>
        <div class="grid gap-2">
          <button
            v-for="c in connectors"
            :key="c.id"
            class="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-left transition-all border"
            :class="selectedConnector?.id === c.id
              ? 'bg-dt-accent-deep text-dt-accent border-dt-accent'
              : 'bg-dt-raised text-dt-text border-dt-border hover:border-dt-accent'"
            @click="selectedConnector = c"
          >
            <ConnectorIcon :connector-id="c.id" :size="16" class="shrink-0" />
            <span class="font-medium">{{ c.name }}</span>
            <TaskStatusIcon v-if="selectedConnector?.id === c.id" :done="true" size="size-3.5 ml-auto" />
          </button>

          <div v-if="connectors.length === 0" class="text-xs text-dt-dim">
            No connectors with create capability are configured.
            <NuxtLink to="/settings" class="underline text-dt-accent">Go to Settings</NuxtLink>
          </div>
        </div>
      </section>

      <template v-if="selectedConnector">
        <!-- Step 2: Source -->
        <section v-if="needsSource">
          <AppSectionLabel>Repository</AppSectionLabel>
          <AppSpinner v-if="loadingSources" label="Loading repositories…" />
          <div v-else class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            <button
              v-for="s in sources"
              :key="s.id"
              class="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-all border"
              :class="selectedSourceId === s.id
                ? 'bg-dt-accent-deep text-dt-accent border-dt-accent'
                : 'bg-dt-raised text-dt-text border-dt-border hover:border-dt-accent'"
              @click="selectedSourceId = s.id"
            >
              <span v-if="s.group" class="text-xs shrink-0 text-dt-dim">{{ s.group }} /</span>
              <span class="font-medium truncate">{{ s.name }}</span>
              <TaskStatusIcon v-if="selectedSourceId === s.id" :done="true" size="size-3 ml-auto shrink-0" />
            </button>
            <p v-if="sources.length === 0" class="text-xs text-dt-dim">
              No repositories found. Configure them in
              <NuxtLink :to="`/settings/${selectedConnector.id}`" class="underline text-dt-accent">Settings</NuxtLink>.
            </p>
          </div>
        </section>

        <!-- Step 3: Details -->
        <template v-if="!needsSource || selectedSourceId">
          <section class="space-y-4">
            <AppSectionLabel mb="mb-1">Details</AppSectionLabel>

            <!-- Title -->
            <div>
              <label class="block text-xs mb-1.5 text-dt-body">
                Title <span class="text-dt-danger">*</span>
              </label>
              <AppInputBox v-model="title" placeholder="Task title…" />
            </div>

            <!-- Description -->
            <div>
              <label class="block text-xs mb-1.5 text-dt-body">Description</label>
              <AppTextarea
                v-model="description"
                placeholder="Describe the task (markdown supported)…"
                :rows="5"
                mono
              />
            </div>

            <!-- Priority -->
            <div>
              <label class="block text-xs mb-1.5 text-dt-body">Priority</label>
              <div class="flex gap-2">
                <button
                  v-for="p in (['high', 'medium', 'low'] as Array<'high' | 'medium' | 'low'>)"
                  :key="p"
                  class="px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize border"
                  :class="{
                    'bg-dt-danger-bg text-dt-danger border-dt-danger-bdr': priority === p && p === 'high',
                    'bg-dt-warning-bg text-dt-warning border-dt-warning-bdr': priority === p && p === 'medium',
                    'bg-dt-success-bg text-dt-success border-dt-success-bdr': priority === p && p === 'low',
                    'bg-dt-raised text-dt-muted border-dt-border hover:border-dt-muted': priority !== p,
                  }"
                  @click="priority = priority === p ? '' : p"
                >{{ p }}</button>
              </div>
            </div>

            <!-- Labels -->
            <div v-if="selectedConnector.capabilities.canLabel">
              <label class="block text-xs mb-1.5 text-dt-body">Labels</label>
              <AppLabelPicker
                v-model="selectedLabels"
                :labels="availableLabels"
                :loading="loadingLabels"
                :error="labelsError"
                :can-create="selectedConnector.id === 'local'"
                @retry="loadLabels(selectedConnector.id, selectedSourceId)"
                @create="onLabelCreate"
              />
            </div>
          </section>

          <!-- Submit -->
          <div class="flex items-center gap-3 pt-2">
            <AppButton
              :disabled="!canSubmit"
              :loading="submitting"
              variant="primary"
              size="md"
              @click="submit"
            >
              {{ submitting ? 'Creating…' : 'Create Task' }}
            </AppButton>
            <NuxtLink to="/" class="text-sm text-dt-dim hover:text-dt-text transition-colors">Cancel</NuxtLink>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>

