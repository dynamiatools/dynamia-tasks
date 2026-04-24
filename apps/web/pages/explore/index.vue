<script setup lang="ts">
import { MagnifyingGlassIcon } from '@heroicons/vue/20/solid'
import { computed, onMounted } from 'vue'
import { useConnectorsStore } from '../../stores/connectors'

const connectors = useConnectorsStore()
const searchableConnectors = computed(() =>
  connectors.connectors.filter((c: any) => c.capabilities.hasExplorer && c.configured && c.id !== 'local')
)

onMounted(() => connectors.load())
</script>

<template>
  <div class="space-y-3">
    <AppSectionLabel mb="mb-1">Explorer</AppSectionLabel>

    <AppSpinner v-if="connectors.loading" />
    <ul v-else class="space-y-1.5">
      <li
        v-for="c in searchableConnectors"
        :key="c.id"
        class="border-b border-dt-border/80"
      >
        <NuxtLink
          :to="`/explore/${c.id}`"
          class="flex items-center gap-2.5 px-1 py-2 text-dt-text hover:text-white transition-colors"
        >
          <ConnectorIcon :connector-id="c.id" class="shrink-0 text-dt-muted" />
          <span class="truncate">{{ c.name }}</span>
          <MagnifyingGlassIcon class="size-3.5 ml-auto text-dt-dim" />
        </NuxtLink>
      </li>
    </ul>

    <NuxtLink
      to="/explore/local"
      class="flex items-center gap-2.5 px-1 py-2 text-sm text-dt-text border-b border-dt-border/80 hover:text-white transition-colors"
    >
      <ConnectorIcon connector-id="local" class="shrink-0 text-dt-muted" />
      <span>Local Tasks</span>
      <MagnifyingGlassIcon class="size-3.5 ml-auto text-dt-dim" />
    </NuxtLink>
  </div>
</template>
