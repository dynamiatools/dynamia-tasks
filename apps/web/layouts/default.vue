<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-100 text-sm font-sans">
    <nav class="border-b border-zinc-800/60 px-4 py-3 flex gap-5 items-center">
      <span class="text-zinc-500 font-medium tracking-tight text-xs uppercase select-none">dynamia</span>
      <NuxtLink
        to="/"
        class="transition-colors"
        :class="route.path === '/' ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-100'"
      >workspace</NuxtLink>
      <NuxtLink
        to="/explore"
        class="transition-colors"
        :class="route.path.startsWith('/explore') ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-100'"
      >explore</NuxtLink>
      <NuxtLink
        to="/settings"
        class="transition-colors"
        :class="route.path.startsWith('/settings') ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-100'"
      >settings</NuxtLink>
    </nav>
    <main class="px-4 py-5">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
</script>
