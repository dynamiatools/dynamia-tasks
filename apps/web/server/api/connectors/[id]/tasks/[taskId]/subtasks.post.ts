export default defineEventHandler(async (event) => {
  const { id, taskId } = getRouterParams(event)
  const connector = getConnector(id)

  if (!connector.capabilities.canSubtasks || !connector.addSubtask) {
    throw createError({ statusCode: 405, data: { code: 'CAPABILITY_NOT_SUPPORTED' } })
  }

  const body = await readBody(event)
  await connector.addSubtask(decodeURIComponent(taskId), body.childId)
  return { ok: true }
})

