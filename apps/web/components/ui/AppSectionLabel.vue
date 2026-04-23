<script setup lang="ts">
defineProps<{ mb?: string }>()
</script>

<template>
  <p :class="['text-[10px] uppercase tracking-widest text-dt-dim', mb ?? 'mb-3']">
    <slot />
  </p>
</template>

