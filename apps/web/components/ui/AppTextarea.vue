<script setup lang="ts">
import { ClipboardDocumentIcon, DocumentDuplicateIcon } from '@heroicons/vue/20/solid'
import { ide } from '@dynamia-tools/ide-bridge'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    rows?: number
    mono?: boolean
    /** Show native-IDE paste / copy buttons (bypasses JCEF clipboard issues). Default: true */
    withClipboard?: boolean
  }>(),
  {
    withClipboard: true,
  }
)

const emit = defineEmits<{ 'update:modelValue': [v: string] }>()

async function pasteFromClipboard() {
  const text = await ide.clipboard.readText()
  if (text != null) emit('update:modelValue', text)
}

async function copyToClipboard() {
  if (props.modelValue) await ide.clipboard.writeText(props.modelValue)
}
</script>

<template>
  <div v-if="withClipboard" class="relative">
    <!-- Clipboard action buttons — top-right corner of the textarea -->
    <div class="absolute top-1.5 right-2 z-10 flex gap-0.5">
      <button
        type="button"
        title="Paste from clipboard"
        class="p-0.5 text-dt-dim hover:text-dt-accent bg-dt-bg rounded transition-colors"
        @click="pasteFromClipboard"
      >
        <ClipboardDocumentIcon class="size-3.5" />
      </button>
      <button
        v-if="modelValue"
        type="button"
        title="Copy to clipboard"
        class="p-0.5 text-dt-dim hover:text-dt-accent bg-dt-bg rounded transition-colors"
        @click="copyToClipboard"
      >
        <DocumentDuplicateIcon class="size-3.5" />
      </button>
    </div>
    <textarea
      v-bind="$attrs"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows ?? 4"
      :class="[
        'w-full bg-dt-bg border border-dt-border rounded-md focus:border-dt-accent',
        'outline-none px-3 py-2 pr-14 text-sm text-dt-text placeholder:text-dt-dim transition-colors resize-y',
        mono ? 'font-mono' : '',
      ]"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
  </div>

  <textarea
    v-else
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
