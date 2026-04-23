<script setup lang="ts">
// Wrap children with separator between them.
// Usage:
//   <AppBreadcrumb>
//     <NuxtLink to="/explore">explore</NuxtLink>
//     <span>repo-name</span>
//   </AppBreadcrumb>
</script>

<template>
  <nav class="flex items-center gap-1 text-xs text-dt-dim flex-wrap mb-4">
    <template v-for="(node, i) in $slots.default?.()" :key="i">
      <component :is="node" />
      <!-- separator between items (not after the last) -->
      <span v-if="i < ($slots.default?.().length ?? 0) - 1" class="text-dt-border select-none">/</span>
    </template>
  </nav>
</template>

