<script setup lang="ts">
import GithubConfig from '~/components/connectors/GithubConfig.vue'

const route = useRoute()
const connectorId = route.params.connectorId as string

const configStore = useConfigStore()
const connectors = useConnectorsStore()

const schema = ref<{ fields: any[] } | null>(null)
const form = ref<Record<string, any>>({})
const saved = ref(false)
const saving = ref(false)

const connector = computed(() => connectors.find(connectorId))

const customComponents = {
  github: GithubConfig,
}
const customComponent = computed(() => customComponents[connectorId as keyof typeof customComponents] ?? null)

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
  <div class="space-y-4">
    <!-- Breadcrumb -->
    <AppBreadcrumb>
      <NuxtLink to="/settings" class="hover:text-dt-text transition-colors">Settings</NuxtLink>
      <span class="flex items-center gap-1">
        <ConnectorIcon :connector-id="connectorId" class="text-dt-muted" />
        <span class="text-dt-muted ml-0.5">{{ connectorId }}</span>
      </span>
    </AppBreadcrumb>

    <section class="rounded-lg border border-dt-border bg-dt-surface p-4">
      <header class="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-dt-border">
        <p class="text-dt-text font-medium flex items-center gap-2 min-w-0">
          <ConnectorIcon :connector-id="connectorId" :size="16" class="text-dt-text shrink-0" />
          <span class="truncate">{{ connector?.name ?? connectorId }}</span>
        </p>
        <span class="text-[11px] px-2 py-1 rounded border" :class="connector?.configured ? 'text-dt-accent border-dt-accent/40 bg-dt-accent-deep/30' : 'text-dt-warning border-dt-warning/40 bg-dt-warning/10'">
          {{ connector?.configured ? 'Configured' : 'Not configured' }}
        </span>
      </header>

      <!-- Custom connector config -->
      <component :is="customComponent" v-if="customComponent" />

      <!-- Generic fallback form -->
      <template v-else>
        <AppSpinner v-if="!schema" />

        <div v-else>
          <p v-if="schema.fields.length === 0" class="text-dt-muted text-sm">No configuration needed.</p>

          <form v-else @submit.prevent="save" class="space-y-5">
            <template v-for="field in schema.fields" :key="field.key">
              <div>
                <label class="block text-xs text-dt-muted mb-1">
                  {{ field.label }}{{ field.required ? ' *' : '' }}
                </label>

                <AppInput
                  v-if="field.type === 'text' || field.type === 'password'"
                  v-model="form[field.key]"
                  :type="field.type"
                  :placeholder="field.placeholder ?? ''"
                  mono
                />

                <AppTextarea
                  v-else-if="field.type === 'multiselect'"
                  v-model="form[field.key]"
                  :placeholder="field.placeholder ?? 'one per line'"
                  mono
                  :rows="4"
                />

                <select
                  v-else-if="field.type === 'select'"
                  v-model="form[field.key]"
                  class="bg-dt-raised border-b border-dt-border text-sm text-dt-text outline-none py-0.5 cursor-pointer focus:border-dt-accent transition-colors"
                >
                  <option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>

                <input
                  v-else-if="field.type === 'boolean'"
                  type="checkbox"
                  v-model="form[field.key]"
                  class="mt-1"
                />

                <p v-if="field.helpText" class="text-xs text-dt-dim mt-1">{{ field.helpText }}</p>
              </div>
            </template>

            <div class="flex gap-4 items-center pt-1">
              <AppButton type="submit" :loading="saving" variant="ghost">
                {{ saving ? 'saving…' : 'save' }}
              </AppButton>
              <span v-if="saved" class="text-xs text-dt-accent">saved ✓</span>
            </div>
          </form>
        </div>
      </template>
    </section>
  </div>
</template>

