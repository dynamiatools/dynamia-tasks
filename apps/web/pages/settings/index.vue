<script setup lang="ts">
const connectors = useConnectorsStore()
const prefs = usePreferencesStore()

onMounted(() => {
  connectors.load()
  prefs.load()
})

function applyMode(mode: 'zen' | 'dev' | 'default') {
  if (mode === 'zen') {
    prefs.autoGroups = false
    prefs.showLabels = false
    prefs.compactMode = false
    prefs.showOrigin = false
    prefs.showDescription = false
  } else if (mode === 'dev') {
    prefs.autoGroups = true
    prefs.showLabels = true
    prefs.compactMode = false
    prefs.showOrigin = true
    prefs.showDescription = true
  } else {
    prefs.autoGroups = true
    prefs.showLabels = true
    prefs.compactMode = false
    prefs.showOrigin = false
    prefs.showDescription = false
  }
  prefs.persist()
}
</script>

<template>
  <div class="space-y-6">
    <AppSectionLabel mb="mb-0">Settings</AppSectionLabel>

    <!-- General settings -->
    <section>
      <p class="text-xs font-semibold text-dt-muted uppercase tracking-widest mb-3">General</p>

      <div class="space-y-4">
        <!-- Modes -->
        <div>
          <p class="text-[11px] font-medium text-dt-dim uppercase tracking-wider mb-2">Modes</p>
          <div class="flex gap-2">
            <button
              type="button"
              @click="applyMode('zen')"
              class="px-3 py-1 text-xs rounded border border-dt-border text-dt-muted hover:border-dt-accent hover:text-white transition-colors"
            >Zen</button>
            <button
              type="button"
              @click="applyMode('default')"
              class="px-3 py-1 text-xs rounded border border-dt-border text-dt-muted hover:border-dt-accent hover:text-white transition-colors"
            >Default</button>
            <button
              type="button"
              @click="applyMode('dev')"
              class="px-3 py-1 text-xs rounded border border-dt-border text-dt-muted hover:border-dt-accent hover:text-white transition-colors"
            >Dev</button>
          </div>
        </div>

        <!-- Workspace subsection -->
        <div>
          <p class="text-[11px] font-medium text-dt-dim uppercase tracking-wider mb-2">Workspace</p>
          <div class="space-y-2">
            <label class="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" v-model="prefs.autoGroups" @change="prefs.persist()" class="accent-dt-accent" />
              <span class="text-sm text-dt-text">Auto-group tasks</span>
            </label>
            <label class="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" v-model="prefs.showLabels" @change="prefs.persist()" class="accent-dt-accent" />
              <span class="text-sm text-dt-text">Show labels</span>
            </label>
            <label class="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" v-model="prefs.showOrigin" @change="prefs.persist()" class="accent-dt-accent" />
              <span class="text-sm text-dt-text">Show origin</span>
              <span class="text-xs text-dt-dim">— connector badge per task</span>
            </label>
            <label class="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" v-model="prefs.showDescription" @change="prefs.persist()" class="accent-dt-accent" />
              <span class="text-sm text-dt-text">Show description</span>
              <span class="text-xs text-dt-dim">— preview below title</span>
            </label>
            <label class="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" v-model="prefs.compactMode" @change="prefs.persist()" class="accent-dt-accent" />
              <span class="text-sm text-dt-text">Compact mode</span>
              <span class="text-xs text-dt-dim">— reduced spacing between tasks</span>
            </label>
            <label class="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" v-model="prefs.smallFonts" @change="prefs.persist()" class="accent-dt-accent" />
              <span class="text-sm text-dt-text">Small fonts</span>
              <span class="text-xs text-dt-dim">— smaller text for a more compact look</span>
            </label>
          </div>
        </div>
      </div>
    </section>

    <!-- Connectors -->
    <section>
      <div class="flex items-center justify-between mb-3">
        <p class="text-xs font-semibold text-dt-muted uppercase tracking-widest">Connectors</p>
        <span class="text-xs text-dt-dim">{{ connectors.connectors.length }}</span>
      </div>

      <ul class="divide-y divide-dt-border border-t border-dt-border">
        <li
          v-for="c in connectors.connectors"
          :key="c.id"
          class="flex items-center gap-3 py-2.5"
        >
          <ConnectorIcon :connector-id="c.id" class="text-dt-muted shrink-0" />

          <div class="min-w-0 flex-1">
            <p class="text-sm text-dt-text font-medium truncate">{{ c.name }}</p>
          </div>

          <span
            class="text-[11px] px-2 py-0.5 rounded border font-medium"
            :class="c.configured
              ? 'text-dt-accent border-dt-accent/40 bg-dt-accent-deep/30'
              : 'text-dt-warning border-dt-warning/40 bg-dt-warning/10'"
          >
            {{ c.configured ? 'Configured' : 'Not configured' }}
          </span>

          <NuxtLink
            :to="`/settings/${c.id}`"
            class="text-xs px-2 py-1 rounded border border-dt-border text-dt-muted hover:border-dt-accent hover:text-white transition-colors shrink-0"
          >
            Config
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>
