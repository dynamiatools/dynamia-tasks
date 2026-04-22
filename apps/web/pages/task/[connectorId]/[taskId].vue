<script setup lang="ts">
import type { TaskView } from '@dynamia-tasks/core'

const route = useRoute()
const connectorId = route.params.connectorId as string
const taskId = decodeURIComponent(route.params.taskId as string)

const api = useApi()
const workspace = useWorkspaceStore()

const task = ref<TaskView | null>(null)
const comments = ref<any[]>([])
const subtasks = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const newComment = ref('')
const postingComment = ref(false)
const editing = ref(false)
const editTitle = ref('')
const editDesc = ref('')

onMounted(async () => {
  await workspace.load()
  await loadTask()
})

async function loadTask() {
  loading.value = true
  error.value = null
  try {
    const res = await api.get<{ task: TaskView }>(`/api/connectors/${connectorId}/tasks/${encodeURIComponent(taskId)}`)
    task.value = res.task
    editTitle.value = res.task.title
    editDesc.value = res.task.description ?? ''
    if (res.task.capabilities?.canComment) {
      const cr = await api.get<{ comments: any[] }>(`/api/connectors/${connectorId}/tasks/${encodeURIComponent(taskId)}/comments`)
      comments.value = cr.comments
    }
    if (res.task.capabilities?.canSubtasks) {
      const sr = await api.get<{ subtasks: any[] }>(`/api/connectors/${connectorId}/tasks/${encodeURIComponent(taskId)}/subtasks`)
      subtasks.value = sr.subtasks
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function toggleDone() {
  if (!task.value) return
  const res = await api.patch<{ task: TaskView }>(
    `/api/connectors/${connectorId}/tasks/${encodeURIComponent(taskId)}`,
    { done: !task.value.done }
  )
  task.value = { ...task.value, ...res.task }
}

async function saveEdit() {
  if (!task.value) return
  const res = await api.patch<{ task: TaskView }>(
    `/api/connectors/${connectorId}/tasks/${encodeURIComponent(taskId)}`,
    { title: editTitle.value, description: editDesc.value }
  )
  task.value = { ...task.value, ...res.task }
  editing.value = false
}

async function submitComment() {
  if (!newComment.value.trim()) return
  postingComment.value = true
  try {
    const res = await api.post<{ comment: any }>(
      `/api/connectors/${connectorId}/tasks/${encodeURIComponent(taskId)}/comments`,
      { body: newComment.value }
    )
    comments.value.push(res.comment)
    newComment.value = ''
  } finally {
    postingComment.value = false
  }
}

const inWorkspace = computed(() =>
  workspace.items.some(t => t.connectorId === connectorId && t.id === taskId)
)
</script>

<template>
  <div>
    <!-- Breadcrumb -->
    <p class="text-xs text-zinc-600 mb-4 flex items-center gap-1">
      <NuxtLink to="/" class="hover:text-zinc-300 transition-colors">workspace</NuxtLink>
      <span class="text-zinc-700">/</span>
      <ConnectorIcon :connector-id="connectorId" class="text-zinc-500" />
      <span class="ml-0.5">{{ connectorId }}</span>
    </p>

    <div v-if="loading" class="text-zinc-500 animate-pulse">loading…</div>
    <div v-else-if="error" class="text-red-400">{{ error }}</div>

    <div v-else-if="task" class="space-y-5">
      <!-- Title -->
      <div v-if="!editing">
        <div class="flex items-start gap-3">
          <button
            @click="toggleDone"
            class="mt-1 shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <svg v-if="task.done" width="16" height="16" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.15"/>
              <path d="M4.5 7l2 2 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </button>
          <div class="flex-1 min-w-0">
            <h1
              class="text-base font-semibold leading-snug transition-colors"
              :class="task.done ? 'text-zinc-600' : 'text-zinc-100'"
            >{{ task.title }}</h1>
          </div>
          <button
            v-if="task.capabilities?.canEdit"
            @click="editing = true"
            class="text-xs text-zinc-600 hover:text-zinc-300 transition-colors mt-1 shrink-0"
          >edit</button>
        </div>
      </div>

      <!-- Edit mode -->
      <div v-else class="space-y-3">
        <input
          v-model="editTitle"
          class="w-full bg-transparent border-b border-zinc-600 focus:border-zinc-400 outline-none text-base text-zinc-100 py-1 transition-colors"
        />
        <textarea
          v-model="editDesc"
          class="w-full bg-zinc-900 border border-zinc-700 focus:border-zinc-500 outline-none text-sm text-zinc-200 p-2 min-h-24 resize-y rounded transition-colors"
        />
        <div class="flex gap-3">
          <button @click="saveEdit" class="text-sm text-zinc-200 hover:text-white transition-colors">save</button>
          <button @click="editing = false" class="text-sm text-zinc-600 hover:text-zinc-300 transition-colors">cancel</button>
        </div>
      </div>

      <!-- Meta -->
      <div class="text-xs text-zinc-600 space-y-0.5 border-l border-zinc-800 pl-3">
        <div v-if="task.labels?.length" class="flex items-center gap-1.5 flex-wrap">
          <LabelBadge v-for="l in task.labels" :key="l.id" :label="l" />
        </div>
        <p v-if="task.priority">
          <span class="text-zinc-700">priority</span>
          <span class="ml-1.5" :class="task.priority === 'high' ? 'text-red-400' : 'text-zinc-500'">{{ task.priority }}</span>
        </p>
        <p v-if="task.assignees?.length">
          <span class="text-zinc-700">assignees</span>
          <span class="ml-1.5 text-zinc-500">{{ task.assignees.map((a: any) => a.login).join(', ') }}</span>
        </p>
        <p v-if="task.author">
          <span class="text-zinc-700">author</span>
          <span class="ml-1.5 text-zinc-500">{{ task.author.login }}</span>
        </p>
        <p class="flex items-center gap-1">
          <ConnectorIcon :connector-id="connectorId" class="text-zinc-700" :size="11" />
          <span class="text-zinc-700">{{ task.connectorName }}</span>
        </p>
      </div>

      <!-- Description -->
      <div
        v-if="task.description && !editing"
        class="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap border-t border-zinc-800/60 pt-4"
      >{{ task.description }}</div>

      <!-- Workspace action -->
      <div class="pt-1">
        <button
          v-if="!inWorkspace"
          @click="workspace.addTask(connectorId, taskId)"
          class="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
        >+ add to workspace</button>
        <button
          v-else
          @click="workspace.removeTask(connectorId, taskId)"
          class="text-xs text-zinc-600 hover:text-red-400 transition-colors"
        >× remove from workspace</button>
      </div>

      <!-- Subtasks -->
      <div v-if="task.capabilities?.canSubtasks && subtasks.length > 0" class="border-t border-zinc-800/60 pt-4">
        <p class="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">subtasks</p>
        <ul class="space-y-1.5">
          <li v-for="sub in subtasks" :key="sub.id" class="flex items-center gap-2.5">
            <span class="text-zinc-600">
              <svg v-if="sub.done" width="13" height="13" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.15"/>
                <path d="M4.5 7l2 2 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg v-else width="13" height="13" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
              </svg>
            </span>
            <span
              class="text-sm"
              :class="sub.done ? 'text-zinc-600' : 'text-zinc-300'"
            >{{ sub.title }}</span>
          </li>
        </ul>
      </div>

      <!-- Comments -->
      <div v-if="task.capabilities?.canComment" class="border-t border-zinc-800/60 pt-4">
        <p class="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">comments</p>
        <ul class="space-y-4 mb-4">
          <li v-for="c in comments" :key="c.id">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs text-zinc-400 font-medium">{{ c.author.login }}</span>
              <span class="text-zinc-700 text-xs">·</span>
              <span class="text-zinc-600 text-xs">{{ new Date(c.createdAt).toLocaleDateString() }}</span>
            </div>
            <p class="text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed">{{ c.body }}</p>
          </li>
        </ul>
        <div class="flex gap-3 items-center">
          <input
            v-model="newComment"
            placeholder="add a comment…"
            class="flex-1 bg-transparent border-b border-zinc-700 focus:border-zinc-400 outline-none py-1 text-sm text-zinc-100 placeholder-zinc-600 transition-colors"
            @keydown.enter.prevent="submitComment"
          />
          <button
            @click="submitComment"
            :disabled="postingComment"
            class="text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-30 transition-colors shrink-0"
          >send</button>
        </div>
      </div>
    </div>
  </div>
</template>

