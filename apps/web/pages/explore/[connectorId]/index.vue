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
    <AppBreadcrumb>
      <NuxtLink to="/explore" class="hover:text-dt-text transition-colors">explore</NuxtLink>
      <span class="flex items-center gap-1">
        <ConnectorIcon :connector-id="connectorId" class="text-dt-muted inline" />
        <span class="ml-0.5">{{ connectorId }}</span>
      </span>
    </AppBreadcrumb>

    <AppSpinner v-if="explorer.loading" />
    <p v-else-if="explorer.sources.length === 0" class="text-dt-dim text-sm">no sources found.</p>
    <ul v-else class="space-y-1">
      <li v-for="src in explorer.sources" :key="src.id">
        <NuxtLink
          :to="`/explore/${connectorId}/${encodeURIComponent(src.id)}`"
          class="text-dt-text hover:text-white transition-colors"
        >
          <span v-if="src.group" class="text-dt-dim">{{ src.group }}/</span>{{ src.name }}
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
