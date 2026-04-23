<script setup lang="ts">
const props = defineProps<{ label: { name: string; color?: string } }>()

// Dynamic color via CSS variable — Tailwind handles the rest
const labelStyle = computed(() =>
  props.label.color
    ? `--label-color: #${props.label.color};`
    : `--label-color: #4d9375;`   /* fallback = accent */
)
</script>

<template>
  <span
    :style="labelStyle"
    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide border
           bg-[color-mix(in_srgb,var(--label-color)_15%,transparent)]
           text-[var(--label-color)]
           border-[color-mix(in_srgb,var(--label-color)_40%,transparent)]"
  >
    <span class="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--label-color)]" />
    {{ label.name }}
  </span>
</template>
