<template>
  <div class="min-h-screen bg-white font-mono text-sm text-black">
    <nav class="border-b border-black px-4 py-2 flex gap-6 items-center">
      <span class="font-bold tracking-tight">dynamia-tasks</span>
      <NuxtLink to="/" class="hover:underline" :class="$route.path === '/' ? 'underline' : ''">workspace</NuxtLink>
      <NuxtLink to="/explore" class="hover:underline" :class="$route.path.startsWith('/explore') ? 'underline' : ''">explore</NuxtLink>
      <NuxtLink to="/settings" class="hover:underline" :class="$route.path.startsWith('/settings') ? 'underline' : ''">settings</NuxtLink>
    </nav>
    <main class="max-w-2xl mx-auto px-4 py-6">
      <slot />
    </main>
  </div>
</template>

