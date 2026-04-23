<script setup lang="ts">
import { ExclamationCircleIcon } from '@heroicons/vue/20/solid'

defineProps<{ message?: string }>()
</script>

<template>
  <div
    v-if="message"
    class="flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-dt-danger-bg text-dt-danger border border-dt-danger-bdr"
  >
    <ExclamationCircleIcon class="size-3.5 shrink-0" />
    <span class="flex-1">{{ message }}</span>
    <slot />
  </div>
</template>

