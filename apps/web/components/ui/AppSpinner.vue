<script setup lang="ts">
import { ArrowPathIcon } from '@heroicons/vue/20/solid'

withDefaults(defineProps<{ label?: string; size?: string }>(), {
  label: 'loading…',
  size: 'size-3.5',
})
</script>

<template>
  <div class="flex items-center gap-2 text-sm text-dt-muted">
    <ArrowPathIcon :class="[size, 'animate-spin shrink-0']" />
    <span v-if="label">{{ label }}</span>
  </div>
</template>

