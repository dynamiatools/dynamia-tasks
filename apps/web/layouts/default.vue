<template>
  <div class="min-h-screen text-sm font-sans" style="background-color: #1e1e1e; color: #d4d4d4;">

    <!-- Sticky nav with backdrop blur -->
    <nav
      class="sticky top-0 z-50 flex gap-5 items-center px-4 py-2.5 border-b"
      style="background-color: rgba(37,37,38,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-color: #3e3e42;"
    >
      <span class="text-xs font-semibold tracking-widest uppercase select-none" style="color: #6a6a6a;">dynamia</span>

      <NuxtLink to="/" class="nav-link" :class="{ 'nav-link--active': route.path === '/' }">workspace</NuxtLink>
      <NuxtLink to="/explore" class="nav-link" :class="{ 'nav-link--active': route.path.startsWith('/explore') }">explore</NuxtLink>
      <NuxtLink to="/settings" class="nav-link" :class="{ 'nav-link--active': route.path.startsWith('/settings') }">settings</NuxtLink>
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
  color: #858585;
  transition: color 0.15s;
  font-size: 0.875rem;
}
.nav-link:hover,
.nav-link--active {
  color: #d4d4d4;
}
</style>
