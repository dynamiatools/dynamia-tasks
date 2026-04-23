export default defineEventHandler(async (event) => {
  const { connectorId, taskId } = getRouterParams(event)
  await removeFromWorkspace(getProjectPath(), connectorId, decodeURIComponent(taskId))
  return resolveWorkspace(getProjectPath())
})
