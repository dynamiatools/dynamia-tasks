<script setup lang="ts">
import { ClipboardDocumentIcon, DocumentDuplicateIcon } from '@heroicons/vue/20/solid'
import { ide } from '@dynamia-tools/ide-bridge'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    type?: string
    mono?: boolean
    rows?: number
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
  <div v-if="withClipboard" class="flex items-center gap-1.5 px-2 py-1.5 bg-dt-bg border border-dt-border rounded-md focus-within:border-dt-accent transition-colors">
    <input
      v-bind="$attrs"
      :type="type ?? 'text'"
      :value="modelValue"
      :placeholder="placeholder"
      :class="[
        'flex-1 min-w-0 bg-transparent outline-none text-sm text-dt-text placeholder:text-dt-dim',
        mono ? 'font-mono' : '',
      ]"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      type="button"
      title="Paste from clipboard"
      class="shrink-0 p-0.5 text-dt-dim hover:text-dt-accent transition-colors"
      @click="pasteFromClipboard"
    >
      <ClipboardDocumentIcon class="size-3.5" />
    </button>
    <button
      v-if="modelValue"
      type="button"
      title="Copy to clipboard"
      class="shrink-0 p-0.5 text-dt-dim hover:text-dt-accent transition-colors"
      @click="copyToClipboard"
    >
      <DocumentDuplicateIcon class="size-3.5" />
    </button>
  </div>

  <input
    v-else
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
