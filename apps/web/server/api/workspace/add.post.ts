export default defineEventHandler(async (event) => {
  const { connectorId, taskId } = await readBody(event)
  await addToWorkspace(getProjectPath(), connectorId, taskId)
  return resolveWorkspace(getProjectPath())
})
