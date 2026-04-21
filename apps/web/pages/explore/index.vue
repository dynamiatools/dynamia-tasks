<script setup lang="ts">
const connectors = useConnectorsStore()
onMounted(() => connectors.load())
</script>

<template>
  <div>
    <p class="text-xs text-gray-400 mb-4">pick a connector</p>
    <div v-if="connectors.loading">loading...</div>
    <ul v-else>
      <li v-for="c in connectors.connectors" :key="c.id" class="py-0.5">
        <NuxtLink
          v-if="c.capabilities.hasExplorer && c.configured"
          :to="`/explore/${c.id}`"
          class="hover:underline"
        >{{ c.icon }} {{ c.name }}</NuxtLink>
        <NuxtLink
          v-else-if="!c.configured"
          :to="`/settings/${c.id}`"
          class="text-gray-400 hover:underline"
        >{{ c.icon }} {{ c.name }} — <span class="text-xs">not configured →</span></NuxtLink>
        <span v-else class="text-gray-400">
          {{ c.icon }} {{ c.name }}
          <span class="text-xs ml-1">(no explorer)</span>
        </span>
      </li>
    </ul>
    <p class="mt-6 text-xs text-gray-400">
      local tasks are added directly via
      <NuxtLink to="/explore/local" class="underline">explore/local</NuxtLink>
    </p>
  </div>
</template>

