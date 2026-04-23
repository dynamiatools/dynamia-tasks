<script setup lang="ts">
defineProps<{
  modelValue?: string
  placeholder?: string
  type?: string
  mono?: boolean
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
      'w-full bg-transparent border-b border-dt-border focus:border-dt-accent',
      'outline-none py-1 text-sm text-dt-text placeholder:text-dt-dim transition-colors',
      mono ? 'font-mono' : '',
    ]"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

