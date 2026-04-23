import { LocalConnector } from '@dynamia-tasks/connector-local'
import { GithubConnector } from '@dynamia-tasks/connector-github'
import type { TaskConnector } from '@dynamia-tasks/core'

const registry = new Map<string, TaskConnector>()

export function registerConnector(connector: TaskConnector): void {
  registry.set(connector.id, connector)
}

export function getConnector(id: string): TaskConnector {
  const c = registry.get(id)
  if (!c) throw createError({ statusCode: 404, message: `Unknown connector: "${id}"`, data: { code: 'CONNECTOR_NOT_FOUND' } })
  return c
}

export function listConnectors(): TaskConnector[] {
  return [...registry.values()]
}

// Register built-in connectors once (singleton — projectPath injected at startup)
if (registry.size === 0) {
  registerConnector(new LocalConnector())
  registerConnector(new GithubConnector())
}

