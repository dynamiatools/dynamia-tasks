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
const lightboxImg = ref<string | null>(null)

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
</script>

<template>
  <div>
    <!-- Breadcrumb -->
    <p class="text-xs mb-4 flex items-center gap-1 flex-wrap" style="color: #6a6a6a;">
      <NuxtLink to="/explore" class="transition-colors" style="color: #6a6a6a;"
        onmouseover="this.style.color='#d4d4d4'" onmouseout="this.style.color='#6a6a6a'">explore</NuxtLink>
      <span style="color: #3e3e42;">/</span>
      <NuxtLink :to="`/explore/${connectorId}`" class="flex items-center gap-1 transition-colors" style="color: #6a6a6a;"
        onmouseover="this.style.color='#d4d4d4'" onmouseout="this.style.color='#6a6a6a'">
        <ConnectorIcon :connector-id="connectorId" style="color: #6a6a6a;" />
        <span class="ml-0.5">{{ connectorId }}</span>
      </NuxtLink>
      <template v-if="task?.sourceId">
        <span style="color: #3e3e42;">/</span>
        <NuxtLink
          :to="`/explore/${connectorId}/${encodeURIComponent(task.sourceId)}`"
          class="transition-colors font-mono"
          style="color: #858585;"
          onmouseover="this.style.color='#d4d4d4'" onmouseout="this.style.color='#858585'"
        >{{ task.sourceId }}</NuxtLink>
      </template>
    </p>

    <div v-if="loading" class="flex items-center gap-2 text-sm" style="color: #858585;">
      <svg class="animate-spin" width="13" height="13" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="8 6"/>
      </svg>
      loading…
    </div>
    <div v-else-if="error" class="text-sm" style="color: #f87171;">{{ error }}</div>

    <div v-else-if="task" class="space-y-5">

      <!-- ── Title ── -->
      <div v-if="!editing">
        <div class="flex items-start gap-3">
          <button @click="toggleDone" class="mt-1 shrink-0 transition-colors"
            :style="task.done ? 'color:#4d9375' : 'color:#6a6a6a'">
            <svg v-if="task.done" width="16" height="16" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.15"/>
              <path d="M4.5 7l2 2 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </button>
          <div class="flex-1 min-w-0">
            <h1 class="text-base font-semibold leading-snug transition-colors"
              :style="task.done ? 'color:#6a6a6a' : 'color:#d4d4d4'">
              {{ task.title }}
            </h1>
          </div>
          <button v-if="task.capabilities?.canEdit" @click="editing = true"
            class="text-xs mt-1 shrink-0 transition-colors" style="color:#6a6a6a;"
            onmouseover="this.style.color='#d4d4d4'" onmouseout="this.style.color='#6a6a6a'">edit</button>
        </div>
      </div>

      <!-- Edit mode -->
      <div v-else class="space-y-3">
        <input v-model="editTitle"
          class="w-full bg-transparent outline-none text-base py-1 transition-colors"
          style="border-bottom: 1px solid #3e3e42; color: #d4d4d4;"
          @focus="(e:any) => e.target.style.borderColor='#4d9375'"
          @blur="(e:any) => e.target.style.borderColor='#3e3e42'"
        />
        <textarea v-model="editDesc"
          class="w-full outline-none text-sm p-2 min-h-24 resize-y rounded"
          style="background:#2d2d30; border: 1px solid #3e3e42; color: #d4d4d4;"
        />
        <div class="flex gap-3">
          <button @click="saveEdit" class="text-sm transition-colors" style="color:#d4d4d4;"
            onmouseover="this.style.color='#ffffff'" onmouseout="this.style.color='#d4d4d4'">save</button>
          <button @click="editing = false" class="text-sm transition-colors" style="color:#6a6a6a;"
            onmouseover="this.style.color='#858585'" onmouseout="this.style.color='#6a6a6a'">cancel</button>
        </div>
      </div>

      <!-- ── Meta ── -->
      <div class="space-y-1.5 pl-3 text-xs" style="border-left: 2px solid #2d2d30;">
        <!-- Labels -->
        <div v-if="task.labels?.length" class="flex gap-1.5 flex-wrap">
          <LabelBadge v-for="l in task.labels" :key="l.id" :label="l" />
        </div>

        <!-- People + dates row -->
        <div class="flex flex-wrap gap-x-4 gap-y-0.5" style="color: #6a6a6a;">
          <span v-if="task.author" class="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="4" r="2.5" stroke="currentColor" stroke-width="1.3"/>
              <path d="M1.5 10.5c0-2.21 2.015-4 4.5-4s4.5 1.79 4.5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            {{ task.author.login }}
          </span>
          <span v-for="a in task.assignees" :key="a.id" class="flex items-center gap-1" style="color:#858585;">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="4" r="2.5" stroke="currentColor" stroke-width="1.3"/>
              <path d="M1.5 10.5c0-2.21 2.015-4 4.5-4s4.5 1.79 4.5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            {{ a.login }}
          </span>
          <span v-if="task.priority" :style="task.priority === 'high' ? 'color:#f87171' : 'color:#6a6a6a'">
            {{ task.priority }} priority
          </span>
          <span>{{ formatDate(task.createdAt) }}</span>
          <span v-if="task.updatedAt !== task.createdAt">updated {{ formatDate(task.updatedAt) }}</span>
        </div>

        <!-- Source link + connector -->
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1" style="color:#6a6a6a;">
            <ConnectorIcon :connector-id="connectorId" :size="11" style="color:#6a6a6a;" />
            {{ task.connectorName }}
          </span>
          <a v-if="sourceUrl" :href="sourceUrl" target="_blank" rel="noopener"
            class="flex items-center gap-1 transition-colors"
            style="color:#6a6a6a;"
            onmouseover="this.style.color='#4d9375'" onmouseout="this.style.color='#6a6a6a'"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7M8 1h3m0 0v3m0-3L5 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            view on GitHub
          </a>
        </div>
      </div>

      <!-- ── Workspace action ── -->
      <div class="flex items-center gap-2">
        <button v-if="!inWorkspace"
          @click="workspace.addTask(connectorId, taskId, task ?? undefined)"
          class="text-xs px-2.5 py-1 rounded transition-colors flex items-center gap-1.5"
          style="background:#2d2d30; color:#4d9375; border: 1px solid #3e3e42;"
          onmouseover="this.style.borderColor='#4d9375'; this.style.background='#1a2e24'"
          onmouseout="this.style.borderColor='#3e3e42'; this.style.background='#2d2d30'"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          add to workspace
        </button>
        <button v-else
          @click="workspace.removeTask(connectorId, taskId)"
          class="text-xs px-2.5 py-1 rounded transition-colors flex items-center gap-1.5"
          style="background:#2d2d30; color:#858585; border: 1px solid #3e3e42;"
          onmouseover="this.style.borderColor='#f87171'; this.style.color='#f87171'"
          onmouseout="this.style.borderColor='#3e3e42'; this.style.color='#858585'"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          remove from workspace
        </button>
      </div>

      <!-- ── Description ── -->
      <div v-if="task.description && !editing" class="space-y-3 pt-1" style="border-top: 1px solid #2d2d30;">
        <p class="text-[10px] uppercase tracking-widest" style="color:#6a6a6a;">description</p>

        <!-- HTML description (renders HTML, images with external link) -->
        <div v-if="descIsHtml && descHtml"
          class="text-sm leading-relaxed dt-html-body"
          style="color:#a0a0a0;"
          v-html="descHtml"
        />

        <!-- Markdown description -->
        <template v-else>
          <!-- Images extracted from markdown -->
          <div v-if="descExtract?.images.length" class="flex flex-wrap gap-2">
            <div
              v-for="img in descExtract.images" :key="img.originalUrl"
              class="relative rounded overflow-hidden"
              style="border: 1px solid #3e3e42;"
            >
              <img :src="img.url" :alt="img.alt" class="max-h-32 max-w-full object-cover block cursor-pointer transition-opacity hover:opacity-80"
                @click="lightboxImg = img.url" />
              <a :href="img.originalUrl" target="_blank" rel="noopener"
                class="absolute bottom-1 right-1 dt-img-link"
                title="Abrir imagen"
                style="background:rgba(0,0,0,0.65);border-radius:3px;padding:2px 5px;font-size:10px;color:#d4d4d4;text-decoration:none;line-height:1.4;"
              >↗</a>
            </div>
          </div>

          <!-- File attachments -->
          <div v-if="descExtract?.attachments.length" class="flex flex-col gap-1">
            <a v-for="att in descExtract.attachments" :key="att.url"
              :href="att.url" target="_blank" rel="noopener"
              class="flex items-center gap-2 text-xs px-2 py-1.5 rounded transition-colors"
              style="background:#2d2d30; color:#858585; border: 1px solid #3e3e42;"
              onmouseover="this.style.color='#d4d4d4'; this.style.borderColor='#6a6a6a'"
              onmouseout="this.style.color='#858585'; this.style.borderColor='#3e3e42'"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M3 2h6l3 3v7a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.3"/>
                <path d="M9 2v4h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              {{ att.name }}
              <svg class="ml-auto" width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7M8 1h3m0 0v3m0-3L5 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
            </a>
          </div>

          <!-- Text body -->
          <div class="text-sm leading-relaxed whitespace-pre-wrap" style="color:#a0a0a0;">
            {{ descExtract?.cleaned || task.description }}
          </div>
        </template>
      </div>

      <!-- ── Subtasks ── -->
      <div v-if="task.capabilities?.canSubtasks && subtasks.length > 0" class="space-y-2 pt-1" style="border-top: 1px solid #2d2d30;">
        <p class="text-[10px] uppercase tracking-widest" style="color:#6a6a6a;">
          subtasks
          <span class="ml-1 font-mono">{{ subtasks.filter(s => s.done).length }}/{{ subtasks.length }}</span>
        </p>
        <ul class="space-y-1.5">
          <li v-for="sub in subtasks" :key="sub.id" class="flex items-center gap-2.5">
            <span :style="sub.done ? 'color:#4d9375' : 'color:#6a6a6a'">
              <svg v-if="sub.done" width="13" height="13" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.15"/>
                <path d="M4.5 7l2 2 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg v-else width="13" height="13" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
              </svg>
            </span>
            <span class="text-sm" :style="sub.done ? 'color:#6a6a6a' : 'color:#d4d4d4'">{{ sub.title }}</span>
          </li>
        </ul>
      </div>

      <!-- ── Comments ── -->
      <div v-if="task.capabilities?.canComment" class="space-y-4 pt-1" style="border-top: 1px solid #2d2d30;">
        <p class="text-[10px] uppercase tracking-widest" style="color:#6a6a6a;">
          comments
          <span v-if="comments.length" class="ml-1 font-mono">{{ comments.length }}</span>
        </p>

        <ul class="space-y-5">
          <li v-for="c in comments" :key="c.id" class="space-y-2">
            <!-- Comment header -->
            <div class="flex items-center gap-2">
              <!-- Avatar initials -->
              <div class="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                style="background:#2d2d30; color:#858585; border: 1px solid #3e3e42;">
                {{ c.author.login.charAt(0).toUpperCase() }}
              </div>
              <span class="text-xs font-medium" style="color:#d4d4d4;">{{ c.author.login }}</span>
              <span style="color:#3e3e42;">·</span>
              <span class="text-xs" style="color:#6a6a6a;">{{ formatDate(c.createdAt) }}</span>
            </div>

            <!-- Comment images -->
            <div v-if="extractComment(c.body).images.length" class="flex flex-wrap gap-2 pl-7">
              <div
                v-for="img in extractComment(c.body).images" :key="img.originalUrl"
                class="relative rounded overflow-hidden"
                style="border: 1px solid #3e3e42;"
              >
                <img :src="img.url" :alt="img.alt" class="max-h-28 max-w-full object-cover block cursor-pointer transition-opacity hover:opacity-80"
                  @click="lightboxImg = img.url" />
                <a :href="img.originalUrl" target="_blank" rel="noopener"
                  class="absolute bottom-1 right-1 dt-img-link"
                  title="Abrir imagen"
                  style="background:rgba(0,0,0,0.65);border-radius:3px;padding:2px 5px;font-size:10px;color:#d4d4d4;text-decoration:none;line-height:1.4;"
                >↗</a>
              </div>
            </div>

            <!-- Comment text -->
            <p v-if="extractComment(c.body).cleaned"
              class="text-sm leading-relaxed whitespace-pre-wrap pl-7"
              style="color:#a0a0a0;">
              {{ extractComment(c.body).cleaned }}
            </p>
          </li>
        </ul>

        <!-- New comment input -->
        <div class="flex gap-3 items-center pt-1" style="border-top: 1px solid #2d2d30;">
          <input
            v-model="newComment"
            placeholder="add a comment…"
            class="flex-1 bg-transparent outline-none py-1 text-sm transition-colors"
            style="border-bottom: 1px solid #3e3e42; color: #d4d4d4;"
            @focus="(e:any) => e.target.style.borderColor='#4d9375'"
            @blur="(e:any) => e.target.style.borderColor='#3e3e42'"
            @keydown.enter.prevent="submitComment"
          />
          <button @click="submitComment" :disabled="postingComment || !newComment.trim()"
            class="text-xs transition-colors disabled:opacity-30 shrink-0 px-2 py-0.5 rounded"
            style="background:#2d2d30; color:#4d9375; border: 1px solid #3e3e42;"
            onmouseover="this.style.borderColor='#4d9375'" onmouseout="this.style.borderColor='#3e3e42'"
          >send</button>
        </div>
      </div>

    </div>

    <!-- Lightbox -->
    <Teleport to="body">
      <div v-if="lightboxImg"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        style="background: rgba(0,0,0,0.85);"
        @click="lightboxImg = null"
      >
        <img :src="lightboxImg" class="max-w-full max-h-full rounded object-contain" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* HTML description styles */
:deep(.dt-html-body) img {
  max-width: 100%;
  max-height: 400px;
  border-radius: 4px;
  border: 1px solid #3e3e42;
  display: inline-block;
  vertical-align: middle;
}
:deep(.dt-html-body) a {
  color: #4d9375;
  text-decoration: underline;
}
:deep(.dt-html-body) table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.8rem;
}
:deep(.dt-html-body) th,
:deep(.dt-html-body) td {
  border: 1px solid #3e3e42;
  padding: 4px 8px;
  color: #a0a0a0;
}
:deep(.dt-html-body) th {
  background: #2d2d30;
  color: #d4d4d4;
}
:deep(.dt-html-body) pre,
:deep(.dt-html-body) code {
  background: #2d2d30;
  border-radius: 3px;
  padding: 2px 5px;
  font-size: 0.78rem;
  color: #ce9178;
}
:deep(.dt-html-body) blockquote {
  border-left: 3px solid #3e3e42;
  margin: 0;
  padding-left: 12px;
  color: #6a6a6a;
}
:deep(.dt-img-wrap) {
  display: inline-block;
  position: relative;
}
:deep(.dt-img-link):hover {
  background: rgba(77,147,117,0.8) !important;
  color: #fff !important;
}
</style>
