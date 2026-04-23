export default defineEventHandler(async (event) => {
  const { items } = await readBody(event)
  await reorderWorkspace(getProjectPath(), items)
  return resolveWorkspace(getProjectPath())
})
