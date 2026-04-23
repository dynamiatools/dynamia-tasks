import Fastify from 'fastify'
import cors from '@fastify/cors'
import staticPlugin from '@fastify/static'
import fs from 'node:fs/promises'
import type { TaskFilter } from '@dynamia-tasks/core'
import { getConnector, listConnectors } from './connectors/registry.js'
import { readConfig, writeConfig, readCache, writeCache, writeInstancePort, removeInstancePort } from './config.js'
import {
  resolveWorkspace,
  addToWorkspace,
  removeFromWorkspace,
  reorderWorkspace,
} from './workspace.js'

export interface ServerOptions {
  port: number
  projectPath: string
  ideCallbackUrl?: string
  spaPath?: string
}

export async function startServer(options: ServerOptions): Promise<void> {
  const { port, projectPath, ideCallbackUrl, spaPath } = options

  // Configure LocalConnector with projectPath
  try {
    const localConnector = getConnector('local')
    await localConnector.configure({ projectPath })
  } catch { /* ignore */ }

  // Configure connectors from saved config
  const config = await readConfig()
  for (const [id, connectorConfig] of Object.entries(config.connectors)) {
    try {
      const connector = getConnector(id)
      await connector.configure(connectorConfig)
    } catch { /* connector not registered */ }
  }

  const fastify = Fastify({ logger: { level: 'warn' } })

  await fastify.register(cors, { origin: true })

  // Serve SPA static files if path is provided
  if (spaPath) {
    try {
      await fs.access(spaPath)
      await fastify.register(staticPlugin, { root: spaPath, prefix: '/', wildcard: false })
      // SPA fallback: serve index.html for any non-API route not matched as a file
      fastify.setNotFoundHandler((req, reply) => {
        if (req.url.startsWith('/api/')) {
          reply.code(404).send({ error: true, message: 'API endpoint not found' })
        } else {
          reply.sendFile('index.html')
        }
      })
    } catch { /* SPA not built yet */ }
  }

  // ── Error handler ────────────────────────────────────────────────────────────
  fastify.setErrorHandler((error, _req, reply) => {
    const code = (error as any).code ?? 'INTERNAL_ERROR'
    reply.status(500).send({ error: true, message: error.message, code })
  })

  // ── GET /api/connectors ──────────────────────────────────────────────────────
  fastify.get('/api/connectors', async () => {
    const connectors = await Promise.all(
      listConnectors().map(async c => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        capabilities: c.capabilities,
        configured: await c.isConfigured(),
      }))
    )
    return { connectors }
  })

  // ── GET /api/connectors/:id/schema ───────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/api/connectors/:id/schema', async (req) => {
    const connector = getConnector(req.params.id)
    return connector.getConfigSchema()
  })

  // ── GET /api/connectors/:id/configured ──────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/api/connectors/:id/configured', async (req) => {
    const connector = getConnector(req.params.id)
    return { configured: await connector.isConfigured() }
  })

  // ── GET /api/config ──────────────────────────────────────────────────────────
  fastify.get('/api/config', async () => readConfig())

  // ── PUT /api/config ──────────────────────────────────────────────────────────
  fastify.put('/api/config', async (req) => {
    const config = req.body as any
    await writeConfig(config)
    // Re-configure connectors
    for (const [id, connectorConfig] of Object.entries(config.connectors ?? {})) {
      try {
        const connector = getConnector(id)
        await connector.configure(connectorConfig)
      } catch { /* ignore */ }
    }
    return { ok: true }
  })

  // ── GET /api/config/connectors/:id ──────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/api/config/connectors/:id', async (req) => {
    const config = await readConfig()
    return config.connectors[req.params.id] ?? {}
  })

  // ── PUT /api/config/connectors/:id ──────────────────────────────────────────
  fastify.put<{ Params: { id: string } }>('/api/config/connectors/:id', async (req) => {
    const config = await readConfig()
    config.connectors[req.params.id] = req.body
    await writeConfig(config)
    try {
      const connector = getConnector(req.params.id)
      await connector.configure(req.body)
    } catch { /* ignore */ }
    return { ok: true }
  })

  // ── GET /api/connectors/:id/tasks ────────────────────────────────────────────
  fastify.get<{ Params: { id: string }; Querystring: TaskFilter }>('/api/connectors/:id/tasks', async (req) => {
    const connector = getConnector(req.params.id)
    if (!await connector.isConfigured()) {
      return { error: true, code: 'CONNECTOR_NOT_CONFIGURED', message: 'Connector is not configured', tasks: [] }
    }
    try {
      const tasks = await connector.fetchTasks(req.query)
      await writeCache(connector.id, tasks)
      return { tasks, cached: false }
    } catch (e: any) {
      if (e.code === 'UPSTREAM_RATE_LIMITED' || e.code === 'UPSTREAM_AUTH_FAILED') {
        const cached = await readCache(connector.id)
        if (cached) return { tasks: cached.data, cached: true, cachedAt: cached.ts, code: 'CACHE_ONLY' }
      }
      throw e
    }
  })

  // ── GET /api/connectors/:id/tasks/:taskId ────────────────────────────────────
  fastify.get<{ Params: { id: string; taskId: string } }>('/api/connectors/:id/tasks/:taskId', async (req) => {
    const connector = getConnector(req.params.id)
    const task = await connector.getTask(decodeURIComponent(req.params.taskId))
    const taskView = {
      ...task,
      connectorName: connector.name,
      connectorIcon: connector.icon,
      capabilities: connector.capabilities,
    }
    return { task: taskView }
  })

  // ── POST /api/connectors/:id/tasks ───────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>('/api/connectors/:id/tasks', async (req, reply) => {
    const connector = getConnector(req.params.id)
    if (!connector.capabilities.canCreate) {
      return reply.code(405).send({ error: true, code: 'CAPABILITY_NOT_SUPPORTED', message: 'Connector cannot create tasks' })
    }
    const task = await connector.createTask(req.body as any)
    return { task }
  })

  // ── PATCH /api/connectors/:id/tasks/:taskId ──────────────────────────────────
  fastify.patch<{ Params: { id: string; taskId: string } }>('/api/connectors/:id/tasks/:taskId', async (req) => {
    const connector = getConnector(req.params.id)
    const task = await connector.updateTask(decodeURIComponent(req.params.taskId), req.body as any)
    return {
      task: {
        ...task,
        connectorName: connector.name,
        connectorIcon: connector.icon,
        capabilities: connector.capabilities,
      }
    }
  })

  // ── DELETE /api/connectors/:id/tasks/:taskId ─────────────────────────────────
  fastify.delete<{ Params: { id: string; taskId: string } }>('/api/connectors/:id/tasks/:taskId', async (req, reply) => {
    const connector = getConnector(req.params.id)
    if (!connector.capabilities.canDelete || !connector.deleteTask) {
      return reply.code(405).send({ error: true, code: 'CAPABILITY_NOT_SUPPORTED', message: 'Connector cannot delete tasks' })
    }
    await connector.deleteTask(decodeURIComponent(req.params.taskId))
    return { ok: true }
  })

  // ── GET /api/connectors/:id/tasks/:taskId/comments ──────────────────────────
  fastify.get<{ Params: { id: string; taskId: string } }>('/api/connectors/:id/tasks/:taskId/comments', async (req, reply) => {
    const connector = getConnector(req.params.id)
    if (!connector.capabilities.canComment || !connector.fetchComments) {
      return reply.code(405).send({ error: true, code: 'CAPABILITY_NOT_SUPPORTED' })
    }
    const comments = await connector.fetchComments(decodeURIComponent(req.params.taskId))
    return { comments }
  })

  // ── POST /api/connectors/:id/tasks/:taskId/comments ─────────────────────────
  fastify.post<{ Params: { id: string; taskId: string } }>('/api/connectors/:id/tasks/:taskId/comments', async (req, reply) => {
    const connector = getConnector(req.params.id)
    if (!connector.capabilities.canComment || !connector.addComment) {
      return reply.code(405).send({ error: true, code: 'CAPABILITY_NOT_SUPPORTED' })
    }
    const comment = await connector.addComment(decodeURIComponent(req.params.taskId), (req.body as any).body)
    return { comment }
  })

  // ── GET /api/connectors/:id/tasks/:taskId/subtasks ───────────────────────────
  fastify.get<{ Params: { id: string; taskId: string } }>('/api/connectors/:id/tasks/:taskId/subtasks', async (req, reply) => {
    const connector = getConnector(req.params.id)
    if (!connector.capabilities.canSubtasks || !connector.fetchSubtasks) {
      return reply.code(405).send({ error: true, code: 'CAPABILITY_NOT_SUPPORTED' })
    }
    const subtasks = await connector.fetchSubtasks(decodeURIComponent(req.params.taskId))
    return { subtasks }
  })

  // ── POST /api/connectors/:id/tasks/:taskId/subtasks ──────────────────────────
  fastify.post<{ Params: { id: string; taskId: string } }>('/api/connectors/:id/tasks/:taskId/subtasks', async (req, reply) => {
    const connector = getConnector(req.params.id)
    if (!connector.capabilities.canSubtasks || !connector.addSubtask) {
      return reply.code(405).send({ error: true, code: 'CAPABILITY_NOT_SUPPORTED' })
    }
    await connector.addSubtask(decodeURIComponent(req.params.taskId), (req.body as any).childId)
    return { ok: true }
  })

  // ── DELETE /api/connectors/:id/tasks/:taskId/subtasks/:childId ───────────────
  fastify.delete<{ Params: { id: string; taskId: string; childId: string } }>(
    '/api/connectors/:id/tasks/:taskId/subtasks/:childId',
    async (req, reply) => {
      const connector = getConnector(req.params.id)
      if (!connector.capabilities.canSubtasks || !connector.removeSubtask) {
        return reply.code(405).send({ error: true, code: 'CAPABILITY_NOT_SUPPORTED' })
      }
      await connector.removeSubtask(
        decodeURIComponent(req.params.taskId),
        decodeURIComponent(req.params.childId)
      )
      return { ok: true }
    }
  )

  // ── GET /api/connectors/:id/labels ──────────────────────────────────────────
  fastify.get<{ Params: { id: string }; Querystring: { sourceId?: string } }>('/api/connectors/:id/labels', async (req) => {
    const connector = getConnector(req.params.id)
    if (typeof (connector as any).fetchLabels !== 'function') return { labels: [] }
    const labels = await (connector as any).fetchLabels(req.query.sourceId)
    return { labels }
  })

  // ── GET /api/connectors/:id/sources ─────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/api/connectors/:id/sources', async (req, reply) => {
    const connector = getConnector(req.params.id)
    if (!connector.capabilities.hasExplorer || !connector.fetchSources) {
      return reply.code(405).send({ error: true, code: 'CAPABILITY_NOT_SUPPORTED' })
    }
    const sources = await connector.fetchSources()
    return { sources }
  })

  // ── POST /api/connectors/:id/probe-sources ───────────────────────────────────
  // Fetch sources using a provisional config (e.g. token not yet saved) — used by Settings UI
  fastify.post<{ Params: { id: string } }>('/api/connectors/:id/probe-sources', async (req, reply) => {
    const connector = getConnector(req.params.id)
    if (!connector.capabilities.hasExplorer) {
      return reply.code(405).send({ error: true, code: 'CAPABILITY_NOT_SUPPORTED' })
    }
    // GithubConnector exposes fetchSourcesWithToken
    const c = connector as any
    if (typeof c.fetchSourcesWithToken === 'function') {
      const { token, orgs } = req.body as any
      const sources = await c.fetchSourcesWithToken(token, orgs ?? [])
      return { sources }
    }
    return reply.code(405).send({ error: true, code: 'CAPABILITY_NOT_SUPPORTED' })
  })

  // ── GET /api/workspace ───────────────────────────────────────────────────────
  fastify.get('/api/workspace', async () => {
    return resolveWorkspace(projectPath)
  })

  // ── POST /api/workspace/add ──────────────────────────────────────────────────
  fastify.post('/api/workspace/add', async (req) => {
    const { connectorId, taskId } = req.body as { connectorId: string; taskId: string }
    await addToWorkspace(projectPath, connectorId, taskId)
    return resolveWorkspace(projectPath)
  })

  // ── DELETE /api/workspace/:connectorId/:taskId ───────────────────────────────
  fastify.delete<{ Params: { connectorId: string; taskId: string } }>(
    '/api/workspace/:connectorId/:taskId',
    async (req) => {
      await removeFromWorkspace(projectPath, req.params.connectorId, decodeURIComponent(req.params.taskId))
      return resolveWorkspace(projectPath)
    }
  )

  // ── PATCH /api/workspace/reorder ────────────────────────────────────────────
  fastify.patch('/api/workspace/reorder', async (req) => {
    const { items } = req.body as any
    await reorderWorkspace(projectPath, items)
    return resolveWorkspace(projectPath)
  })

  // ── GET /api/proxy/image ─────────────────────────────────────────────────────
  // Proxies GitHub user-attachment images using the stored GitHub token so the
  // browser does not need to send credentials directly to GitHub.
  fastify.get<{ Querystring: { url: string; connectorId?: string } }>('/api/proxy/image', async (req, reply) => {
    const { url, connectorId = 'github' } = req.query
    if (!url) return reply.code(400).send({ error: true, message: 'url is required' })

    // Only proxy GitHub URLs to avoid open-proxy abuse
    if (!/^https:\/\/(.*\.)?github(usercontent)?\.com\//i.test(url) &&
        !url.startsWith('https://github.com/user-attachments/')) {
      return reply.code(403).send({ error: true, message: 'Only GitHub URLs can be proxied' })
    }

    const headers: Record<string, string> = {
      'User-Agent': 'dynamia-tasks',
    }

    // Attach auth token if available from the connector config
    try {
      const connConfig = await readConfig()
      const token = (connConfig.connectors[connectorId] as any)?.token
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    } catch { /* ignore */ }

    const upstream = await fetch(url, { headers })
    if (!upstream.ok) {
      return reply.code(upstream.status).send({ error: true, message: `Upstream error: ${upstream.status}` })
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/png'
    const buffer = Buffer.from(await upstream.arrayBuffer())

    reply
      .header('Content-Type', contentType)
      .header('Cache-Control', 'public, max-age=86400')
      .send(buffer)
  })

  // ── GET /api/instance ────────────────────────────────────────────────────────
  // Returns runtime info (port, projectPath, pid). Useful for IDE plugins
  // that need to discover the actual port after auto-selection.
  fastify.get('/api/instance', async () => ({
    port,
    projectPath,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  }))

  // ── POST /api/ide/open-file ──────────────────────────────────────────────────
  fastify.post('/api/ide/open-file', async (req) => {
    if (!ideCallbackUrl) return { ok: false, message: 'No IDE callback configured' }
    const res = await fetch(`${ideCallbackUrl}/ide/open-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })
    return res.json()
  })

  // ── POST /api/ide/notify ─────────────────────────────────────────────────────
  fastify.post('/api/ide/notify', async (req) => {
    if (!ideCallbackUrl) return { ok: false, message: 'No IDE callback configured' }
    const res = await fetch(`${ideCallbackUrl}/ide/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })
    return res.json()
  })

  await fastify.listen({ port, host: '127.0.0.1' })

  // Persist port so IDE plugins can discover it
  await writeInstancePort(projectPath, port)

  // Clean up instance file on graceful shutdown
  const cleanup = async () => {
    await removeInstancePort(projectPath)
    process.exit(0)
  }
  process.once('SIGINT', cleanup)
  process.once('SIGTERM', cleanup)

  console.log(`✓ dynamia-tasks server running on http://localhost:${port}`)
  console.log(`  projectPath: ${projectPath}`)
}



