<script setup lang="ts">
import { ChevronRightIcon, FolderIcon } from '@heroicons/vue/20/solid'

const route = useRoute()
const connectorId = route.params.connectorId as string
const explorer = useExplorerStore()
const connectors = useConnectorsStore()
const connector = computed(() => connectors.find(connectorId))

onMounted(async () => {
  await connectors.load()
  await explorer.loadSources(connectorId)
})
</script>

<template>
  <div class="space-y-4">
    <AppBreadcrumb>
      <NuxtLink to="/explore" class="hover:text-dt-text transition-colors">explore</NuxtLink>
      <span class="flex items-center gap-1">
        <ConnectorIcon :connector-id="connectorId" class="text-dt-muted inline" />
        <span class="ml-0.5">{{ connectorId }}</span>
      </span>
    </AppBreadcrumb>

    <section class=" p-4">
      <header class="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-dt-border">
        <p class="text-dt-text font-medium flex items-center gap-2 min-w-0">
          <ConnectorIcon :connector-id="connectorId" :size="16" class="text-dt-text shrink-0" />
          <span class="truncate">{{ connector?.name ?? connectorId }}</span>
        </p>
        <span class="text-[11px] px-2 py-1 rounded border text-dt-muted border-dt-border bg-dt-raised">
          {{ explorer.sources.length }} sources
        </span>
      </header>

      <AppSpinner v-if="explorer.loading" />
      <p v-else-if="explorer.sources.length === 0" class="text-dt-dim text-sm">No sources found.</p>
      <ul v-else class="space-y-2">
        <li
          v-for="src in explorer.sources"
          :key="src.id"
          class="rounded-md border border-dt-border bg-dt-raised/60"
        >
          <NuxtLink
            :to="`/explore/${connectorId}/${encodeURIComponent(src.id)}`"
            class="flex items-center gap-2.5 px-3 py-2 text-dt-text hover:text-white hover:bg-dt-raised transition-colors"
          >
            <FolderIcon class="size-3.5 text-dt-dim shrink-0" />
            <span class="truncate">
              <span v-if="src.group" class="text-dt-dim">{{ src.group }}/</span>{{ src.name }}
            </span>
            <ChevronRightIcon class="size-3 ml-auto text-dt-dim shrink-0" />
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>
