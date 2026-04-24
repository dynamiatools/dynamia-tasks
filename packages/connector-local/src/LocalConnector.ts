import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import type {
  TaskConnector,
  ConnectorTask,
  ConnectorCapabilities,
  ConnectorConfigSchema,
  TaskFilter,
  TaskPatch,
  NewTask,
  TaskLabel,
  TaskComment,
} from '@dynamia-tasks/core'

export class LocalConnector implements TaskConnector {
  readonly id = 'local'
  readonly name = 'Local Tasks'
  readonly icon = '📁'
  readonly capabilities: ConnectorCapabilities = {
    canCreate: true,
    canDelete: true,
    canEdit: true,
    canComment: true,
    canSubtasks: false,
    canAssign: false,
    canLabel: true,
    hasDetail: true,
    hasExplorer: false,
  }

  private projectPath: string

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath
  }

  private get tasksDir() {
    return path.join(this.projectPath, '.tasks')
  }

  private get commentsFile() {
    return path.join(this.tasksDir, 'comments.json')
  }

  private colorForLabel(name: string): string {
    let hash = 0
    for (let i = 0; i < name.length; i += 1) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i)
      hash |= 0
    }

    const hue = Math.abs(hash) % 360
    return this.hslToHex(hue, 52, 48)
  }

  private hslToHex(hue: number, saturation: number, lightness: number): string {
    const sat = saturation / 100
    const light = lightness / 100
    const chroma = (1 - Math.abs(2 * light - 1)) * sat
    const segment = hue / 60
    const x = chroma * (1 - Math.abs(segment % 2 - 1))

    let red = 0
    let green = 0
    let blue = 0

    if (segment >= 0 && segment < 1) {
      red = chroma
      green = x
    } else if (segment < 2) {
      red = x
      green = chroma
    } else if (segment < 3) {
      green = chroma
      blue = x
    } else if (segment < 4) {
      green = x
      blue = chroma
    } else if (segment < 5) {
      red = x
      blue = chroma
    } else {
      red = chroma
      blue = x
    }

    const match = light - chroma / 2
    const toHex = (value: number) => Math.round((value + match) * 255).toString(16).padStart(2, '0')

    return `${toHex(red)}${toHex(green)}${toHex(blue)}`
  }

  private normalizeLabel(label: TaskLabel): TaskLabel {
    return {
      ...label,
      color: label.color ?? this.colorForLabel(label.name),
    }
  }

  private normalizeTask(task: ConnectorTask): ConnectorTask {
    return {
      ...task,
      labels: task.labels?.map(label => this.normalizeLabel(label)),
    }
  }

  async isConfigured(): Promise<boolean> {
    return true // always configured — no token needed
  }

  async configure(config: unknown): Promise<void> {
    const c = config as { projectPath?: string }
    if (c?.projectPath) this.projectPath = c.projectPath
  }

  getConfigSchema(): ConnectorConfigSchema {
    return { fields: [] } // no user-facing config
  }

  private async readAllTasks(): Promise<ConnectorTask[]> {
    let files: string[] = []
    try {
      files = await fs.readdir(this.tasksDir)
    } catch {
      return [] // .tasks/ doesn't exist yet
    }

    const tasks: ConnectorTask[] = []
    for (const file of files.filter(f => f.endsWith('.json') && f !== 'comments.json')) {
      const filePath = path.join(this.tasksDir, file)
      try {
        const raw = await fs.readFile(filePath, 'utf-8')
        const arr = JSON.parse(raw) as ConnectorTask[]
        tasks.push(...arr.map(task => this.normalizeTask(task)))
      } catch (e) {
        console.warn(`[connector-local] Skipping ${file}: invalid JSON`)
      }
    }
    return tasks
  }

  private async writeFile(filename: string, tasks: ConnectorTask[]): Promise<void> {
    await fs.mkdir(this.tasksDir, { recursive: true })
    await fs.writeFile(
      path.join(this.tasksDir, filename),
      JSON.stringify(tasks, null, 2),
      'utf-8'
    )
  }

  private async readComments(): Promise<Record<string, TaskComment[]>> {
    try {
      const raw = await fs.readFile(this.commentsFile, 'utf-8')
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }

  private async writeComments(data: Record<string, TaskComment[]>): Promise<void> {
    await fs.mkdir(this.tasksDir, { recursive: true })
    await fs.writeFile(this.commentsFile, JSON.stringify(data, null, 2), 'utf-8')
  }

  // Find which file contains a given task id
  private async findTaskFile(id: string): Promise<{ file: string; tasks: ConnectorTask[] } | null> {
    let files: string[] = []
    try {
      files = await fs.readdir(this.tasksDir)
    } catch {
      return null
    }
    for (const file of files.filter(f => f.endsWith('.json') && f !== 'comments.json')) {
      try {
        const raw = await fs.readFile(path.join(this.tasksDir, file), 'utf-8')
        const arr = JSON.parse(raw) as ConnectorTask[]
        if (arr.some(t => t.id === id)) return { file, tasks: arr }
      } catch {
        // skip
      }
    }
    return null
  }

  async fetchTasks(filter?: TaskFilter): Promise<ConnectorTask[]> {
    let tasks = await this.readAllTasks()

    if (filter?.query) {
      const q = filter.query.toLowerCase()
      tasks = tasks.filter(t => t.title.toLowerCase().includes(q))
    }
    if (filter?.status && filter.status !== 'all') {
      tasks = tasks.filter(t => filter.status === 'open' ? !t.done : t.done)
    }
    if (filter?.labels && filter.labels.length > 0) {
      tasks = tasks.filter(t =>
        filter.labels!.some(l => t.labels?.some(tl => tl.name === l))
      )
    }

    return tasks
  }

  async getTask(id: string): Promise<ConnectorTask> {
    const result = await this.findTaskFile(id)
    const task = result?.tasks.find(t => t.id === id)
    if (!task) throw Object.assign(new Error(`Task not found: ${id}`), { code: 'TASK_NOT_FOUND' })
    return this.normalizeTask(task)
  }

  async createTask(newTask: NewTask): Promise<ConnectorTask> {
    const now = new Date().toISOString()
    const task: ConnectorTask = {
      id: `local-${randomUUID()}`,
      connectorId: 'local',
      title: newTask.title,
      description: newTask.description,
      done: false,
      module: newTask.module,
      labels: newTask.labels?.map(l => this.normalizeLabel({ id: l, name: l })),
      priority: newTask.priority as ConnectorTask['priority'],
      createdAt: now,
      updatedAt: now,
    }

    // Append to backlog.json (or create it)
    const filename = 'backlog.json'
    let existing: ConnectorTask[] = []
    try {
      const raw = await fs.readFile(path.join(this.tasksDir, filename), 'utf-8')
      existing = JSON.parse(raw)
    } catch {
      // file doesn't exist yet
    }
    await this.writeFile(filename, [...existing, task])
    return task
  }

  async updateTask(id: string, patch: TaskPatch): Promise<ConnectorTask> {
    const result = await this.findTaskFile(id)
    if (!result) throw Object.assign(new Error(`Task not found: ${id}`), { code: 'TASK_NOT_FOUND' })

    const updated = result.tasks.map(t => {
      if (t.id !== id) return t
      return {
        ...t,
        ...patch,
        labels: patch.labels ? patch.labels.map(l => this.normalizeLabel({ id: l, name: l })) : t.labels,
        updatedAt: new Date().toISOString(),
      }
    })

    await this.writeFile(result.file, updated)
    return this.normalizeTask(updated.find(t => t.id === id)!)
  }

  async deleteTask(id: string): Promise<void> {
    const result = await this.findTaskFile(id)
    if (!result) throw Object.assign(new Error(`Task not found: ${id}`), { code: 'TASK_NOT_FOUND' })
    await this.writeFile(result.file, result.tasks.filter(t => t.id !== id))
  }

  async fetchLabels(_sourceId?: string): Promise<TaskLabel[]> {
    const tasks = await this.readAllTasks()
    const map = new Map<string, TaskLabel>()
    for (const task of tasks) {
      for (const label of task.labels ?? []) {
        if (!map.has(label.name)) map.set(label.name, this.normalizeLabel(label))
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  private resolveAuthor(): string {
    // 1. Try git config user.name in projectPath
    try {
      const result = spawnSync('git', ['config', 'user.name'], {
        cwd: this.projectPath,
        encoding: 'utf-8',
        timeout: 2000,
      })
      const name = result.stdout?.trim()
      if (name) return name
    } catch { /* not a git repo */ }

    // 2. Try system user env vars
    const envUser = process.env.USER ?? process.env.USERNAME
    if (envUser) return envUser

    // 3. Fallback
    return 'local'
  }

  async fetchComments(taskId: string): Promise<TaskComment[]> {
    const all = await this.readComments()
    return all[taskId] ?? []
  }

  async addComment(taskId: string, body: string): Promise<TaskComment> {
    const all = await this.readComments()
    const now = new Date().toISOString()
    const comment: TaskComment = {
      id: randomUUID(),
      body,
      author: { id: 'local', login: this.resolveAuthor() },
      createdAt: now,
      updatedAt: now,
    }
    all[taskId] = [...(all[taskId] ?? []), comment]
    await this.writeComments(all)
    return comment
  }
}
