export default defineEventHandler(async (event) => {
    const { connectorId, taskId } = await readBody(event)

    await setActiveWorkspaceTask(
        getProjectPath(),
        connectorId && taskId ? { connectorId, taskId } : null,
    )

    return resolveWorkspace(getProjectPath())
})
