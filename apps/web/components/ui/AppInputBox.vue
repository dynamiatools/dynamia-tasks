<script setup lang="ts">
defineProps<{
  modelValue?: string
  placeholder?: string
  type?: string
  mono?: boolean
  rows?: number
}>()

defineEmits<{ 'update:modelValue': [v: string] }>()
</script>

<template>
  <input
    v-bind="$attrs"
    :type="type ?? 'text'"
    :value="modelValue"
    :placeholder="placeholder"
    :class="[
      'w-full bg-dt-bg border border-dt-border rounded-md focus:border-dt-accent',
      'outline-none px-3 py-2 text-sm text-dt-text placeholder:text-dt-dim transition-colors',
      mono ? 'font-mono' : '',
    ]"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

