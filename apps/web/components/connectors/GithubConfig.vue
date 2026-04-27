<script setup lang="ts">
 import { CheckIcon } from '@heroicons/vue/20/solid'

const configStore = useConfigStore()
const connectorsStore = useConnectorsStore()
const svc = useTaskService()

const token = ref('')
const availableSources = ref<{ id: string; name: string; group?: string }[]>([])
const selectedRepos = ref<string[]>([])
const loadingRepos = ref(false)
const reposError = ref('')
const reposLoaded = ref(false)
const saving = ref(false)
const saved = ref(false)
const saveError = ref('')

// Debounce timer for auto-save
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  const current = await configStore.getConnectorConfig('github') as Record<string, any>
  token.value = current?.token ?? ''
  selectedRepos.value = Array.isArray(current?.repos) ? current.repos : []
  if (token.value) {
    await loadRepos()
  }
})

const groupedSources = computed(() => {
  const groups: Record<string, typeof availableSources.value> = {}
  for (const s of availableSources.value) {
    const key = s.group ?? 'other'
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  }
  return groups
})

async function loadRepos() {
  const t = token.value.trim()
  if (!t) { reposError.value = 'enter token first'; return }
  loadingRepos.value = true
  reposError.value = ''
  reposLoaded.value = false
  try {
    const sources = await svc.probeConnectorSources('github', { token: t, orgs: [] })
    availableSources.value = (sources ?? []).sort((a, b) => {
      const g = (a.group ?? '').localeCompare(b.group ?? '')
      return g !== 0 ? g : a.name.localeCompare(b.name)
    })
    reposLoaded.value = true
    selectedRepos.value = selectedRepos.value.filter(r => sources.some(s => s.id === r))
  } catch (e: any) {
    reposError.value = e?.message ?? 'error loading repositories'
    availableSources.value = []
  } finally {
    loadingRepos.value = false
  }
}

function toggleRepo(id: string) {
  const idx = selectedRepos.value.indexOf(id)
  if (idx >= 0) selectedRepos.value.splice(idx, 1)
  else selectedRepos.value.push(id)
  scheduleAutoSave()
}

function selectAll() {
  selectedRepos.value = availableSources.value.map(s => s.id)
  scheduleAutoSave()
}

function selectNone() {
  selectedRepos.value = []
  scheduleAutoSave()
}

function scheduleAutoSave() {
  saved.value = false
  saveError.value = ''
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => save(), 800)
}

async function save() {
  if (!token.value.trim()) return
  saving.value = true
  saveError.value = ''
  saved.value = false
  try {
    await configStore.saveConnectorConfig('github', {
      token: token.value.trim(),
      repos: selectedRepos.value,
    })
    await connectorsStore.load()
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
  } catch (e: any) {
    saveError.value = e?.message ?? 'error saving'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col min-h-[320px]">
    <form @submit.prevent="save" class="flex-1 space-y-6 pb-16">

      <!-- ① Token -->
      <div>
        <label class="block text-xs mb-1 text-dt-muted">Personal Access Token *</label>
        <AppInput
          v-model="token"
          type="password"
          placeholder="ghp_…"
          mono
        />
        <p class="text-xs mt-1 text-dt-dim">GitHub PAT with <code class="font-mono bg-dt-raised px-1 rounded">repo</code> scope</p>
      </div>

      <!-- ② Repositories -->
      <div>
        <div class="flex items-center gap-3 mb-3">
          <span class="text-xs font-medium text-dt-muted">Repositories</span>
          <button
            type="button"
            @click="loadRepos"
            :disabled="loadingRepos || !token.trim()"
            class="text-xs text-dt-accent hover:opacity-80 transition-opacity disabled:opacity-30"
          >{{ loadingRepos ? 'loading…' : reposLoaded ? '↺ reload' : 'load →' }}</button>
          <span v-if="reposError" class="text-xs text-dt-danger">{{ reposError }}</span>
        </div>

        <p v-if="!reposLoaded && !loadingRepos" class="text-xs leading-relaxed text-dt-dim">
          <template v-if="!token.trim()">Enter your token to load repositories.</template>
          <template v-else-if="selectedRepos.length === 0">Click "load →" to see available repositories.</template>
          <template v-else>
            {{ selectedRepos.length }} repo{{ selectedRepos.length === 1 ? '' : 's' }} saved —
            <button type="button" @click="loadRepos" class="underline text-dt-muted hover:text-dt-text transition-colors">reload to change</button>
          </template>
        </p>

        <div v-if="reposLoaded">
          <p v-if="availableSources.length === 0" class="text-xs text-dt-dim">No repositories found for this token.</p>

          <div v-else>
            <!-- Bulk actions -->
            <div class="flex items-center gap-3 mb-4 pb-2 border-b border-dt-border">
              <button type="button" @click="selectAll" class="text-xs text-dt-muted hover:text-dt-text transition-colors">select all</button>
              <button type="button" @click="selectNone" class="text-xs text-dt-muted hover:text-dt-text transition-colors">none</button>
              <span class="text-xs ml-auto font-mono text-dt-dim">{{ selectedRepos.length }}/{{ availableSources.length }}</span>
            </div>

            <!-- Org groups -->
            <div v-for="(repos, group) in groupedSources" :key="group" class="mb-5">
              <div class="flex items-center gap-2 mb-2 pb-1.5 border-b border-dt-raised">
                <div class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 bg-dt-raised text-dt-muted border border-dt-border">
                  {{ String(group).charAt(0).toUpperCase() }}
                </div>
                <span class="text-xs font-semibold tracking-wide text-dt-text">{{ group }}</span>
                <span class="text-[10px] font-mono ml-auto text-dt-dim">
                  {{ repos.filter((r: any) => selectedRepos.includes(r.id)).length }}/{{ repos.length }}
                </span>
              </div>

              <ul class="space-y-0.5">
                <li v-for="src in repos" :key="src.id">
                  <label class="flex items-center gap-2.5 cursor-pointer select-none rounded px-1.5 py-1 -mx-1.5 transition-colors text-dt-muted hover:bg-dt-raised hover:text-dt-text">
                    <input
                      type="checkbox"
                      :checked="selectedRepos.includes(src.id)"
                      @change="toggleRepo(src.id)"
                    />
                    <span class="text-sm font-mono transition-colors" :class="selectedRepos.includes(src.id) ? 'text-dt-text' : ''">
                      {{ src.name }}
                    </span>
                  </label>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

    </form>

    <!-- ③ Sticky save bar -->
    <div class="sticky bottom-16 flex items-center gap-4 px-4 py-3 border border-dt-border rounded-md bg-dt-surface/95 backdrop-blur-md">
      <AppButton
        type="button"
        variant="ghost"
        :loading="saving"
        :disabled="!token.trim()"
        @click="save"
      >{{ saving ? 'saving…' : 'save' }}</AppButton>

      <Transition name="fade">
        <span v-if="saved" class="text-xs flex items-center gap-1 text-dt-accent">
          <CheckIcon class="size-3" />
          saved
        </span>
      </Transition>

      <Transition name="fade">
        <span v-if="saveError" class="text-xs text-dt-danger">{{ saveError }}</span>
      </Transition>

      <div v-if="saving" class="flex gap-0.5 ml-auto">
        <span class="w-1 h-1 rounded-full animate-bounce bg-dt-accent" style="animation-delay:0ms"/>
        <span class="w-1 h-1 rounded-full animate-bounce bg-dt-accent" style="animation-delay:150ms"/>
        <span class="w-1 h-1 rounded-full animate-bounce bg-dt-accent" style="animation-delay:300ms"/>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
