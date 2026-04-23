export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const config = await readConfig()
  config.connectors[id] = await readBody(event)
  await writeConfig(config)
  try {
    const connector = getConnector(id)
    await connector.configure(config.connectors[id])
  } catch { /* ignore */ }
  return { ok: true }
})

