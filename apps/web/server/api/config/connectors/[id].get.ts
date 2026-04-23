export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const config = await readConfig()
  return config.connectors[id] ?? {}
})

