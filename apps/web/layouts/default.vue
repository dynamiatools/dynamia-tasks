<template>
  <div class="min-h-screen text-sm font-sans bg-dt-bg text-dt-text">

    <!-- Sticky nav with backdrop blur -->
    <nav class="sticky top-0 z-50 flex gap-5 items-center px-4 py-2.5 border-b border-dt-border bg-dt-surface/85 backdrop-blur-md">
      <span class="text-xs font-semibold tracking-widest uppercase select-none text-dt-dim">dynamia</span>

      <NuxtLink to="/"        class="nav-link" :class="{ 'nav-link--active': route.path === '/' }">workspace</NuxtLink>
      <NuxtLink to="/explore" class="nav-link" :class="{ 'nav-link--active': route.path.startsWith('/explore') }">explore</NuxtLink>
      <NuxtLink to="/settings"class="nav-link" :class="{ 'nav-link--active': route.path.startsWith('/settings') }">settings</NuxtLink>
    </nav>

    <main class="px-4 py-5">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
</script>

<style scoped>
.nav-link {
  @apply text-sm text-dt-muted transition-colors hover:text-dt-text;
}
.nav-link--active {
  @apply text-dt-text;
}
</style>
