<script setup lang="ts">
import type { TaskLabel } from '@dynamia-tasks/core'

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

// ── Data ──────────────────────────────────────────────────────────────────────
const connectors = ref<ConnectorInfo[]>([])
const sources = ref<ConnectorSource[]>([])
const availableLabels = ref<TaskLabel[]>([])

// ── Form state ────────────────────────────────────────────────────────────────
const selectedConnector = ref<ConnectorInfo | null>(null)
const selectedSourceId = ref<string>('')
const title = ref('')
const description = ref('')
const priority = ref<'high' | 'medium' | 'low' | ''>('')
const selectedLabels = ref<string[]>([])
const newLabelInput = ref('')

// ── UI state ──────────────────────────────────────────────────────────────────
const loadingConnectors = ref(true)
const loadingSources = ref(false)
const loadingLabels = ref(false)
const labelsError = ref('')
const submitting = ref(false)
const error = ref('')

// ── Init ──────────────────────────────────────────────────────────────────────
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

// ── Watchers ──────────────────────────────────────────────────────────────────
watch(selectedConnector, async (c) => {
  selectedSourceId.value = ''
  sources.value = []
  availableLabels.value = []
  selectedLabels.value = []
  labelsError.value = ''
  if (!c) return

  // Load sources if connector has explorer (e.g. GitHub repos)
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
    // For local connector, load labels right away (no sourceId needed)
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

// ── Label helpers ─────────────────────────────────────────────────────────────
function toggleLabel(name: string) {
  const idx = selectedLabels.value.indexOf(name)
  if (idx === -1) selectedLabels.value.push(name)
  else selectedLabels.value.splice(idx, 1)
}

function addNewLabel() {
  const name = newLabelInput.value.trim()
  if (!name) return
  if (!availableLabels.value.some(l => l.name === name)) {
    availableLabels.value.push({ id: name, name })
  }
  if (!selectedLabels.value.includes(name)) {
    selectedLabels.value.push(name)
  }
  newLabelInput.value = ''
}

function onLabelKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    addNewLabel()
  }
}

// ── Computed validation ───────────────────────────────────────────────────────
const needsSource = computed(() => selectedConnector.value?.capabilities.hasExplorer)
const canSubmit = computed(() =>
  !!selectedConnector.value &&
  (!needsSource.value || !!selectedSourceId.value) &&
  title.value.trim().length > 0
)

// ── Submit ────────────────────────────────────────────────────────────────────
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
    // Add to workspace automatically
    try {
      await api.post('/api/workspace/add', { connectorId: created.connectorId, taskId: created.id })
    } catch { /* non-fatal */ }

    await router.push(`/task/${created.connectorId}/${encodeURIComponent(created.id)}`)
  } catch (e: any) {
    error.value = e?.data?.message ?? e?.message ?? 'Failed to create task'
    submitting.value = false
  }
}
</script>

<template>
  <div class="max-w-xl mx-auto space-y-6">
    <!-- Back + Title -->
    <div class="flex items-center gap-3">
      <NuxtLink
        to="/"
        class="text-zinc-500 hover:text-zinc-300 transition-colors"
        title="Back to workspace"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </NuxtLink>
      <h1 class="text-sm font-semibold" style="color:#d4d4d4;">New Task</h1>
    </div>

    <!-- Loading connectors -->
    <div v-if="loadingConnectors" class="flex items-center gap-2 text-sm" style="color:#858585;">
      <svg class="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="8 6"/>
      </svg>
      Loading connectors…
    </div>

    <template v-else>
      <!-- Error banner -->
      <div v-if="error" class="text-xs px-3 py-2 rounded-md" style="background:#3b1f1f; color:#f87171; border:1px solid #7f1d1d;">
        {{ error }}
      </div>

      <!-- ── Step 1: Connector ─────────────────────────────────────────────── -->
      <section>
        <label class="block text-xs font-semibold uppercase tracking-widest mb-3" style="color:#858585;">
          Destination
        </label>
        <div class="grid gap-2">
          <button
            v-for="c in connectors"
            :key="c.id"
            class="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-left transition-all"
            :style="selectedConnector?.id === c.id
              ? 'background:#1e3a2f; color:#4d9375; border:1px solid #4d9375;'
              : 'background:#2d2d30; color:#d4d4d4; border:1px solid #3e3e42;'"
            @click="selectedConnector = c"
          >
            <span class="text-base leading-none">{{ c.icon }}</span>
            <span class="font-medium">{{ c.name }}</span>
            <svg v-if="selectedConnector?.id === c.id" class="ml-auto" width="14" height="14" viewBox="0 0 14 14" fill="none" style="color:#4d9375;">
              <path d="M2.5 7l3.5 3.5 5.5-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>

          <div v-if="connectors.length === 0" class="text-xs" style="color:#6a6a6a;">
            No connectors with create capability are configured.
            <NuxtLink to="/settings" class="underline" style="color:#4d9375;">Go to Settings</NuxtLink>
          </div>
        </div>
      </section>

      <template v-if="selectedConnector">
        <!-- ── Step 2: Source (only for connectors with explorer, e.g. GitHub) ── -->
        <section v-if="needsSource">
          <label class="block text-xs font-semibold uppercase tracking-widest mb-3" style="color:#858585;">
            Repository
          </label>
          <div v-if="loadingSources" class="flex items-center gap-2 text-xs" style="color:#858585;">
            <svg class="animate-spin" width="12" height="12" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="8 6"/>
            </svg>
            Loading repositories…
          </div>
          <div v-else class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            <button
              v-for="s in sources"
              :key="s.id"
              class="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-all"
              :style="selectedSourceId === s.id
                ? 'background:#1e3a2f; color:#4d9375; border:1px solid #4d9375;'
                : 'background:#2d2d30; color:#d4d4d4; border:1px solid #3e3e42;'"
              @click="selectedSourceId = s.id"
            >
              <span v-if="s.group" class="text-xs shrink-0" style="color:#6a6a6a;">{{ s.group }} /</span>
              <span class="font-medium truncate">{{ s.name }}</span>
              <svg v-if="selectedSourceId === s.id" class="ml-auto shrink-0" width="13" height="13" viewBox="0 0 14 14" fill="none" style="color:#4d9375;">
                <path d="M2.5 7l3.5 3.5 5.5-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <p v-if="sources.length === 0" class="text-xs" style="color:#6a6a6a;">
              No repositories found. Configure them in
              <NuxtLink :to="`/settings/${selectedConnector.id}`" class="underline" style="color:#4d9375;">Settings</NuxtLink>.
            </p>
          </div>
        </section>

        <!-- ── Step 3: Task details ──────────────────────────────────────────── -->
        <template v-if="!needsSource || selectedSourceId">
          <section class="space-y-4">
            <label class="block text-xs font-semibold uppercase tracking-widest mb-1" style="color:#858585;">
              Details
            </label>

            <!-- Title -->
            <div>
              <label class="block text-xs mb-1.5" style="color:#a0a0a0;">
                Title <span style="color:#f87171;">*</span>
              </label>
              <input
                v-model="title"
                type="text"
                placeholder="Task title…"
                class="w-full px-3 py-2 rounded-md text-sm outline-none transition-colors"
                style="background:#1e1e1e; color:#d4d4d4; border:1px solid #3e3e42;"
                onfocus="this.style.borderColor='#4d9375'"
                onblur="this.style.borderColor='#3e3e42'"
              />
            </div>

            <!-- Description -->
            <div>
              <label class="block text-xs mb-1.5" style="color:#a0a0a0;">Description</label>
              <textarea
                v-model="description"
                placeholder="Describe the task (markdown supported)…"
                rows="5"
                class="w-full px-3 py-2 rounded-md text-sm outline-none transition-colors resize-y font-mono"
                style="background:#1e1e1e; color:#d4d4d4; border:1px solid #3e3e42;"
                onfocus="this.style.borderColor='#4d9375'"
                onblur="this.style.borderColor='#3e3e42'"
              />
            </div>

            <!-- Priority -->
            <div>
              <label class="block text-xs mb-1.5" style="color:#a0a0a0;">Priority</label>
              <div class="flex gap-2">
                <button
                  v-for="p in (['high', 'medium', 'low'] as Array<'high' | 'medium' | 'low'>)"
                  :key="p"
                  class="px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize"
                  :style="priority === p
                    ? p === 'high' ? 'background:#3b1f1f; color:#f87171; border:1px solid #7f1d1d;'
                      : p === 'medium' ? 'background:#322917; color:#f59e0b; border:1px solid #78350f;'
                      : 'background:#1c2b22; color:#6ee7b7; border:1px solid #065f46;'
                    : 'background:#2d2d30; color:#858585; border:1px solid #3e3e42;'"
                  @click="priority = priority === p ? '' : p"
                >
                  {{ p }}
                </button>
              </div>
            </div>

            <!-- Labels -->
            <div v-if="selectedConnector.capabilities.canLabel">
              <label class="block text-xs mb-1.5" style="color:#a0a0a0;">Labels</label>

              <!-- Loading labels -->
              <div v-if="loadingLabels" class="flex items-center gap-2 text-xs" style="color:#858585;">
                <svg class="animate-spin" width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="8 6"/>
                </svg>
                Loading labels…
              </div>

              <div v-else class="space-y-2">
                <!-- Labels error -->
                <div v-if="labelsError" class="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md" style="background:#3b1f1f; color:#f87171; border:1px solid #7f1d1d;">
                  <span>{{ labelsError }}</span>
                  <button
                    class="ml-2 underline shrink-0"
                    style="color:#fca5a5;"
                    @click="loadLabels(selectedConnector.id, selectedSourceId)"
                  >Retry</button>
                </div>

                <!-- Existing label chips -->
                <div v-if="availableLabels.length > 0" class="flex flex-wrap gap-1.5">
                  <button
                    v-for="label in availableLabels"
                    :key="label.name"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all"
                    :style="selectedLabels.includes(label.name)
                      ? `background: #${label.color ?? '4d9375'}33; color: #${label.color ?? '4d9375'}; border: 1px solid #${label.color ?? '4d9375'}88;`
                      : 'background:#2d2d30; color:#858585; border:1px solid #3e3e42;'"
                    @click="toggleLabel(label.name)"
                  >
                    <span
                      v-if="label.color"
                      class="w-2 h-2 rounded-full shrink-0"
                      :style="`background:#${label.color}`"
                    />
                    {{ label.name }}
                    <svg v-if="selectedLabels.includes(label.name)" width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                </div>

                <!-- Empty state (no error, no labels) -->
                <p
                  v-else-if="!labelsError && (selectedSourceId || selectedConnector.id === 'local')"
                  class="text-xs"
                  style="color:#6a6a6a;"
                >
                  No labels found{{ selectedConnector.id !== 'local' ? ' in this repository' : '' }}.
                </p>

                <!-- New label input (local connector: free-text creation) -->
                <div
                  v-if="selectedConnector.id === 'local'"
                  class="flex gap-2"
                >
                  <input
                    v-model="newLabelInput"
                    type="text"
                    placeholder="Add new label…"
                    class="flex-1 px-3 py-1.5 rounded-md text-xs outline-none transition-colors"
                    style="background:#1e1e1e; color:#d4d4d4; border:1px solid #3e3e42;"
                    onfocus="this.style.borderColor='#4d9375'"
                    onblur="this.style.borderColor='#3e3e42'"
                    @keydown="onLabelKeydown"
                  />
                  <button
                    class="px-2.5 py-1.5 rounded-md text-xs transition-colors"
                    style="background:#2d2d30; color:#4d9375; border:1px solid #3e3e42;"
                    @click="addNewLabel"
                  >
                    Add
                  </button>
                </div>

                <!-- Selected labels summary -->
                <div v-if="selectedLabels.length > 0" class="flex flex-wrap gap-1 pt-0.5">
                  <span class="text-xs" style="color:#6a6a6a;">Selected:</span>
                  <span
                    v-for="l in selectedLabels"
                    :key="l"
                    class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                    style="background:#1e3a2f; color:#4d9375;"
                  >
                    {{ l }}
                    <button class="hover:text-white transition-colors" @click="toggleLabel(l)">
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                        <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      </svg>
                    </button>
                  </span>
                </div>
              </div>
            </div>
          </section>

          <!-- ── Submit ─────────────────────────────────────────────────────── -->
          <div class="flex items-center gap-3 pt-2">
            <button
              :disabled="!canSubmit || submitting"
              class="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all"
              :style="canSubmit && !submitting
                ? 'background:#4d9375; color:#fff; border:1px solid #4d9375; cursor:pointer;'
                : 'background:#2d2d30; color:#6a6a6a; border:1px solid #3e3e42; cursor:not-allowed;'"
              @click="submit"
            >
              <svg v-if="submitting" class="animate-spin" width="13" height="13" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="8 6"/>
              </svg>
              <svg v-else width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7l3.5 3.5 5.5-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {{ submitting ? 'Creating…' : 'Create Task' }}
            </button>
            <NuxtLink
              to="/"
              class="text-sm transition-colors"
              style="color:#6a6a6a;"
              onmouseover="this.style.color='#d4d4d4'"
              onmouseout="this.style.color='#6a6a6a'"
            >
              Cancel
            </NuxtLink>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>


