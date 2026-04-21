<script setup lang="ts">
const connectors = useConnectorsStore()
onMounted(() => connectors.load())
</script>

<template>
  <div>
    <p class="text-xs text-gray-400 mb-4">settings</p>
    <ul>
      <li v-for="c in connectors.connectors" :key="c.id" class="py-0.5 flex gap-3 items-center">
        <NuxtLink :to="`/settings/${c.id}`" class="hover:underline">
          {{ c.icon }} {{ c.name }}
        </NuxtLink>
        <span class="text-xs" :class="c.configured ? 'text-gray-400' : 'text-yellow-600'">
          {{ c.configured ? 'configured' : 'not configured' }}
        </span>
      </li>
    </ul>
  </div>
</template>

