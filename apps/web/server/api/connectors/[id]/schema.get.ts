export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const connector = getConnector(id)
  return connector.getConfigSchema()
})

