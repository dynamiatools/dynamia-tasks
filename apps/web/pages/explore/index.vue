<script setup lang="ts">
const connectors = useConnectorsStore()
onMounted(() => connectors.load())
</script>

<template>
  <div>
    <p class="text-[10px] uppercase tracking-widest text-zinc-600 mb-4">connectors</p>
    <div v-if="connectors.loading" class="text-zinc-500 animate-pulse">loading…</div>
    <ul v-else class="space-y-2">
      <li v-for="c in connectors.connectors" :key="c.id" class="flex items-center gap-2.5">
        <ConnectorIcon :connector-id="c.id" class="text-zinc-400 shrink-0" />
        <NuxtLink
          v-if="c.capabilities.hasExplorer && c.configured"
          :to="`/explore/${c.id}`"
          class="text-zinc-200 hover:text-white transition-colors"
        >{{ c.name }}</NuxtLink>
        <NuxtLink
          v-else-if="!c.configured"
          :to="`/settings/${c.id}`"
          class="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {{ c.name }}
          <span class="text-zinc-600 text-xs ml-1">not configured →</span>
        </NuxtLink>
        <span v-else class="text-zinc-600">{{ c.name }}</span>
      </li>
    </ul>
    <p class="mt-6 text-xs text-zinc-600">
      local →
      <NuxtLink to="/explore/local" class="text-zinc-400 hover:text-zinc-200 underline underline-offset-2">explore/local</NuxtLink>
    </p>
  </div>
</template>
