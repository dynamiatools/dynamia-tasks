// Task grouping utility — used by server when resolving workspace

import type { ConnectorTask } from './types.js'

export function resolveModule(task: ConnectorTask): string {
  if (task.module) return task.module.toLowerCase()
  if (task.labels && task.labels.length > 0) return task.labels[0].name.toLowerCase()
  const match = task.title.match(/^\[([^\]]+)\]/)
  if (match) return match[1].toLowerCase()
  return 'other'
}

