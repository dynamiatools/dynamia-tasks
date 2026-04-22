<script setup lang="ts">
const connectors = useConnectorsStore()
onMounted(() => connectors.load())
</script>

<template>
  <div>
    <p class="text-[10px] uppercase tracking-widest text-zinc-600 mb-4">settings</p>
    <ul class="space-y-2">
      <li v-for="c in connectors.connectors" :key="c.id" class="flex items-center gap-2.5">
        <ConnectorIcon :connector-id="c.id" class="text-zinc-400 shrink-0" />
        <NuxtLink :to="`/settings/${c.id}`" class="text-zinc-200 hover:text-white transition-colors">
          {{ c.name }}
        </NuxtLink>
        <span
          class="text-xs ml-auto"
          :class="c.configured ? 'text-emerald-500' : 'text-amber-400'"
        >{{ c.configured ? 'configured' : 'not configured' }}</span>
      </li>
    </ul>
  </div>
</template>
