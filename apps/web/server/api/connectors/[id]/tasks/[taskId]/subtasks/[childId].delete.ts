export default defineEventHandler(async (event) => {
  const { id, taskId, childId } = getRouterParams(event)
  const connector = getConnector(id)

  if (!connector.capabilities.canSubtasks || !connector.removeSubtask) {
    throw createError({ statusCode: 405, data: { code: 'CAPABILITY_NOT_SUPPORTED' } })
  }

  await connector.removeSubtask(decodeURIComponent(taskId), decodeURIComponent(childId))
  return { ok: true }
})

