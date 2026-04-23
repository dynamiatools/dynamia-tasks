export default defineEventHandler(async (event) => {
  const { id, taskId } = getRouterParams(event)
  const connector = getConnector(id)

  if (!connector.capabilities.canSubtasks || !connector.fetchSubtasks) {
    throw createError({ statusCode: 405, data: { code: 'CAPABILITY_NOT_SUPPORTED' } })
  }

  const subtasks = await connector.fetchSubtasks(decodeURIComponent(taskId))
  return { subtasks }
})

