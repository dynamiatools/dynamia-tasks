import { ide } from '@dynamia-tools/ide-bridge'

/** Works in browser (JCEF / WebView) and Node.js 19+. No import needed. */
const newUUID = (): string => crypto.randomUUID()
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

  private _projectPath: string | undefined

  constructor(projectPath?: string) {
    this._projectPath = projectPath
  }

  /** Resolved lazily so the bridge is not accessed at instantiation time. */
  private get projectPath(): string {
    if (!this._projectPath) this._projectPath = ide.env.getProjectPath()
    return this._projectPath
  }

  private get tasksDir() {
    return ide.path.join(this.projectPath, '.tasks')
  }

  private get commentsFile() {
    return ide.path.join(this.tasksDir, 'comments.json')
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
    if (c?.projectPath) this._projectPath = c.projectPath
  }

  getConfigSchema(): ConnectorConfigSchema {
    return { fields: [] } // no user-facing config
  }

  private async readAllTasks(): Promise<ConnectorTask[]> {
    let files: string[] = []
    try {
      files = await ide.fs.readdir(this.tasksDir)
    } catch {
      return [] // .tasks/ doesn't exist yet
    }

    const tasks: ConnectorTask[] = []
    for (const file of files.filter(f => f.endsWith('.json') && f !== 'comments.json')) {
      const filePath = ide.path.join(this.tasksDir, file)
      try {
        const raw = await ide.fs.readFile(filePath)
        const arr = JSON.parse(raw) as ConnectorTask[]
        tasks.push(...arr.map(task => this.normalizeTask(task)))
      } catch {
        console.warn(`[connector-local] Skipping ${file}: invalid JSON`)
      }
    }
    return tasks
  }

  private async writeFile(filename: string, tasks: ConnectorTask[]): Promise<void> {
    await ide.fs.mkdir(this.tasksDir, { recursive: true })
    await ide.fs.writeFile(
      ide.path.join(this.tasksDir, filename),
      JSON.stringify(tasks, null, 2),
    )
  }

  private async readComments(): Promise<Record<string, TaskComment[]>> {
    try {
      const raw = await ide.fs.readFile(this.commentsFile)
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }

  private async writeComments(data: Record<string, TaskComment[]>): Promise<void> {
    await ide.fs.mkdir(this.tasksDir, { recursive: true })
    await ide.fs.writeFile(this.commentsFile, JSON.stringify(data, null, 2))
  }

  private async findTaskFile(id: string): Promise<{ file: string; tasks: ConnectorTask[] } | null> {
    let files: string[] = []
    try {
      files = await ide.fs.readdir(this.tasksDir)
    } catch {
      return null
    }
    for (const file of files.filter(f => f.endsWith('.json') && f !== 'comments.json')) {
      try {
        const raw = await ide.fs.readFile(ide.path.join(this.tasksDir, file))
        const arr = JSON.parse(raw) as ConnectorTask[]
        if (arr.some(t => t.id === id)) return { file, tasks: arr }
      } catch { /* skip */ }
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
      id: `local-${newUUID()}`,
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

    const filename = 'backlog.json'
    let existing: ConnectorTask[] = []
    try {
      const raw = await ide.fs.readFile(ide.path.join(this.tasksDir, filename))
      existing = JSON.parse(raw)
    } catch { /* file doesn't exist yet */ }
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

  private async resolveAuthor(): Promise<string> {
    try {
      const result = await ide.shell.exec('git', ['config', 'user.name'], {
        cwd: this.projectPath,
        timeout: 2000,
      })
      const name = result.stdout.trim()
      if (name) return name
    } catch { /* not a git repo */ }
    return 'local'
  }

  async fetchComments(taskId: string): Promise<TaskComment[]> {
    const all = await this.readComments()
    return all[taskId] ?? []
  }

  async addComment(taskId: string, body: string): Promise<TaskComment> {
    const all    = await this.readComments()
    const now    = new Date().toISOString()
    const author = await this.resolveAuthor()
    const comment: TaskComment = {
      id: newUUID(),
      body,
      author: { id: 'local', login: author },
      createdAt: now,
      updatedAt: now,
    }
    all[taskId] = [...(all[taskId] ?? []), comment]
    await this.writeComments(all)
    return comment
  }
}
