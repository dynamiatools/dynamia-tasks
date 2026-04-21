import type {
  ConnectorTask,
  TaskComment,
  ConnectorCapabilities,
} from '../types.js'

export interface TaskFilter {
  query?: string
  labels?: string[]
  status?: 'open' | 'closed' | 'all'
  page?: number
  perPage?: number
  [key: string]: unknown
}

export interface NewTask {
  title: string
  description?: string
  module?: string
  labels?: string[]
  [key: string]: unknown
}

export interface TaskPatch {
  title?: string
  description?: string
  done?: boolean
  module?: string
  labels?: string[]
  priority?: 'high' | 'medium' | 'low'
}

export interface ConnectorSource {
  id: string
  name: string
  group?: string
  metadata?: unknown
}

export interface ConnectorConfigSchema {
  fields: ConfigField[]
}

export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'password' | 'select' | 'multiselect' | 'boolean'
  required: boolean
  placeholder?: string
  helpText?: string
  options?: { label: string; value: string }[]
}

export interface TaskConnector {
  // Identity
  readonly id: string
  readonly name: string
  readonly icon: string
  readonly capabilities: ConnectorCapabilities

  // Lifecycle
  isConfigured(): Promise<boolean>
  configure(config: unknown): Promise<void>
  getConfigSchema(): ConnectorConfigSchema

  // Task CRUD
  fetchTasks(filter?: TaskFilter): Promise<ConnectorTask[]>
  getTask(id: string): Promise<ConnectorTask>
  updateTask(id: string, patch: TaskPatch): Promise<ConnectorTask>
  createTask(task: NewTask): Promise<ConnectorTask>
  deleteTask?(id: string): Promise<void>

  // Extended (optional)
  fetchComments?(taskId: string): Promise<TaskComment[]>
  addComment?(taskId: string, body: string): Promise<TaskComment>
  fetchSubtasks?(taskId: string): Promise<ConnectorTask[]>
  addSubtask?(parentId: string, childId: string): Promise<void>
  removeSubtask?(parentId: string, childId: string): Promise<void>

  // Explorer
  fetchSources?(): Promise<ConnectorSource[]>
}

