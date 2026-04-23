export default defineEventHandler(async (event) => {
  const { id, taskId } = getRouterParams(event)
  const connector = getConnector(id)

  if (!connector.capabilities.canComment || !connector.addComment) {
    throw createError({ statusCode: 405, data: { code: 'CAPABILITY_NOT_SUPPORTED' } })
  }

  const body = await readBody(event)
  const comment = await connector.addComment(decodeURIComponent(taskId), body.body)
  return { comment }
})

