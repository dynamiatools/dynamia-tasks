export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const connector = getConnector(id)

  if (!connector.capabilities.canCreate) {
    throw createError({ statusCode: 405, message: 'Connector cannot create tasks', data: { code: 'CAPABILITY_NOT_SUPPORTED' } })
  }

  const body = await readBody(event)
  const task = await connector.createTask(body)
  return { task }
})

