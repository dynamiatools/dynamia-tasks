export default defineEventHandler(async (event) => {
  const body = await readBody<{ items?: Array<{ connectorId: string; taskId: string; order?: number; addedAt?: string }> }>(event)
  const incoming = body.items ?? []
  const existing = await readWorkspace(getProjectPath())
  const existingByKey = new Map(existing.items.map(item => [`${item.connectorId}:${item.taskId}`, item]))

  const normalizedItems = incoming.map((item, index) => {
    const key = `${item.connectorId}:${item.taskId}`
    const prev = existingByKey.get(key)
    return {
      connectorId: item.connectorId,
      taskId: item.taskId,
      addedAt: item.addedAt ?? prev?.addedAt ?? new Date().toISOString(),
      order: item.order ?? index,
    }
  })

  await reorderWorkspace(getProjectPath(), normalizedItems)
  return resolveWorkspace(getProjectPath())
})
