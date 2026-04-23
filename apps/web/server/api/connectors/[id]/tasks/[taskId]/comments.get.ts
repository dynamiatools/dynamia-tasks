export default defineEventHandler(async (event) => {
  const { id, taskId } = getRouterParams(event)
  const connector = getConnector(id)

  if (!connector.capabilities.canComment || !connector.fetchComments) {
    throw createError({ statusCode: 405, data: { code: 'CAPABILITY_NOT_SUPPORTED' } })
  }

  const comments = await connector.fetchComments(decodeURIComponent(taskId))
  return { comments }
})

