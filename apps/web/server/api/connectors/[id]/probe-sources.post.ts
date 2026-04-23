export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const connector = getConnector(id)

  if (!connector.capabilities.hasExplorer) {
    throw createError({ statusCode: 405, data: { code: 'CAPABILITY_NOT_SUPPORTED' } })
  }

  const c = connector as any
  if (typeof c.fetchSourcesWithToken !== 'function') {
    throw createError({ statusCode: 405, data: { code: 'CAPABILITY_NOT_SUPPORTED' } })
  }

  const { token, orgs } = await readBody(event)
  const sources = await c.fetchSourcesWithToken(token, orgs ?? [])
  return { sources }
})

