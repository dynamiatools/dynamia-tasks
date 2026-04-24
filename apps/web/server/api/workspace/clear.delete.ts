export default defineEventHandler(async () => {
    await clearWorkspace(getProjectPath())
    return resolveWorkspace(getProjectPath())
})
