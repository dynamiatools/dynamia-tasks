export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const connector = getConnector(id)

  if (!connector.capabilities.hasExplorer || !connector.fetchSources) {
    throw createError({ statusCode: 405, data: { code: 'CAPABILITY_NOT_SUPPORTED' } })
  }

  const sources = await connector.fetchSources()
  return { sources }
})

