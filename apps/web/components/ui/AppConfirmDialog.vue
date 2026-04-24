<script setup lang="ts">
withDefaults(defineProps<{
  open: boolean
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'danger' | 'accent' | 'ghost'
  loading?: boolean
}>(), {
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmVariant: 'danger',
  loading: false,
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Transition name="confirm-dialog-fade">
    <div
      v-if="open"
      class="fixed inset-0 z-[70] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      @click.self="emit('cancel')"
    >
      <div class="absolute inset-0 bg-black/45 backdrop-blur-[1px]" />
      <div class="relative w-full max-w-md rounded-xl border border-dt-border bg-dt-bg p-4 shadow-2xl">
        <h3 class="text-sm font-semibold text-dt-text">{{ title }}</h3>
        <p v-if="message" class="mt-2 text-xs leading-relaxed text-dt-dim">{{ message }}</p>

        <div class="mt-4 flex justify-end gap-2">
          <AppButton size="xs" variant="ghost" :disabled="loading" @click="emit('cancel')">
            {{ cancelText }}
          </AppButton>
          <AppButton size="xs" :variant="confirmVariant" :loading="loading" @click="emit('confirm')">
            {{ confirmText }}
          </AppButton>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.confirm-dialog-fade-enter-active,
.confirm-dialog-fade-leave-active {
  transition: opacity 180ms ease;
}

.confirm-dialog-fade-enter-from,
.confirm-dialog-fade-leave-to {
  opacity: 0;
}
</style>
