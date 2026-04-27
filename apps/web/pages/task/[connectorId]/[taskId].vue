<script setup lang="ts">
import type { ConnectorTask, TaskComment, TaskLabel, TaskView } from '@dynamia-tasks/core'
import { useExplorerStore } from '~/stores/explorer'
import {
  ArrowTopRightOnSquareIcon,
  UserIcon,
  PlusIcon,
  XMarkIcon,
  PencilSquareIcon,
} from '@heroicons/vue/20/solid'

const route = useRoute()
const connectorId = route.params.connectorId as string
const taskId = decodeURIComponent(route.params.taskId as string)
const fromWorkspace = computed(() => route.query.from === 'workspace')

const svc = useTaskService()
const workspace = useWorkspaceStore()
const explorer = useExplorerStore()

const task = ref<TaskView | null>(null)
const comments = ref<TaskComment[]>([])
const subtasks = ref<ConnectorTask[]>([])
const availableLabels = ref<TaskLabel[]>([])
const loading = ref(true)
const refreshing = ref(false)
const error = ref<string | null>(null)
const newComment = ref('')
const postingComment = ref(false)
const editing = ref(false)
const editTitle = ref('')
const editDesc = ref('')
const editLabels = ref<string[]>([])
const lightboxImg = ref<string | null>(null)
const showRemoveDialog = ref(false)
const removingFromWorkspace = ref(false)

// Try to find pre-cached task data from workspace or explorer stores
function findCachedTask(): TaskView | null {
  const fromWs = workspace.items.find(t => t.connectorId === connectorId && t.id === taskId)
  if (fromWs) return fromWs
  const fromEx = explorer.tasks.find(t => t.connectorId === connectorId && t.id === taskId)
  if (fromEx) return fromEx as unknown as TaskView
  return null
}

onMounted(async () => {
  // Pre-populate immediately from store data (synchronous) to avoid blank screen
  const cached = findCachedTask()
  if (cached) {
    task.value = cached
    editTitle.value = cached.title
    editDesc.value = cached.description ?? ''
    editLabels.value = cached.labels?.map(l => l.name) ?? []
    loading.value = false
  }

  // Load workspace and full task data in background
  await workspace.load()
  await loadTask()
})

async function loadTask() {
  // Only show full spinner if we have no pre-cached data
  if (!task.value) {
    loading.value = true
  } else {
    refreshing.value = true
  }
  error.value = null
  try {
    const resolvedTask: TaskView = await svc.getTask(connectorId, taskId)
    task.value = resolvedTask
    editTitle.value = resolvedTask.title
    editDesc.value = resolvedTask.description ?? ''
    editLabels.value = resolvedTask.labels?.map(l => l.name) ?? []

    if (resolvedTask.capabilities?.canComment) {
      comments.value = await svc.fetchComments(connectorId, taskId)
    }

    if (resolvedTask.capabilities?.canSubtasks) {
      subtasks.value = await svc.fetchSubtasks(connectorId, taskId)
    }

    if (resolvedTask.capabilities?.canLabel) {
      try {
        availableLabels.value = await svc.fetchLabels(connectorId, resolvedTask.sourceId)
      } catch { /* labels not critical */ }
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function toggleDone() {
  if (!task.value) return
  const updated = await svc.updateTask(connectorId, taskId, { done: !task.value.done })
  task.value = { ...task.value, ...updated }
}

async function saveEdit() {
  if (!task.value) return
  const updated = await svc.updateTask(connectorId, taskId, {
    title: editTitle.value,
    description: editDesc.value,
    labels: editLabels.value,
  })
  task.value = { ...task.value, ...updated }
  editing.value = false
}

async function submitComment(): Promise<boolean> {
  if (!newComment.value.trim()) return false
  postingComment.value = true
  try {
    const comment = await svc.addComment(connectorId, taskId, newComment.value)
    comments.value.push(comment)
    newComment.value = ''
    return true
  } finally {
    postingComment.value = false
  }
}

async function submitCommentAndFinish() {
  const sent = await submitComment()
  if (!sent) return
  if (!task.value?.done) {
    await toggleDone()
  }
}

const inWorkspace = computed(() =>
  workspace.items.some(t => t.connectorId === connectorId && t.id === taskId)
)

// Source URL (GitHub: https://github.com/owner/repo/issues/number)
const sourceUrl = computed(() => {
  if (!task.value?.meta) return null
  const { owner, repo, number } = task.value.meta as any
  if (owner && repo && number) return `https://github.com/${owner}/${repo}/issues/${number}`
  return null
})

// Description extracted (images + attachments + clean text)
const descExtract = computed(() =>
  task.value?.description ? useMarkdownExtract(task.value.description, connectorId) : null
)

// Detect if description is HTML and prepare rendered version
const descIsHtml = computed(() => !!task.value?.description && isHtml(task.value.description))
const descHtml = computed(() =>
  task.value?.description && descIsHtml.value
    ? processHtmlDescription(task.value.description, connectorId)
    : null
)

// Comment extraction helper
function extractComment(body: string) {
  return useMarkdownExtract(body, connectorId)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

async function confirmRemoveFromWorkspace() {
  if (removingFromWorkspace.value) return
  removingFromWorkspace.value = true
  try {
    await workspace.removeTask(connectorId, taskId)
    showRemoveDialog.value = false
  } finally {
    removingFromWorkspace.value = false
  }
}
</script>

<template>
  <div>
    <AppConfirmDialog
      :open="showRemoveDialog"
      title="Remove task from workspace?"
      :message="task ? `Task: ${task.title}` : ''"
      confirm-text="Remove Task"
      cancel-text="Cancel"
      confirm-variant="danger"
      :loading="removingFromWorkspace"
      @confirm="confirmRemoveFromWorkspace"
      @cancel="showRemoveDialog = false"
    />

    <!-- Breadcrumb: only when coming from explorer -->
    <AppBreadcrumb v-if="!fromWorkspace">
      <NuxtLink to="/explore" class="hover:text-dt-text transition-colors">explore</NuxtLink>
      <NuxtLink :to="`/explore/${connectorId}`" class="flex items-center gap-1 hover:text-dt-text transition-colors">
        <ConnectorIcon :connector-id="connectorId" />
        <span class="ml-0.5">{{ connectorId }}</span>
      </NuxtLink>
      <NuxtLink
        v-if="task?.sourceId"
        :to="`/explore/${connectorId}/${encodeURIComponent(task.sourceId)}`"
        class="font-mono text-dt-muted hover:text-dt-text transition-colors"
      >{{ task.sourceId }}</NuxtLink>
    </AppBreadcrumb>
    <!-- Breadcrumb: workspace origin -->
    <AppBreadcrumb v-else>
      <NuxtLink to="/" class="hover:text-dt-text transition-colors">workspace</NuxtLink>
    </AppBreadcrumb>

    <AppSpinner v-if="loading" />
    <p v-else-if="error" class="text-sm text-dt-danger">{{ error }}</p>

    <div v-else-if="task" class="space-y-5">
      <!-- Floating refresh indicator (top-right, doesn't push content) -->
      <Transition name="fade">
        <div
          v-if="refreshing"
          class="fixed top-[48px] right-4 z-40 flex items-center gap-1.5 px-2 py-1 rounded-md bg-dt-raised border border-dt-border text-xs text-dt-dim shadow-sm opacity-80"
        >
          <AppSpinner size="size-3" label="" />
          <span>updating…</span>
        </div>
      </Transition>

      <!-- ── Title ── -->
      <div v-if="!editing">
        <div class="flex items-start gap-3">
          <button
            @click="toggleDone"
            class="mt-1 shrink-0 transition-colors"
            :class="task.done ? 'text-dt-accent' : 'text-dt-dim'"
          >
            <TaskStatusIcon :done="task.done" size="size-4" />
          </button>
          <div class="flex-1 min-w-0">
            <h1
              class="text-base font-semibold leading-snug transition-colors"
              :class="task.done ? 'text-dt-dim' : 'text-dt-text'"
            >{{ task.title }}</h1>
          </div>
          <button
            v-if="task.capabilities?.canEdit"
            class="mt-1 shrink-0 text-dt-dim hover:text-dt-text transition-colors"
            @click="editing = true"
          >
            <PencilSquareIcon class="size-3.5" />
          </button>
        </div>
      </div>

      <!-- Edit mode -->
      <div v-else class="space-y-3">
        <AppInput v-model="editTitle" class="text-base py-1" />
        <AppTextarea v-model="editDesc" :rows="6" />
        <AppLabelPicker
          v-if="task.capabilities?.canLabel"
          v-model="editLabels"
          :labels="availableLabels"
          :can-create="connectorId === 'local'"
          placeholder="Labels"
        />
        <div class="flex gap-3">
          <AppButton variant="ghost" size="xs" @click="saveEdit">save</AppButton>
          <AppButton variant="link" size="xs" @click="editing = false">cancel</AppButton>
        </div>
      </div>

      <!-- ── Meta ── -->
      <div class="space-y-1.5 pl-3 text-xs border-l-2 border-dt-raised">
        <div v-if="task.labels?.length" class="flex gap-1.5 flex-wrap">
          <LabelBadge v-for="l in task.labels" :key="l.id" :label="l" />
        </div>

        <div class="flex flex-wrap gap-x-4 gap-y-0.5 text-dt-dim">
          <span v-if="task.author" class="flex items-center gap-1">
            <UserIcon class="size-2.5" />
            {{ task.author.login }}
          </span>
          <span v-for="a in task.assignees" :key="a.id" class="flex items-center gap-1 text-dt-muted">
            <UserIcon class="size-2.5" />
            {{ a.login }}
          </span>
          <span v-if="task.priority" :class="task.priority === 'high' ? 'text-dt-danger' : 'text-dt-dim'">
            {{ task.priority }} priority
          </span>
          <span>{{ formatDate(task.createdAt) }}</span>
          <span v-if="task.updatedAt !== task.createdAt">updated {{ formatDate(task.updatedAt) }}</span>
        </div>

        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1 text-dt-dim">
            <ConnectorIcon :connector-id="connectorId" :size="11" />
            {{ task.connectorName }}
          </span>
          <a
            v-if="sourceUrl"
            :href="sourceUrl"
            target="_blank" rel="noopener"
            class="flex items-center gap-1 text-dt-dim hover:text-dt-accent transition-colors"
          >
            <ArrowTopRightOnSquareIcon class="size-2.5" />
            view on GitHub
          </a>
        </div>
      </div>

      <!-- ── Workspace action ── -->
      <div class="flex items-center gap-2">
        <AppButton
          v-if="!inWorkspace"
          size="xs"
          variant="accent-outline"
          @click="workspace.addTask(connectorId, taskId, task ?? undefined)"
        >
          <PlusIcon class="size-3" /> add to workspace
        </AppButton>
        <AppButton
          v-else
          size="xs"
          variant="danger"
          @click="showRemoveDialog = true"
        >
          <XMarkIcon class="size-3" /> remove from workspace
        </AppButton>
      </div>

      <!-- ── Description ── -->
      <div v-if="task.description && !editing" class="space-y-3 pt-1 border-t border-dt-raised">
        <AppSectionLabel>description</AppSectionLabel>

        <!-- HTML description -->
        <div
          v-if="descIsHtml && descHtml"
          class="text-sm leading-relaxed prose-dt text-dt-body"
          v-html="descHtml"
        />

        <template v-else>
          <!-- Images -->
          <div v-if="descExtract?.images.length" class="flex flex-wrap gap-2">
            <div
              v-for="img in descExtract.images" :key="img.originalUrl"
              class="relative rounded overflow-hidden border border-dt-border"
            >
              <img
                :src="img.url" :alt="img.alt"
                class="max-h-32 max-w-full object-cover block cursor-pointer transition-opacity hover:opacity-80"
                @click="lightboxImg = img.url"
              />
              <a :href="img.originalUrl" target="_blank" rel="noopener" class="absolute bottom-1 right-1 dt-img-link">↗</a>
            </div>
          </div>

          <!-- Attachments -->
          <div v-if="descExtract?.attachments.length" class="flex flex-col gap-1">
            <a
              v-for="att in descExtract.attachments" :key="att.url"
              :href="att.url" target="_blank" rel="noopener"
              class="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-dt-raised text-dt-muted border border-dt-border hover:text-dt-text hover:border-dt-muted transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M3 2h6l3 3v7a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.3"/>
                <path d="M9 2v4h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              {{ att.name }}
              <ArrowTopRightOnSquareIcon class="size-2.5 ml-auto" />
            </a>
          </div>

          <!-- Text body -->
          <div class="text-sm leading-relaxed whitespace-pre-wrap text-dt-body">
            {{ descExtract?.cleaned || task.description }}
          </div>
        </template>
      </div>

      <!-- ── Subtasks ── -->
      <div v-if="task.capabilities?.canSubtasks && subtasks.length > 0" class="space-y-2 pt-1 border-t border-dt-raised">
        <AppSectionLabel>
          subtasks
          <span class="ml-1 font-mono">{{ subtasks.filter(s => s.done).length }}/{{ subtasks.length }}</span>
        </AppSectionLabel>
        <ul class="space-y-1.5">
          <li v-for="sub in subtasks" :key="sub.id" class="flex items-center gap-2.5">
            <span :class="sub.done ? 'text-dt-accent' : 'text-dt-dim'">
              <TaskStatusIcon :done="sub.done" size="size-3.5" />
            </span>
            <span class="text-sm" :class="sub.done ? 'text-dt-dim' : 'text-dt-text'">{{ sub.title }}</span>
          </li>
        </ul>
      </div>

      <!-- ── Comments ── -->
      <div v-if="task.capabilities?.canComment" class="space-y-4 pt-1 border-t border-dt-raised">
        <AppSectionLabel>
          comments
          <span v-if="comments.length" class="ml-1 font-mono">{{ comments.length }}</span>
        </AppSectionLabel>

        <ul class="space-y-5">
          <li v-for="c in comments" :key="c.id" class="space-y-2">
            <div class="flex items-center gap-2">
              <div class="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 bg-dt-raised text-dt-muted border border-dt-border">
                {{ c.author.login.charAt(0).toUpperCase() }}
              </div>
              <span class="text-xs font-medium text-dt-text">{{ c.author.login }}</span>
              <span class="text-dt-border">·</span>
              <span class="text-xs text-dt-dim">{{ formatDate(c.createdAt) }}</span>
            </div>

            <div v-if="extractComment(c.body).images.length" class="flex flex-wrap gap-2 pl-7">
              <div
                v-for="img in extractComment(c.body).images" :key="img.originalUrl"
                class="relative rounded overflow-hidden border border-dt-border"
              >
                <img :src="img.url" :alt="img.alt" class="max-h-28 max-w-full object-cover block cursor-pointer transition-opacity hover:opacity-80" @click="lightboxImg = img.url" />
                <a :href="img.originalUrl" target="_blank" rel="noopener" class="absolute bottom-1 right-1 dt-img-link">↗</a>
              </div>
            </div>

            <p v-if="extractComment(c.body).cleaned" class="text-sm leading-relaxed whitespace-pre-wrap pl-7 text-dt-body">
              {{ extractComment(c.body).cleaned }}
            </p>
          </li>
        </ul>

        <!-- New comment -->
        <div class="space-y-2 pt-1 border-t border-dt-raised">
          <AppTextarea
            v-model="newComment"
            placeholder="add a comment…"
            :rows="3"
            @keydown.ctrl.enter.prevent="submitComment"
            @keydown.meta.enter.prevent="submitComment"
          />
          <div class="flex justify-end gap-2">
            <AppButton
              v-if="!task.done"
              size="xs"
              variant="accent"
              :loading="postingComment"
              :disabled="!newComment.trim()"
              @click="submitCommentAndFinish"
            >Comment &amp; Close</AppButton>
            <AppButton
              size="xs"
              variant="accent-outline"
              :loading="postingComment"
              :disabled="!newComment.trim()"
              @click="submitComment"
            >Comment</AppButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Lightbox -->
    <Teleport to="body">
      <div
        v-if="lightboxImg"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85"
        @click="lightboxImg = null"
      >
        <img :src="lightboxImg" alt="Task attachment preview" class="max-w-full max-h-full rounded object-contain" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
