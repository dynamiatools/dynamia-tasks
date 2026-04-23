export default defineEventHandler(async (event) => {
  const { url, connectorId = 'github' } = getQuery(event) as { url: string; connectorId?: string }

  if (!url) {
    throw createError({ statusCode: 400, message: 'url is required' })
  }

  if (!/^https:\/\/(.*\.)?github(usercontent)?\.com\//i.test(url) &&
      !url.startsWith('https://github.com/user-attachments/')) {
    throw createError({ statusCode: 403, message: 'Only GitHub URLs can be proxied' })
  }

  const headers: Record<string, string> = { 'User-Agent': 'dynamia-tasks' }

  try {
    const cfg = await readConfig()
    const token = (cfg.connectors[connectorId] as any)?.token
    if (token) headers['Authorization'] = `Bearer ${token}`
  } catch { /* ignore */ }

  const upstream = await fetch(url, { headers })
  if (!upstream.ok) {
    throw createError({ statusCode: upstream.status, message: `Upstream error: ${upstream.status}` })
  }

  const contentType = upstream.headers.get('content-type') ?? 'image/png'
  const buffer = Buffer.from(await upstream.arrayBuffer())

  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  return send(event, buffer)
})

