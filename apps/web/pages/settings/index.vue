<script setup lang="ts">
const connectors = useConnectorsStore()
onMounted(() => connectors.load())
</script>

<template>
  <div>
    <AppSectionLabel mb="mb-4">settings</AppSectionLabel>
    <ul class="space-y-2">
      <li v-for="c in connectors.connectors" :key="c.id" class="flex items-center gap-2.5">
        <ConnectorIcon :connector-id="c.id" class="text-dt-muted shrink-0" />
        <NuxtLink :to="`/settings/${c.id}`" class="text-dt-text hover:text-white transition-colors">
          {{ c.name }}
        </NuxtLink>
        <span
          class="text-xs ml-auto"
          :class="c.configured ? 'text-dt-accent' : 'text-dt-warning'"
        >{{ c.configured ? 'configured' : 'not configured' }}</span>
      </li>
    </ul>
  </div>
</template>
