<script setup lang="ts">
import { CheckCircleIcon } from '@heroicons/vue/20/solid'

withDefaults(defineProps<{ done?: boolean; size?: string }>(), { size: 'size-4' })
</script>

<template>
  <!-- done: filled check circle in accent color -->
  <CheckCircleIcon v-if="done" :class="[size, 'text-dt-accent shrink-0']" />
  <!-- open: plain circle (Heroicons doesn't have a bare circle, we keep a minimal SVG) -->
  <svg v-else :class="[size, 'shrink-0']" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5" />
  </svg>
</template>

