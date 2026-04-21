import { LocalConnector } from '@dynamia-tasks/connector-local'
import { GithubConnector } from '@dynamia-tasks/connector-github'
import type { TaskConnector } from '@dynamia-tasks/core'

const registry = new Map<string, TaskConnector>()

export function registerConnector(connector: TaskConnector): void {
  registry.set(connector.id, connector)
}

export function getConnector(id: string): TaskConnector {
  const c = registry.get(id)
  if (!c) throw Object.assign(new Error(`Unknown connector: "${id}"`), { code: 'CONNECTOR_NOT_FOUND' })
  return c
}

export function listConnectors(): TaskConnector[] {
  return [...registry.values()]
}

// Built-in connectors — projectPath injected at startup via configure()
registerConnector(new LocalConnector())
registerConnector(new GithubConnector())

