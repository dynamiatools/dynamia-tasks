/**
 * plugins/connectors.client.ts
 *
 * Runs once on the client side, AFTER bridge.client.ts (alphabetical: b < c).
 * Registers all built-in connectors into the global taskService singleton
 * and calls init() to load persisted config and configure each connector.
 */
import { LocalConnector } from '@dynamia-tasks/connector-local'
import { GithubConnector } from '@dynamia-tasks/connector-github'
import { useTaskService } from '~/composables/useTaskService'

export default defineNuxtPlugin(async () => {
  const svc = useTaskService()
  svc.register(new LocalConnector())
  svc.register(new GithubConnector())
  await svc.init()
})

