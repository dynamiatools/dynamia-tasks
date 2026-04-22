<script setup lang="ts">
const route = useRoute()
const connectorId = route.params.connectorId as string

const configStore = useConfigStore()
const connectors = useConnectorsStore()

const schema = ref<{ fields: any[] } | null>(null)
const form = ref<Record<string, any>>({})
const saved = ref(false)
const saving = ref(false)

const connector = computed(() => connectors.find(connectorId))

// Map connectorId → custom config component (kebab-case, auto-resolved by Nuxt)
const customComponents: Record<string, ReturnType<typeof resolveComponent>> = {
  github: resolveComponent('ConnectorsGithubConfig'),
}
const customComponent = computed(() => customComponents[connectorId] ?? null)

onMounted(async () => {
  await connectors.load()
  // Only load schema when there is no custom component
  if (!customComponent.value) {
    schema.value = await configStore.getSchema(connectorId)
    const current = await configStore.getConnectorConfig(connectorId) as Record<string, any>
    for (const field of (schema.value?.fields ?? [])) {
      const val = current?.[field.key]
      if (field.type === 'multiselect') {
        form.value[field.key] = Array.isArray(val) ? val.join('\n') : (val ?? '')
      } else {
        form.value[field.key] = val ?? ''
      }
    }
  }
})

async function save() {
  saving.value = true
  saved.value = false
  try {
    const payload: Record<string, any> = {}
    for (const field of (schema.value?.fields ?? [])) {
      if (field.type === 'multiselect') {
        payload[field.key] = String(form.value[field.key] ?? '')
          .split('\n').map((s: string) => s.trim()).filter(Boolean)
      } else {
        payload[field.key] = form.value[field.key]
      }
    }
    await configStore.saveConnectorConfig(connectorId, payload)
    await connectors.load()
    saved.value = true
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <!-- Breadcrumb -->
    <p class="text-xs text-zinc-600 mb-4 flex items-center gap-1">
      <NuxtLink to="/settings" class="hover:text-zinc-300 transition-colors">settings</NuxtLink>
      <span class="text-zinc-700">/</span>
      <ConnectorIcon :connector-id="connectorId" class="text-zinc-400" />
      <span class="text-zinc-400 ml-0.5">{{ connectorId }}</span>
    </p>

    <p class="mb-5 text-zinc-300 font-medium flex items-center gap-2">
      <ConnectorIcon :connector-id="connectorId" :size="16" class="text-zinc-300" />
      {{ connector?.name }}
    </p>

    <!-- Custom connector config component -->
    <component :is="customComponent" v-if="customComponent" />

    <!-- Generic fallback form -->
    <template v-else>
      <div v-if="!schema" class="text-zinc-500 animate-pulse">loading…</div>

      <div v-else>
        <div v-if="schema.fields.length === 0" class="text-zinc-500 text-sm">
          no configuration needed.
        </div>

        <form v-else @submit.prevent="save" class="space-y-5">
          <template v-for="field in schema.fields" :key="field.key">
            <div>
              <label class="block text-xs text-zinc-500 mb-1">
                {{ field.label }}{{ field.required ? ' *' : '' }}
              </label>

              <input
                v-if="field.type === 'text' || field.type === 'password'"
                v-model="form[field.key]"
                :type="field.type"
                :placeholder="field.placeholder ?? ''"
                class="w-full bg-transparent border-b border-zinc-700 focus:border-zinc-400 outline-none py-1 text-sm text-zinc-100 placeholder-zinc-600 font-mono transition-colors"
              />

              <textarea
                v-else-if="field.type === 'multiselect'"
                v-model="form[field.key]"
                :placeholder="field.placeholder ?? 'one per line'"
                class="w-full bg-zinc-900 border border-zinc-700 focus:border-zinc-500 outline-none p-2 text-sm text-zinc-100 font-mono min-h-16 resize-y rounded transition-colors"
              />

              <select
                v-else-if="field.type === 'select'"
                v-model="form[field.key]"
                class="bg-zinc-900 border-b border-zinc-700 text-sm text-zinc-200 outline-none py-0.5 cursor-pointer"
              >
                <option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>

              <input
                v-else-if="field.type === 'boolean'"
                type="checkbox"
                v-model="form[field.key]"
                class="mt-1"
              />

              <p v-if="field.helpText" class="text-xs text-zinc-600 mt-1">{{ field.helpText }}</p>
            </div>
          </template>

          <div class="flex gap-4 items-center pt-1">
            <button
              type="submit"
              :disabled="saving"
              class="text-sm text-zinc-200 hover:text-white disabled:opacity-30 transition-colors"
            >{{ saving ? 'saving…' : 'save' }}</button>
            <span v-if="saved" class="text-xs text-emerald-500">saved ✓</span>
          </div>
        </form>
      </div>
    </template>
  </div>
</template>

