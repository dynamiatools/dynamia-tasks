<script setup lang="ts">
const props = defineProps<{ label: { name: string; color?: string } }>()

const hex = computed(() => props.label.color ? `#${props.label.color}` : '#4d9375')

const labelStyle = computed(() => ({
  '--label-color': hex.value,
  backgroundColor: `color-mix(in srgb, ${hex.value} 22%, #1e1e1e)`,
  color:           `color-mix(in srgb, ${hex.value} 75%, #ffffff)`,
  borderColor:     `color-mix(in srgb, ${hex.value} 55%, transparent)`,
}))
</script>

<template>
  <span
    :style="labelStyle"
    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide border"
  >
    <span class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ backgroundColor: hex }" />
    {{ label.name }}
  </span>
</template>
