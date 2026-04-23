export default defineEventHandler(async (event) => {
  const { id, taskId } = getRouterParams(event)
  const connector = getConnector(id)
  const task = await connector.getTask(decodeURIComponent(taskId))
  return {
    task: {
      ...task,
      connectorName: connector.name,
      connectorIcon: connector.icon,
      capabilities: connector.capabilities,
    },
  }
})

