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
  if (!t) { reposError.value = 'ingresa el token primero'; return }
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
    // mantener seleccionados los que siguen existiendo
    selectedRepos.value = selectedRepos.value.filter(r => res.sources.some((s: any) => s.id === r))
  } catch (e: any) {
    reposError.value = e?.data?.message ?? e?.message ?? 'error cargando repositorios'
    availableSources.value = []
  } finally {
    loadingRepos.value = false
  }
}

function toggleRepo(id: string) {
  const idx = selectedRepos.value.indexOf(id)
  if (idx >= 0) selectedRepos.value.splice(idx, 1)
  else selectedRepos.value.push(id)
}

function selectAll() { selectedRepos.value = availableSources.value.map(s => s.id) }
function selectNone() { selectedRepos.value = [] }

async function save() {
  saving.value = true
  saved.value = false
  try {
    await configStore.saveConnectorConfig('github', {
      token: token.value.trim(),
      repos: selectedRepos.value,
    })
    await connectorsStore.load()
    saved.value = true
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form @submit.prevent="save" class="space-y-6">

    <!-- ① Token -->
    <div>
      <label class="block text-xs text-zinc-500 mb-1">Personal Access Token *</label>
      <input
        v-model="token"
        type="password"
        placeholder="ghp_…"
        class="w-full bg-transparent border-b border-zinc-700 focus:border-zinc-400 outline-none py-1 text-sm text-zinc-100 placeholder-zinc-600 font-mono transition-colors"
      />
      <p class="text-xs text-zinc-600 mt-1">GitHub PAT with repo scope</p>
    </div>

    <!-- ② Repositories -->
    <div>
      <div class="flex items-center gap-3 mb-2">
        <span class="text-xs text-zinc-500">Repositories</span>
        <button
          type="button"
          @click="loadRepos"
          :disabled="loadingRepos || !token.trim()"
          class="text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition-colors"
        >{{ loadingRepos ? 'loading…' : reposLoaded ? '↺ reload' : 'load →' }}</button>
        <span v-if="reposError" class="text-xs text-red-400">{{ reposError }}</span>
      </div>

      <!-- hint -->
      <p v-if="!reposLoaded && !loadingRepos" class="text-xs text-zinc-600 leading-relaxed">
        <template v-if="!token.trim()">Enter your token to load repositories.</template>
        <template v-else-if="selectedRepos.length === 0">Click "load →" to see available repositories.</template>
        <template v-else>
          Saved:
          <span class="font-mono text-zinc-500">{{ selectedRepos.join(', ') }}</span>
          — click "load →" to change.
        </template>
      </p>

      <!-- Repo list -->
      <div v-if="reposLoaded">
        <p v-if="availableSources.length === 0" class="text-xs text-zinc-600">
          No repositories found for this token.
        </p>

        <div v-else>
          <div class="flex gap-3 mb-3">
            <button type="button" @click="selectAll" class="text-xs text-zinc-500 hover:text-zinc-200 transition-colors">all</button>
            <button type="button" @click="selectNone" class="text-xs text-zinc-500 hover:text-zinc-200 transition-colors">none</button>
            <span class="text-xs text-zinc-600">{{ selectedRepos.length }} / {{ availableSources.length }}</span>
          </div>

          <div v-for="(repos, group) in groupedSources" :key="group" class="mb-4">
            <p class="text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5">{{ group }}</p>
            <ul class="space-y-1 ml-1">
              <li v-for="src in repos" :key="src.id">
                <label class="flex items-center gap-2.5 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    :checked="selectedRepos.includes(src.id)"
                    @change="toggleRepo(src.id)"
                  />
                  <span class="text-sm text-zinc-300 group-hover:text-white transition-colors font-mono">{{ src.name }}</span>
                </label>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- ③ Save -->
    <div class="flex gap-4 items-center pt-1 border-t border-zinc-800">
      <button
        type="submit"
        :disabled="saving || !token.trim()"
        class="text-sm text-zinc-200 hover:text-white disabled:opacity-30 transition-colors"
      >{{ saving ? 'saving…' : 'save' }}</button>
      <span v-if="saved" class="text-xs text-emerald-500">saved ✓</span>
    </div>

  </form>
</template>

