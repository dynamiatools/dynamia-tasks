export default defineEventHandler(() => {
  const port = parseInt(process.env.PORT ?? process.env.NITRO_PORT ?? '3000', 10)
  return {
    port,
    projectPath: getProjectPath(),
    pid: process.pid,
    startedAt: new Date().toISOString(),
  }
})
