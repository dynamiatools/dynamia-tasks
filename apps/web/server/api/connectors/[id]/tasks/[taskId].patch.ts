export default defineEventHandler(async (event) => {
  const { id, taskId } = getRouterParams(event)
  const connector = getConnector(id)
  const body = await readBody(event)
  const task = await connector.updateTask(decodeURIComponent(taskId), body)
  return {
    task: {
      ...task,
      connectorName: connector.name,
      connectorIcon: connector.icon,
      capabilities: connector.capabilities,
    },
  }
})

