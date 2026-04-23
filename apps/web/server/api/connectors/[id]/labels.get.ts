export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const connector = getConnector(id)
  const { sourceId } = getQuery(event) as { sourceId?: string }

  if (typeof (connector as any).fetchLabels !== 'function') return { labels: [] }

  const labels = await (connector as any).fetchLabels(sourceId)
  return { labels }
})

