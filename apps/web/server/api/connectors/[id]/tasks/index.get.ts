import type { TaskFilter } from '@dynamia-tasks/core'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const connector = getConnector(id)

  if (!await connector.isConfigured()) {
    return { error: true, code: 'CONNECTOR_NOT_CONFIGURED', message: 'Connector is not configured', tasks: [] }
  }

  const query = getQuery(event) as TaskFilter
  try {
    const tasks = await connector.fetchTasks(query)
    await writeCache(connector.id, tasks)
    return { tasks, cached: false }
  } catch (e: any) {
    if (e.code === 'UPSTREAM_RATE_LIMITED' || e.code === 'UPSTREAM_AUTH_FAILED') {
      const cached = await readCache(connector.id)
      if (cached) return { tasks: cached.data, cached: true, cachedAt: cached.ts, code: 'CACHE_ONLY' }
    }
    throw e
  }
})

