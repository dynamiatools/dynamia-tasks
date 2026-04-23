export default defineEventHandler(async (event) => {
  const { id, taskId } = getRouterParams(event)
  const connector = getConnector(id)

  if (!connector.capabilities.canDelete || !connector.deleteTask) {
    throw createError({ statusCode: 405, message: 'Connector cannot delete tasks', data: { code: 'CAPABILITY_NOT_SUPPORTED' } })
  }

  await connector.deleteTask(decodeURIComponent(taskId))
  return { ok: true }
})

