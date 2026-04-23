export default defineEventHandler(async () => {
  return resolveWorkspace(getProjectPath())
})
