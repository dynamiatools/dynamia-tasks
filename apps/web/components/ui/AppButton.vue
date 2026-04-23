<script setup lang="ts">
import { ArrowPathIcon } from '@heroicons/vue/20/solid'

type Variant = 'primary' | 'ghost' | 'accent' | 'accent-outline' | 'danger' | 'link'
type Size = 'xs' | 'sm' | 'md'

const props = withDefaults(defineProps<{
  variant?: Variant
  size?: Size
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}>(), {
  variant: 'ghost',
  size: 'sm',
  type: 'button',
})

const emit = defineEmits<{ click: [e: MouseEvent] }>()

const sizeClass: Record<Size, string> = {
  xs: 'px-2 py-1 text-xs gap-1',
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
}

const variantClass: Record<Variant, string> = {
  primary:
    'bg-dt-accent text-white border-dt-accent hover:opacity-90',
  ghost:
    'bg-dt-raised text-dt-text border-dt-border hover:border-dt-accent hover:bg-dt-accent-deep hover:text-dt-accent',
  accent:
    'bg-dt-accent text-white border-dt-accent hover:opacity-90',
  'accent-outline':
    'bg-dt-raised text-dt-accent border-dt-border hover:border-dt-accent hover:bg-dt-accent-deep',
  danger:
    'bg-dt-raised text-dt-muted border-dt-border hover:border-dt-danger hover:text-dt-danger',
  link:
    'text-dt-dim hover:text-dt-text border-transparent bg-transparent px-0',
}

const classes = computed(() =>
  [
    'inline-flex items-center font-medium rounded-md border transition-all',
    'disabled:opacity-40 disabled:cursor-not-allowed',
    sizeClass[props.size],
    variantClass[props.variant],
  ].join(' ')
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="classes"
    @click="emit('click', $event)"
  >
    <ArrowPathIcon v-if="loading" class="size-3.5 animate-spin shrink-0" />
    <slot />
  </button>
</template>

