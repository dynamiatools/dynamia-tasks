<script setup lang="ts">
const route = useRoute()
const connectorId = route.params.connectorId as string

const configStore = useConfigStore()
const connectors = useConnectorsStore()

const schema = ref<{ fields: any[] } | null>(null)
const form = ref<Record<string, any>>({})
const saved = ref(false)
const saving = ref(false)

onMounted(async () => {
  await connectors.load()
  schema.value = await configStore.getSchema(connectorId)
  const current = await configStore.getConnectorConfig(connectorId) as Record<string, any>
  // Pre-populate form
  for (const field of (schema.value?.fields ?? [])) {
    form.value[field.key] = current?.[field.key] ?? ''
  }
})

const connector = computed(() => connectors.find(connectorId))

async function save() {
  saving.value = true
  saved.value = false
  try {
    await configStore.saveConnectorConfig(connectorId, form.value)
    await connectors.load()
    saved.value = true
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <p class="text-xs text-gray-400 mb-4">
      <NuxtLink to="/settings" class="hover:underline">settings</NuxtLink>
      / {{ connectorId }}
    </p>

    <div v-if="!schema">loading...</div>

    <div v-else>
      <p class="mb-4 text-sm">{{ connector?.icon }} {{ connector?.name }}</p>

      <div v-if="schema.fields.length === 0" class="text-gray-500 text-sm">
        no configuration needed.
      </div>

      <form v-else @submit.prevent="save" class="space-y-4">
        <div v-for="field in schema.fields" :key="field.key">
          <label class="block text-xs text-gray-500 mb-0.5">{{ field.label }}{{ field.required ? ' *' : '' }}</label>

          <input
            v-if="field.type === 'text' || field.type === 'password'"
            v-model="form[field.key]"
            :type="field.type"
            :placeholder="field.placeholder ?? ''"
            class="w-full border-b border-gray-300 focus:border-black outline-none py-0.5 text-sm font-mono"
          />

          <textarea
            v-else-if="field.type === 'multiselect'"
            v-model="form[field.key]"
            :placeholder="field.placeholder ?? 'one per line'"
            class="w-full border border-gray-300 focus:border-black outline-none p-1 text-sm font-mono min-h-16 resize-y"
          />

          <select
            v-else-if="field.type === 'select'"
            v-model="form[field.key]"
            class="border-b border-gray-300 text-sm font-mono bg-transparent outline-none"
          >
            <option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>

          <input
            v-else-if="field.type === 'boolean'"
            type="checkbox"
            v-model="form[field.key]"
            class="mt-1"
          />

          <p v-if="field.helpText" class="text-xs text-gray-400 mt-0.5">{{ field.helpText }}</p>
        </div>

        <div class="flex gap-3 items-center pt-2">
          <button type="submit" :disabled="saving" class="text-sm hover:underline">
            {{ saving ? 'saving...' : 'save' }}
          </button>
          <span v-if="saved" class="text-xs text-gray-400">saved.</span>
        </div>
      </form>
    </div>
  </div>
</template>

