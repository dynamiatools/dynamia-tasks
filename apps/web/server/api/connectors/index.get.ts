export default defineEventHandler(async () => {
  const connectors = await Promise.all(
    listConnectors().map(async c => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      capabilities: c.capabilities,
      configured: await c.isConfigured(),
    }))
  )
  return { connectors }
})

