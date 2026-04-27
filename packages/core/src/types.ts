// ── Task models ──────────────────────────────────────────────────────────────

export interface TaskLabel {
  id: string
  name: string
  color?: string // hex without #
}

export interface TaskUser {
  id: string
  login: string
  avatarUrl?: string
}

export interface ConnectorTask {
  // Identity
  id: string
  connectorId: string
  sourceId?: string

  // Content
  title: string
  description?: string // Markdown
  done: boolean

  // Classification
  module?: string
  labels?: TaskLabel[]
  priority?: 'high' | 'medium' | 'low'

  // People
  assignees?: TaskUser[]
  author?: TaskUser

  // Counts
  commentsCount?: number
  subtasksCount?: number
  subtasksDoneCount?: number

  // Timestamps
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601

  // Passthrough
  meta?: Record<string, unknown>
}

export interface TaskComment {
  id: string
  body: string // Markdown
  author: TaskUser
  createdAt: string
  updatedAt: string
}

// ── Workspace ─────────────────────────────────────────────────────────────────

export interface WorkspaceItem {
  connectorId: string
  taskId: string
  addedAt: string // ISO 8601
  order: number
}

export interface WorkspaceActiveTask {
  connectorId: string
  taskId: string
}

export interface Workspace {
  projectPath: string
  items: WorkspaceItem[]
  activeTask: WorkspaceActiveTask | null
}

// ── UI-only ───────────────────────────────────────────────────────────────────

export interface TaskView extends ConnectorTask {
  connectorName: string
  connectorIcon: string
  capabilities: ConnectorCapabilities
}

/** Connector metadata as returned by TaskService.getConnectors() */
export interface ConnectorInfo {
  id: string
  name: string
  icon: string
  capabilities: ConnectorCapabilities
  configured: boolean
}

/** Result shape for workspace operations */
export interface WorkspaceResult {
  items: TaskView[]
  activeTask: WorkspaceActiveTask | null
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface AppConfig {
  connectors: {
    [connectorId: string]: unknown
  }
  ui: {
    theme: 'light' | 'dark' | 'system'
    groupBy: 'module' | 'label' | 'connector'
    defaultView: 'workspace' | 'explorer'
  }
}

// ── Connector capabilities ────────────────────────────────────────────────────

export interface ConnectorCapabilities {
  canCreate: boolean
  canDelete: boolean
  canEdit: boolean
  canComment: boolean
  canSubtasks: boolean
  canAssign: boolean
  canLabel: boolean
  hasDetail: boolean
  hasExplorer: boolean
}

