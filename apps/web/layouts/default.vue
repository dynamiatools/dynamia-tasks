<template>
  <div class="min-h-screen font-sans bg-dt-bg text-dt-text flex flex-col" :class="prefs.smallFonts ? 'text-xs' : 'text-sm'">
    <main class="flex-1 px-4 py-5 pb-24">
      <slot />
    </main>

    <nav class="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-2 px-3 py-2.5 bg-dt-surface/92 backdrop-blur-md">
      <NuxtLink to="/" class="nav-link" :class="{ 'nav-link--active': route.path === '/' || route.path.startsWith('/task') }">
        <span>Workspace</span>
        <span v-if="workspace.pendingCount > 0" class="nav-link__badge">{{ workspace.pendingCount }}</span>
      </NuxtLink>
      <NuxtLink to="/explore" class="nav-link" :class="{ 'nav-link--active': route.path.startsWith('/explore') }">Explorer</NuxtLink>
      <NuxtLink to="/settings" class="nav-link" :class="{ 'nav-link--active': route.path.startsWith('/settings') }">Settings</NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const prefs = usePreferencesStore()
const workspace = useWorkspaceStore()

onMounted(async () => {
  prefs.load()
  await workspace.load()
})
</script>

<style scoped>
.nav-link {
  @apply relative flex flex-1 items-center justify-center gap-1 text-center text-xs py-2 rounded-md border border-transparent text-dt-muted transition-colors hover:text-dt-text hover:border-dt-border;
}
.nav-link--active {
  @apply text-dt-text bg-dt-raised border-dt-border;
}

.nav-link__badge {
  @apply inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-dt-accent px-1 text-[10px] font-semibold leading-none text-white;
}
</style>
