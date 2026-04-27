export default defineEventHandler(async () => {
  const projectPath = getProjectPath()
  const instance = await readInstancePort(projectPath)

  if (instance) {
    return instance
  }

  const port = parseInt(process.env.PORT ?? process.env.NITRO_PORT ?? '3000', 10)
  return {
    port,
    projectPath,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  }
})
