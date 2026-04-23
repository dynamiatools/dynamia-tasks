<script setup lang="ts">
const connectors = useConnectorsStore()
onMounted(() => connectors.load())
</script>

<template>
  <div>
    <AppSectionLabel mb="mb-4">connectors</AppSectionLabel>
    <AppSpinner v-if="connectors.loading" />
    <ul v-else class="space-y-2">
      <li v-for="c in connectors.connectors" :key="c.id" class="flex items-center gap-2.5">
        <ConnectorIcon :connector-id="c.id" class="text-dt-muted shrink-0" />
        <NuxtLink
          v-if="c.capabilities.hasExplorer && c.configured"
          :to="`/explore/${c.id}`"
          class="text-dt-text hover:text-white transition-colors"
        >{{ c.name }}</NuxtLink>
        <NuxtLink
          v-else-if="!c.configured"
          :to="`/settings/${c.id}`"
          class="text-dt-muted hover:text-dt-text transition-colors"
        >
          {{ c.name }}
          <span class="text-dt-dim text-xs ml-1">not configured →</span>
        </NuxtLink>
        <span v-else class="text-dt-dim">{{ c.name }}</span>
      </li>
    </ul>
    <p class="mt-6 text-xs text-dt-dim">
      local →
      <NuxtLink to="/explore/local" class="text-dt-muted hover:text-dt-text underline underline-offset-2 transition-colors">explore/local</NuxtLink>
    </p>
  </div>
</template>
