<script setup lang="ts">
defineProps<{
  modelValue?: string
  placeholder?: string
  rows?: number
  mono?: boolean
}>()

defineEmits<{ 'update:modelValue': [v: string] }>()
</script>

<template>
  <textarea
    v-bind="$attrs"
    :value="modelValue"
    :placeholder="placeholder"
    :rows="rows ?? 4"
    :class="[
      'w-full bg-dt-bg border border-dt-border rounded-md focus:border-dt-accent',
      'outline-none px-3 py-2 text-sm text-dt-text placeholder:text-dt-dim transition-colors resize-y',
      mono ? 'font-mono' : '',
    ]"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>

