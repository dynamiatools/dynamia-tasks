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
import { ConfigService } from './ConfigService.js'
import { tasksDir, migrateLegacyState, WORKSPACE_FILE } from './tasksDir.js'
import { watchTasksDir } from './tasksWatcher.js'
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

// ── TaskService ───────────────────────────────────────────────────────────────

export class TaskService {
  private readonly registry = new Map<string, TaskConnector>()
  private readonly configService = new ConfigService()

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
      const atRest = config.connectors[id]
      if (atRest === undefined) continue
      // One connector failing (e.g. keychain unavailable) must not stop the others from loading.
      try {
        const { merged, migrated, stripped } = await this.mergeSecrets(id, atRest as Record<string, unknown>)
        if (migrated) await this.persistStrippedConfig(id, stripped)
        await connector.configure(merged)
      } catch (e) {
        console.warn(`[dynamia-tasks] could not configure connector "${id}":`, (e as Error).message)
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

  async loadConfig(): Promise<AppConfig> {
    return this.configService.load()
  }

  async saveConfig(config: AppConfig): Promise<void> {
    await this.configService.save(config)
  }

  async getConnectorConfig(connectorId: string): Promise<unknown> {
    const config = await this.loadConfig()
    const atRest = (config.connectors[connectorId] ?? {}) as Record<string, unknown>
    const { merged, migrated, stripped } = await this.mergeSecrets(connectorId, atRest)
    if (migrated) await this.persistStrippedConfig(connectorId, stripped)
    return merged
  }

  async saveConnectorConfig(connectorId: string, data: unknown): Promise<void> {
    const record = { ...(data as Record<string, unknown> ?? {}) }
    const atRest = { ...record }
    for (const field of this.secretFieldKeys(connectorId)) {
      const value = record[field]
      delete atRest[field]
      if (value === undefined || value === null || value === '') {
        await ide.secrets.delete(this.secretStoreKey(connectorId, field))
      } else {
        await ide.secrets.set(this.secretStoreKey(connectorId, field), String(value))
      }
    }

    const config = await this.loadConfig()
    config.connectors[connectorId] = atRest
    await this.saveConfig(config)

    const connector = this.registry.get(connectorId)
    if (connector) {
      const { merged } = await this.mergeSecrets(connectorId, atRest)
      await connector.configure(merged)
    }
  }

  /**
   * Connector config fields declared as `type: 'password'` in the schema are
   * never persisted inline in `AppConfig` — they're stored via `ide.secrets`
   * (OS-keychain-backed) instead, keyed per connector+field.
   */
  private secretFieldKeys(connectorId: string): string[] {
    try {
      return this.getSchema(connectorId).fields
        .filter((f) => f.type === 'password')
        .map((f) => f.key)
    } catch {
      return []
    }
  }

  private secretStoreKey(connectorId: string, field: string): string {
    return `dynamiatasks.secret.${connectorId}.${field}`
  }

  /**
   * Combines an at-rest connector config (secret fields stripped) with the
   * secret values from `ide.secrets`. If a secret field is still found inline
   * in `atRest` (legacy plaintext data from before secrets were split out),
   * it's migrated into `ide.secrets` and reported via `migrated`/`stripped`.
   */
  private async mergeSecrets(
    connectorId: string,
    atRest: Record<string, unknown>,
  ): Promise<{ merged: Record<string, unknown>; migrated: boolean; stripped: Record<string, unknown> }> {
    const merged = { ...atRest }
    const stripped = { ...atRest }
    let migrated = false

    for (const field of this.secretFieldKeys(connectorId)) {
      const legacyValue = atRest[field]
      if (legacyValue !== undefined && legacyValue !== null && legacyValue !== '') {
        await ide.secrets.set(this.secretStoreKey(connectorId, field), String(legacyValue))
        delete stripped[field]
        migrated = true
      }
      const stored = await ide.secrets.get(this.secretStoreKey(connectorId, field))
      if (stored !== undefined) merged[field] = stored
    }

    return { merged, migrated, stripped }
  }

  private async persistStrippedConfig(connectorId: string, stripped: Record<string, unknown>): Promise<void> {
    const config = await this.loadConfig()
    config.connectors[connectorId] = stripped
    await this.saveConfig(config)
  }

  // ── Workspace management ───────────────────────────────────────────────────

  private workspacePath(): string {
    return ide.path.join(tasksDir(ide.env.getProjectPath()), WORKSPACE_FILE)
  }

  /** Calls `listener` when anything under `.dynamia/tasks/` changes on disk (agent, user or this plugin). */
  onChange(listener: () => void): () => void {
    return watchTasksDir(ide.env.getProjectPath(), listener)
  }

  private async readWorkspace(): Promise<Workspace> {
    await migrateLegacyState(ide.env.getProjectPath())
    const empty: Workspace = { projectPath: ide.env.getProjectPath(), items: [], activeTask: null }
    if (!(await ide.fs.exists(this.workspacePath()))) return empty
    const raw = await ide.fs.readFile(this.workspacePath())
    try {
      return JSON.parse(raw) as Workspace
    } catch {
      // Throwing (instead of returning `empty`) keeps the next write from wiping a file the user can still repair.
      throw new Error(`${WORKSPACE_FILE} is not valid JSON; fix or remove it`)
    }
  }

  private async writeWorkspace(ws: Workspace): Promise<void> {
    await ide.fs.mkdir(tasksDir(ide.env.getProjectPath()), { recursive: true })
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
    const ws = await this.readWorkspace().catch((e: Error) => {
      console.warn(`[dynamia-tasks] ${e.message}`)
      return { projectPath: '', items: [], activeTask: null } as Workspace
    })
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

