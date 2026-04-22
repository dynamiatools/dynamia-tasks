<script setup lang="ts">
const configStore = useConfigStore()
const connectorsStore = useConnectorsStore()

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
    const api = useApi()
    const res = await api.post<{ sources: any[] }>('/api/connectors/github/probe-sources', { token: t, orgs: [] })
    availableSources.value = (res.sources ?? []).sort((a: any, b: any) => {
      const g = (a.group ?? '').localeCompare(b.group ?? '')
      return g !== 0 ? g : a.name.localeCompare(b.name)
    })
    reposLoaded.value = true
    selectedRepos.value = selectedRepos.value.filter(r => res.sources.some((s: any) => s.id === r))
  } catch (e: any) {
    reposError.value = e?.data?.message ?? e?.message ?? 'error loading repositories'
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
  <!-- Outer container: flex column so sticky footer works -->
  <div class="flex flex-col" style="min-height: calc(100vh - 42px);">
    <form @submit.prevent="save" class="flex-1 space-y-6 pb-16">

      <!-- ① Token -->
      <div>
        <label class="block text-xs mb-1" style="color: #858585;">Personal Access Token *</label>
        <input
          v-model="token"
          type="password"
          placeholder="ghp_…"
          class="w-full bg-transparent outline-none py-1 text-sm font-mono transition-colors"
          style="border-bottom: 1px solid #3e3e42; color: #d4d4d4;"
          @focus="(e: any) => e.target.style.borderColor = '#4d9375'"
          @blur="(e: any) => e.target.style.borderColor = '#3e3e42'"
        />
        <p class="text-xs mt-1" style="color: #6a6a6a;">GitHub PAT with <code class="font-mono">repo</code> scope</p>
      </div>

      <!-- ② Repositories -->
      <div>
        <div class="flex items-center gap-3 mb-3">
          <span class="text-xs font-medium" style="color: #858585;">Repositories</span>
          <button
            type="button"
            @click="loadRepos"
            :disabled="loadingRepos || !token.trim()"
            class="text-xs transition-colors disabled:opacity-30"
            style="color: #4d9375;"
          >{{ loadingRepos ? 'loading…' : reposLoaded ? '↺ reload' : 'load →' }}</button>
          <span v-if="reposError" class="text-xs" style="color: #f87171;">{{ reposError }}</span>
        </div>

        <!-- hint before loading -->
        <p v-if="!reposLoaded && !loadingRepos" class="text-xs leading-relaxed" style="color: #6a6a6a;">
          <template v-if="!token.trim()">Enter your token to load repositories.</template>
          <template v-else-if="selectedRepos.length === 0">Click "load →" to see available repositories.</template>
          <template v-else>
            {{ selectedRepos.length }} repo{{ selectedRepos.length === 1 ? '' : 's' }} saved —
            <button type="button" @click="loadRepos" class="underline" style="color: #858585;">reload to change</button>
          </template>
        </p>

        <!-- Repo list grouped by org -->
        <div v-if="reposLoaded">
          <p v-if="availableSources.length === 0" class="text-xs" style="color: #6a6a6a;">
            No repositories found for this token.
          </p>

          <div v-else>
            <!-- Bulk actions + counter -->
            <div class="flex items-center gap-3 mb-4 pb-2" style="border-bottom: 1px solid #3e3e42;">
              <button type="button" @click="selectAll"
                class="text-xs transition-colors" style="color: #858585;"
                onmouseover="this.style.color='#d4d4d4'" onmouseout="this.style.color='#858585'"
              >select all</button>
              <button type="button" @click="selectNone"
                class="text-xs transition-colors" style="color: #858585;"
                onmouseover="this.style.color='#d4d4d4'" onmouseout="this.style.color='#858585'"
              >none</button>
              <span class="text-xs ml-auto font-mono" style="color: #6a6a6a;">
                {{ selectedRepos.length }}/{{ availableSources.length }}
              </span>
            </div>

            <!-- Org groups -->
            <div v-for="(repos, group) in groupedSources" :key="group" class="mb-5">
              <!-- Org header -->
              <div class="flex items-center gap-2 mb-2 pb-1.5" style="border-bottom: 1px solid #2d2d30;">
                <!-- Org avatar placeholder -->
                <div class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                  style="background-color: #2d2d30; color: #858585; border: 1px solid #3e3e42;">
                  {{ String(group).charAt(0).toUpperCase() }}
                </div>
                <span class="text-xs font-semibold tracking-wide" style="color: #d4d4d4;">{{ group }}</span>
                <span class="text-[10px] font-mono ml-auto" style="color: #6a6a6a;">
                  {{ repos.filter((r: any) => selectedRepos.includes(r.id)).length }}/{{ repos.length }}
                </span>
              </div>

              <ul class="space-y-0.5">
                <li v-for="src in repos" :key="src.id">
                  <label class="flex items-center gap-2.5 cursor-pointer select-none rounded px-1.5 py-1 -mx-1.5 transition-colors group"
                    style="color: #858585;"
                    onmouseover="this.style.backgroundColor='#2d2d30'; this.style.color='#d4d4d4'"
                    onmouseout="this.style.backgroundColor='transparent'; this.style.color='#858585'"
                  >
                    <input
                      type="checkbox"
                      :checked="selectedRepos.includes(src.id)"
                      @change="toggleRepo(src.id)"
                    />
                    <span class="text-sm font-mono transition-colors" :style="selectedRepos.includes(src.id) ? 'color: #d4d4d4;' : ''">
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
    <div
      class="sticky bottom-0 flex items-center gap-4 px-4 py-3 border-t"
      style="background-color: rgba(37,37,38,0.95); backdrop-filter: blur(8px); border-color: #3e3e42;"
    >
      <button
        type="button"
        @click="save"
        :disabled="saving || !token.trim()"
        class="text-sm transition-colors disabled:opacity-30"
        style="color: #d4d4d4;"
        onmouseover="this.style.color='#ffffff'" onmouseout="this.style.color='#d4d4d4'"
      >{{ saving ? 'saving…' : 'save' }}</button>

      <Transition name="fade">
        <span v-if="saved" class="text-xs flex items-center gap-1" style="color: #4d9375;">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          saved
        </span>
      </Transition>

      <Transition name="fade">
        <span v-if="saveError" class="text-xs" style="color: #f87171;">{{ saveError }}</span>
      </Transition>

      <div v-if="saving" class="flex gap-0.5 ml-auto">
        <span class="w-1 h-1 rounded-full animate-bounce" style="background:#4d9375; animation-delay:0ms"/>
        <span class="w-1 h-1 rounded-full animate-bounce" style="background:#4d9375; animation-delay:150ms"/>
        <span class="w-1 h-1 rounded-full animate-bounce" style="background:#4d9375; animation-delay:300ms"/>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
