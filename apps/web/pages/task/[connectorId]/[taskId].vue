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
    <p class="text-xs text-gray-400 mb-4">
      <NuxtLink to="/" class="hover:underline">workspace</NuxtLink> /
      {{ connectorId }}
    </p>

    <div v-if="loading">loading...</div>
    <div v-else-if="error" class="text-red-600">{{ error }}</div>

    <div v-else-if="task">
      <!-- Title -->
      <div v-if="!editing">
        <div class="flex items-start gap-2">
          <button @click="toggleDone" class="mt-0.5 shrink-0">
            <span v-if="task.done" class="text-gray-400">[x]</span>
            <span v-else>[ ]</span>
          </button>
          <h1 class="text-base font-semibold leading-snug" :class="task.done ? 'line-through text-gray-400' : ''">
            {{ task.title }}
          </h1>
          <button v-if="task.capabilities?.canEdit" @click="editing = true" class="text-xs text-gray-400 hover:text-black ml-1">edit</button>
        </div>
      </div>

      <!-- Edit mode -->
      <div v-else class="space-y-2">
        <input v-model="editTitle" class="w-full border-b border-black outline-none font-mono text-base" />
        <textarea v-model="editDesc" class="w-full border border-gray-300 outline-none font-mono text-sm p-1 min-h-20 resize-y" />
        <div class="flex gap-2">
          <button @click="saveEdit" class="text-sm hover:underline">save</button>
          <button @click="editing = false" class="text-sm text-gray-400 hover:underline">cancel</button>
        </div>
      </div>

      <!-- Meta -->
      <div class="mt-3 text-xs text-gray-400 space-y-0.5">
        <p v-if="task.labels?.length">labels: {{ task.labels.map((l: any) => l.name).join(', ') }}</p>
        <p v-if="task.priority">priority: {{ task.priority }}</p>
        <p v-if="task.assignees?.length">assignees: {{ task.assignees.map((a: any) => a.login).join(', ') }}</p>
        <p v-if="task.author">by: {{ task.author.login }}</p>
        <p>{{ task.connectorIcon }} {{ task.connectorName }}</p>
      </div>

      <!-- Description -->
      <div v-if="task.description && !editing" class="mt-4 text-sm whitespace-pre-wrap text-gray-700">
        {{ task.description }}
      </div>

      <!-- Workspace action -->
      <div class="mt-4">
        <button v-if="!inWorkspace" @click="workspace.addTask(connectorId, taskId)" class="text-xs hover:underline text-gray-500">
          + add to workspace
        </button>
        <button v-else @click="workspace.removeTask(connectorId, taskId)" class="text-xs hover:underline text-gray-400">
          × remove from workspace
        </button>
      </div>

      <!-- Subtasks -->
      <div v-if="task.capabilities?.canSubtasks && subtasks.length > 0" class="mt-6">
        <p class="text-xs text-gray-400 mb-1">subtasks</p>
        <ul>
          <li v-for="sub in subtasks" :key="sub.id" class="flex gap-2 py-0.5 text-sm">
            <span class="text-gray-300">{{ sub.done ? '[x]' : '[ ]' }}</span>
            <span :class="sub.done ? 'line-through text-gray-400' : ''">{{ sub.title }}</span>
          </li>
        </ul>
      </div>

      <!-- Comments -->
      <div v-if="task.capabilities?.canComment" class="mt-6">
        <p class="text-xs text-gray-400 mb-2">comments</p>
        <ul class="space-y-3 mb-4">
          <li v-for="c in comments" :key="c.id" class="text-sm">
            <span class="text-gray-500">{{ c.author.login }}</span>
            <span class="text-gray-300 mx-1">·</span>
            <span class="text-gray-400 text-xs">{{ new Date(c.createdAt).toLocaleDateString() }}</span>
            <p class="mt-0.5 whitespace-pre-wrap text-gray-700">{{ c.body }}</p>
          </li>
        </ul>
        <div class="flex gap-2">
          <input
            v-model="newComment"
            placeholder="add comment..."
            class="flex-1 border-b border-gray-300 focus:border-black outline-none py-0.5 text-sm font-mono"
            @keydown.enter.prevent="submitComment"
          />
          <button @click="submitComment" :disabled="postingComment" class="text-xs hover:underline text-gray-500">send</button>
        </div>
      </div>
    </div>
  </div>
</template>

