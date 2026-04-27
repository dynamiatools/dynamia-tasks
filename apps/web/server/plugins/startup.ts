/**
 * Nitro startup plugin — runs once when the server boots.
 * Configures connectors, writes the instance file, and emits the
 * discovery log line that the IntelliJ plugin watches for.
 */
export default defineNitroPlugin(async () => {
  const projectPath = getProjectPath()
  const port = parseInt(process.env.PORT ?? process.env.NITRO_PORT ?? '3000', 10)

  // Configure LocalConnector with the project path
  try {
    const localConnector = getConnector('local')
    await localConnector.configure({ projectPath })
  } catch { /* ignore if not found */ }

  // Re-configure all connectors from saved config
  try {
    const savedConfig = await readConfig()
    for (const [id, connectorConfig] of Object.entries(savedConfig.connectors)) {
      try {
        const connector = getConnector(id)
        await connector.configure(connectorConfig)
      } catch { /* connector not registered */ }
    }
  } catch { /* ignore */ }

  // Write instance file so IDE plugins can discover the port
  const instance = await writeInstancePort(projectPath, port)

  // Clean up on graceful shutdown
  const cleanup = async () => {
    await removeInstancePort(projectPath)
    process.exit(0)
  }
  process.once('SIGINT', cleanup)
  process.once('SIGTERM', cleanup)

  console.log(`DT_INSTANCE_READY ${JSON.stringify(instance)}`)
  // ⚠ This exact line format is parsed by NodeServerManager.kt for port discovery
  console.log(`✓ dynamia-tasks server running on http://localhost:${port}`)
  console.log(`  projectPath: ${projectPath}`)
})
