/**
 * TaskService — central service layer for the Dynamia Tasks SPA.
 *
 * Replaces all HTTP API calls. Connectors are registered here and all
 * task/config/workspace operations are delegated to them directly,
 * using ide.fs / ide.env / ide.path from @dynamia-tools/ide-bridge.
 *
 * Usage:
 *   import { taskService } from '@dynamia-tasks/core'
 *   taskService.register(new MyConnector())
 *   await taskService.init()   // call once at startup after bridge is ready
 */

import { ide } from '@dynamia-tools/ide-bridge'
import type {
  TaskConnector,
  TaskFilter,
  NewTask,
  TaskPatch,
  ConnectorSource,
  ConnectorConfigSchema,
} from './connectors/types.js'
import type {
  ConnectorTask,
  TaskComment,
  TaskLabel,
  TaskView,
  WorkspaceItem,
  WorkspaceActiveTask,
  Workspace,
  AppConfig,
  ConnectorInfo,
  WorkspaceResult,
  ConnectorCapabilities,
} from './types.js'

// ── Defaults ──────────────────────────────────────────────────────────────────

const EMPTY_CAPABILITIES: ConnectorCapabilities = {
  canCreate: false, canDelete: false, canEdit: false, canComment: false,
  canSubtasks: false, canAssign: false, canLabel: false, hasDetail: false, hasExplorer: false,
}

const DEFAULT_CONFIG: AppConfig = {
  connectors: {},
  ui: { theme: 'dark', groupBy: 'module', defaultView: 'workspace' },
}

// ── TaskService ───────────────────────────────────────────────────────────────

export class TaskService {
  private readonly registry = new Map<string, TaskConnector>()

  // ── Registration ───────────────────────────────────────────────────────────

  register(connector: TaskConnector): void {
    this.registry.set(connector.id, connector)
  }

  /**
   * Loads persisted config and calls configure() on each registered connector.
   * Must be called once at startup, after the ide-bridge is initialized.
   */
  async init(): Promise<void> {
    const config = await this.loadConfig()
    for (const [id, connector] of this.registry) {
      const connectorConfig = config.connectors[id]
      if (connectorConfig !== undefined) {
        await connector.configure(connectorConfig)
      }
    }
  }

  // ── Connector registry ─────────────────────────────────────────────────────

  async getConnectors(): Promise<ConnectorInfo[]> {
    const result: ConnectorInfo[] = []
    for (const c of this.registry.values()) {
      result.push({
        id: c.id,
        name: c.name,
        icon: c.icon,
        capabilities: c.capabilities,
        configured: await c.isConfigured(),
      })
    }
    return result
  }

  getSchema(connectorId: string): ConnectorConfigSchema {
    return this.require(connectorId).getConfigSchema()
  }

  // ── Config management ──────────────────────────────────────────────────────

  private configPath(): string {
    return ide.path.join(ide.env.getHomePath(), '.dynamiatasks', 'config.json')
  }

  async loadConfig(): Promise<AppConfig> {
    try {
      const raw = await ide.fs.readFile(this.configPath())
      return JSON.parse(raw) as AppConfig
    } catch {
      return { ...DEFAULT_CONFIG, connectors: {} }
    }
  }

  async saveConfig(config: AppConfig): Promise<void> {
    const dir = ide.path.join(ide.env.getHomePath(), '.dynamiatasks')
    await ide.fs.mkdir(dir, { recursive: true })
    await ide.fs.writeFile(this.configPath(), JSON.stringify(config, null, 2))
  }

  async getConnectorConfig(connectorId: string): Promise<unknown> {
    const config = await this.loadConfig()
    return config.connectors[connectorId] ?? {}
  }

  async saveConnectorConfig(connectorId: string, data: unknown): Promise<void> {
    const config = await this.loadConfig()
    config.connectors[connectorId] = data
    await this.saveConfig(config)
    const connector = this.registry.get(connectorId)
    if (connector) await connector.configure(data)
  }

  // ── Workspace management ───────────────────────────────────────────────────

  private workspacePath(): string {
    return ide.path.join(ide.env.getProjectPath(), '.dynamiatasks', 'workspace.json')
  }

  private async readWorkspace(): Promise<Workspace> {
    try {
      const raw = await ide.fs.readFile(this.workspacePath())
      return JSON.parse(raw) as Workspace
    } catch {
      return { projectPath: ide.env.getProjectPath(), items: [], activeTask: null }
    }
  }

  private async writeWorkspace(ws: Workspace): Promise<void> {
    const dir = ide.path.join(ide.env.getProjectPath(), '.dynamiatasks')
    await ide.fs.mkdir(dir, { recursive: true })
    await ide.fs.writeFile(this.workspacePath(), JSON.stringify(ws, null, 2))
  }

  private toView(task: ConnectorTask): TaskView {
    const c = this.registry.get(task.connectorId)
    return {
      ...task,
      connectorName: c?.name ?? task.connectorId,
      connectorIcon: c?.icon ?? '',
      capabilities: c?.capabilities ?? { ...EMPTY_CAPABILITIES },
    }
  }

  async loadWorkspace(): Promise<WorkspaceResult> {
    const ws = await this.readWorkspace()
    const sorted = [...ws.items].sort((a, b) => a.order - b.order)
    const items: TaskView[] = []
    for (const item of sorted) {
      const connector = this.registry.get(item.connectorId)
      if (!connector) continue
      try {
        const task = await connector.getTask(item.taskId)
        items.push(this.toView(task))
      } catch { /* task deleted or connector removed — skip silently */ }
    }
    return { items, activeTask: ws.activeTask }
  }

  async addToWorkspace(connectorId: string, taskId: string): Promise<WorkspaceResult> {
    const ws = await this.readWorkspace()
    if (!ws.items.some(i => i.connectorId === connectorId && i.taskId === taskId)) {
      ws.items.push({ connectorId, taskId, addedAt: new Date().toISOString(), order: ws.items.length })
    }
    await this.writeWorkspace(ws)
    return this.loadWorkspace()
  }

  async removeFromWorkspace(connectorId: string, taskId: string): Promise<WorkspaceResult> {
    const ws = await this.readWorkspace()
    ws.items = ws.items.filter(i => !(i.connectorId === connectorId && i.taskId === taskId))
    if (ws.activeTask?.connectorId === connectorId && ws.activeTask.taskId === taskId) {
      ws.activeTask = null
    }
    await this.writeWorkspace(ws)
    return this.loadWorkspace()
  }

  async setActiveTask(connectorId: string | null, taskId: string | null): Promise<WorkspaceResult> {
    const ws = await this.readWorkspace()
    ws.activeTask = (connectorId && taskId) ? { connectorId, taskId } : null
    await this.writeWorkspace(ws)
    return this.loadWorkspace()
  }

  async reorderWorkspace(
    orderedItems: { connectorId: string; taskId: string; order: number }[],
  ): Promise<WorkspaceResult> {
    const ws = await this.readWorkspace()
    for (const item of ws.items) {
      const found = orderedItems.find(
        i => i.connectorId === item.connectorId && i.taskId === item.taskId,
      )
      if (found !== undefined) item.order = found.order
    }
    await this.writeWorkspace(ws)
    return this.loadWorkspace()
  }

  async clearWorkspace(): Promise<WorkspaceResult> {
    const ws = await this.readWorkspace()
    ws.items = []
    ws.activeTask = null
    await this.writeWorkspace(ws)
    return { items: [], activeTask: null }
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  async fetchTasks(connectorId: string, filter?: TaskFilter): Promise<ConnectorTask[]> {
    return this.require(connectorId).fetchTasks(filter)
  }

  async getTask(connectorId: string, taskId: string): Promise<TaskView> {
    const task = await this.require(connectorId).getTask(taskId)
    return this.toView(task)
  }

  async updateTask(connectorId: string, taskId: string, patch: TaskPatch): Promise<TaskView> {
    const task = await this.require(connectorId).updateTask(taskId, patch)
    return this.toView(task)
  }

  async createTask(connectorId: string, task: NewTask): Promise<ConnectorTask> {
    return this.require(connectorId).createTask(task)
  }

  async deleteTask(connectorId: string, taskId: string): Promise<void> {
    const c = this.require(connectorId)
    if (!c.deleteTask) throw new Error(`Connector ${connectorId} does not support deleteTask`)
    return c.deleteTask(taskId)
  }

  // ── Comments ───────────────────────────────────────────────────────────────

  async fetchComments(connectorId: string, taskId: string): Promise<TaskComment[]> {
    const c = this.require(connectorId)
    if (!c.fetchComments) return []
    return c.fetchComments(taskId)
  }

  async addComment(connectorId: string, taskId: string, body: string): Promise<TaskComment> {
    const c = this.require(connectorId)
    if (!c.addComment) throw new Error(`Connector ${connectorId} does not support addComment`)
    return c.addComment(taskId, body)
  }

  // ── Subtasks ───────────────────────────────────────────────────────────────

  async fetchSubtasks(connectorId: string, taskId: string): Promise<ConnectorTask[]> {
    const c = this.require(connectorId)
    if (!c.fetchSubtasks) return []
    return c.fetchSubtasks(taskId)
  }

  async addSubtask(connectorId: string, parentId: string, childId: string): Promise<void> {
    const c = this.require(connectorId)
    if (!c.addSubtask) throw new Error(`Connector ${connectorId} does not support addSubtask`)
    return c.addSubtask(parentId, childId)
  }

  async removeSubtask(connectorId: string, parentId: string, childId: string): Promise<void> {
    const c = this.require(connectorId)
    if (!c.removeSubtask) throw new Error(`Connector ${connectorId} does not support removeSubtask`)
    return c.removeSubtask(parentId, childId)
  }

  // ── Sources ────────────────────────────────────────────────────────────────

  async fetchSources(connectorId: string): Promise<ConnectorSource[]> {
    const c = this.require(connectorId)
    if (!c.fetchSources) return []
    return c.fetchSources()
  }

  /**
   * Probe sources using a temporary config without persisting it.
   * Used by the Settings UI to validate a token before saving.
   */
  async probeConnectorSources(connectorId: string, tempConfig: unknown): Promise<ConnectorSource[]> {
    const c = this.require(connectorId)
    const saved = await this.getConnectorConfig(connectorId)
    try {
      await c.configure(tempConfig)
      if (!c.fetchSources) return []
      return await c.fetchSources()
    } finally {
      await c.configure(saved)
    }
  }

  // ── Labels ─────────────────────────────────────────────────────────────────

  async fetchLabels(connectorId: string, sourceId?: string): Promise<TaskLabel[]> {
    const c = this.require(connectorId)
    if (!c.fetchLabels) return []
    return c.fetchLabels(sourceId)
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private require(connectorId: string): TaskConnector {
    const c = this.registry.get(connectorId)
    if (!c) throw new Error(`Connector not found: ${connectorId}`)
    return c
  }
}

/** Global singleton — register connectors then call init() once at startup. */
export const taskService = new TaskService()

