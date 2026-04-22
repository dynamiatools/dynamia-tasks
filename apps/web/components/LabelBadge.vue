<script setup lang="ts">
const props = defineProps<{ label: { name: string; color?: string } }>()
const { style } = useLabelStyle(props.label)
</script>

<template>
  <span
    :style="style"
    class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide border"
  >{{ label.name }}</span>
</template>

