<script setup lang="ts">
const route = useRoute()
const connectorId = route.params.connectorId as string
const explorer = useExplorerStore()
const connectors = useConnectorsStore()

onMounted(async () => {
  await connectors.load()
  await explorer.loadSources(connectorId)
})
</script>

<template>
  <div>
    <p class="text-xs text-zinc-600 mb-4">
      <NuxtLink to="/explore" class="hover:text-zinc-300 transition-colors">explore</NuxtLink>
      <span class="mx-1 text-zinc-700">/</span>
      <ConnectorIcon :connector-id="connectorId" class="inline text-zinc-400" />
      <span class="ml-1">{{ connectorId }}</span>
    </p>

    <div v-if="explorer.loading" class="text-zinc-500 animate-pulse">loading…</div>
    <div v-else-if="explorer.sources.length === 0" class="text-zinc-600 text-sm">no sources found.</div>
    <ul v-else class="space-y-1">
      <li v-for="src in explorer.sources" :key="src.id">
        <NuxtLink
          :to="`/explore/${connectorId}/${encodeURIComponent(src.id)}`"
          class="text-zinc-300 hover:text-white transition-colors"
        >
          <span v-if="src.group" class="text-zinc-600">{{ src.group }}/</span>{{ src.name }}
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
