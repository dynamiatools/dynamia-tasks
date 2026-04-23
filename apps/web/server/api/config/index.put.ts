export default defineEventHandler(async (event) => {
  const config = await readBody(event)
  await writeConfig(config)
  // Re-configure connectors
  for (const [id, connectorConfig] of Object.entries(config.connectors ?? {})) {
    try {
      const connector = getConnector(id)
      await connector.configure(connectorConfig)
    } catch { /* ignore */ }
  }
  return { ok: true }
})

