<script setup lang="ts">
import { ChevronDownIcon, MagnifyingGlassIcon, PlusIcon, XMarkIcon } from '@heroicons/vue/20/solid'

interface LabelItem {
  id: string
  name: string
  color?: string
}

const props = withDefaults(defineProps<{
  modelValue: string[]
  labels: LabelItem[]
  loading?: boolean
  error?: string
  canCreate?: boolean   // show free-text creation input (e.g. local connector)
  placeholder?: string
}>(), {
  placeholder: 'Labels',
})

const emit = defineEmits<{
  'update:modelValue': [v: string[]]
  'retry': []
  'create': [name: string]
}>()

// ── State ─────────────────────────────────────────────────────────────────────
const open = ref(false)
const search = ref('')
const newLabel = ref('')
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const openUpward = ref(false)

// ── Filtered list ─────────────────────────────────────────────────────────────
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.labels
  return props.labels.filter(l => l.name.toLowerCase().includes(q))
})

// ── Helpers ───────────────────────────────────────────────────────────────────
const isSelected = (name: string) => props.modelValue.includes(name)

function toggle(name: string) {
  const next = isSelected(name)
    ? props.modelValue.filter(n => n !== name)
    : [...props.modelValue, name]
  emit('update:modelValue', next)
}

function remove(name: string) {
  emit('update:modelValue', props.modelValue.filter(n => n !== name))
}

function addNew() {
  const name = newLabel.value.trim()
  if (!name) return
  emit('create', name)
  if (!props.modelValue.includes(name)) {
    emit('update:modelValue', [...props.modelValue, name])
  }
  newLabel.value = ''
}

function onNewKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') { e.preventDefault(); addNew() }
}

// ── Trigger label ─────────────────────────────────────────────────────────────
const triggerLabel = computed(() => {
  const c = props.modelValue.length
  if (c === 0) return props.placeholder
  if (c === 1) return props.modelValue[0]
  return `${c} labels`
})

// ── Click-outside to close ────────────────────────────────────────────────────
function onClickOutside(e: MouseEvent) {
  if (
    panelRef.value && !panelRef.value.contains(e.target as Node) &&
    triggerRef.value && !triggerRef.value.contains(e.target as Node)
  ) {
    open.value = false
  }
}

function updatePanelDirection() {
  if (!open.value || !triggerRef.value || !panelRef.value) return

  const triggerRect = triggerRef.value.getBoundingClientRect()
  const panelHeight = panelRef.value.offsetHeight || 280
  const spaceBelow = window.innerHeight - triggerRect.bottom
  const spaceAbove = triggerRect.top

  // Open upward when there is not enough room below and there is more room above.
  openUpward.value = spaceBelow < panelHeight + 8 && spaceAbove > spaceBelow
}

watch(open, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    updatePanelDirection()
    window.addEventListener('resize', updatePanelDirection)
    window.addEventListener('scroll', updatePanelDirection, true)
    return
  }

  window.removeEventListener('resize', updatePanelDirection)
  window.removeEventListener('scroll', updatePanelDirection, true)
})

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
  window.removeEventListener('resize', updatePanelDirection)
  window.removeEventListener('scroll', updatePanelDirection, true)
})
</script>

<template>
  <div class="relative">
    <!-- ── Trigger ──────────────────────────────────────────────────────────── -->
    <button
      ref="triggerRef"
      type="button"
      class="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm border transition-all text-left"
      :class="open
        ? 'bg-dt-raised border-dt-accent text-dt-text'
        : 'bg-dt-raised border-dt-border text-dt-muted hover:border-dt-accent hover:text-dt-text'"
      @click="open = !open"
    >
      <!-- Selected chips preview (up to 3) -->
      <template v-if="modelValue.length > 0">
        <div class="flex items-center gap-1 flex-wrap flex-1 min-w-0">
          <LabelBadge
            v-for="name in modelValue.slice(0, 3)"
            :key="name"
            :label="{ name, color: labels.find(l => l.name === name)?.color }"
          />
          <span v-if="modelValue.length > 3" class="text-xs text-dt-dim">
            +{{ modelValue.length - 3 }}
          </span>
        </div>
      </template>
      <span v-else class="flex-1 text-dt-dim text-xs">{{ placeholder }}</span>

      <AppSpinner v-if="loading" size="size-3" label="" class="shrink-0" />
      <ChevronDownIcon
        v-else
        class="size-3.5 shrink-0 text-dt-dim transition-transform"
        :class="open ? 'rotate-180' : ''"
      />
    </button>

    <!-- ── Dropdown panel ───────────────────────────────────────────────────── -->
    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition-all duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-1 scale-95"
    >
      <div
        v-if="open"
        ref="panelRef"
        class="absolute z-50 w-full min-w-[220px] rounded-md border border-dt-border bg-dt-surface shadow-xl shadow-black/40 overflow-hidden"
        :class="openUpward ? 'bottom-full mb-1' : 'top-full mt-1'"
      >
        <!-- Error -->
        <div v-if="error" class="px-3 py-2 flex items-center justify-between gap-2 bg-dt-danger-bg border-b border-dt-danger-bdr">
          <span class="text-xs text-dt-danger">{{ error }}</span>
          <button class="text-xs underline text-dt-danger hover:text-white transition-colors shrink-0" @click="emit('retry')">retry</button>
        </div>

        <!-- Search -->
        <div class="flex items-center gap-2 px-3 py-2 border-b border-dt-border">
          <MagnifyingGlassIcon class="size-3.5 shrink-0 text-dt-dim" />
          <input
            v-model="search"
            type="text"
            placeholder="Search labels…"
            class="flex-1 bg-transparent outline-none text-xs text-dt-text placeholder:text-dt-dim"
          />
          <button v-if="search" @click="search = ''" class="text-dt-dim hover:text-dt-text transition-colors">
            <XMarkIcon class="size-3" />
          </button>
        </div>

        <!-- Label list -->
        <ul class="max-h-52 overflow-y-auto py-1">
          <li v-if="loading" class="px-3 py-3">
            <AppSpinner label="Loading labels…" size="size-3" />
          </li>

          <li v-else-if="filtered.length === 0 && !canCreate" class="px-3 py-3 text-xs text-dt-dim">
            {{ search ? 'No labels match.' : 'No labels available.' }}
          </li>

          <li
            v-for="label in filtered"
            :key="label.name"
            class="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer transition-colors hover:bg-dt-raised"
            @click="toggle(label.name)"
          >
            <!-- Custom checkbox visual -->
            <span
              class="w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-all"
              :class="isSelected(label.name)
                ? 'bg-dt-accent border-dt-accent'
                : 'border-dt-border bg-transparent'"
            >
              <svg v-if="isSelected(label.name)" viewBox="0 0 10 10" class="w-2.5 h-2.5 text-white" fill="none">
                <path d="M1.5 5l2.5 2.5 4.5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <LabelBadge :label="label" class="pointer-events-none" />
          </li>
        </ul>

        <!-- Create new label (canCreate mode) -->
        <div v-if="canCreate" class="border-t border-dt-border px-3 py-2 flex items-center gap-2">
          <PlusIcon class="size-3.5 shrink-0 text-dt-dim" />
          <input
            v-model="newLabel"
            type="text"
            placeholder="Create label…"
            class="flex-1 bg-transparent outline-none text-xs text-dt-text placeholder:text-dt-dim"
            @keydown="onNewKeydown"
          />
          <button
            v-if="newLabel.trim()"
            class="text-xs text-dt-accent hover:text-white transition-colors"
            @click="addNew"
          >add</button>
        </div>

        <!-- Footer: selected count + clear -->
        <div v-if="modelValue.length > 0" class="border-t border-dt-border px-3 py-1.5 flex items-center justify-between">
          <span class="text-[10px] text-dt-dim">{{ modelValue.length }} selected</span>
          <button
            class="text-[10px] text-dt-dim hover:text-dt-danger transition-colors"
            @click="emit('update:modelValue', [])"
          >clear all</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

