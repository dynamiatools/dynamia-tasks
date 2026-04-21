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
    <p class="text-xs text-gray-400 mb-1">
      <NuxtLink to="/explore" class="hover:underline">explore</NuxtLink>
      / {{ connectorId }}
    </p>
    <div v-if="explorer.loading">loading sources...</div>
    <div v-else-if="explorer.sources.length === 0" class="text-gray-500 text-sm mt-4">
      no sources found.
    </div>
    <ul v-else class="mt-4">
      <li v-for="src in explorer.sources" :key="src.id" class="py-0.5">
        <NuxtLink
          :to="`/explore/${connectorId}/${encodeURIComponent(src.id)}`"
          class="hover:underline"
        >
          <span v-if="src.group" class="text-gray-400">{{ src.group }}/</span>{{ src.name }}
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

