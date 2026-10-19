import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { LocalConnector } from '@dynamia-tasks/connector-local'
import { taskService } from '@dynamia-tasks/core'
import type { ConnectorTask } from '@dynamia-tasks/core'
import { VERSION } from './version.js'

const priority = z.enum(['high', 'medium', 'low'])

const text = (value: unknown) => ({
  content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
})

/** Tool failures go back to the agent as `isError` results instead of killing the call. */
const guarded = <A>(fn: (args: A) => Promise<unknown>) => async (args: A) => {
  try {
    return text(await fn(args))
  } catch (e) {
    return { ...text((e as Error).message), isError: true }
  }
}

const summary = (t: ConnectorTask) => ({
  id: t.id,
  title: t.title,
  done: t.done,
  priority: t.priority,
  module: t.module,
  labels: t.labels?.map(l => l.name),
})

/** Builds the server; the caller owns the transport. Expects the ide-bridge to be initialised. */
export function createServer(projectPath: string): McpServer {
  const local = new LocalConnector(projectPath)
  const server = new McpServer({ name: 'dynamia-tasks', version: VERSION })

  server.registerTool('list_tasks', {
    description: 'List the project\'s local tasks (.dynamia/tasks). Returns a short summary of each; use get_task for the full text.',
    inputSchema: {
      status: z.enum(['open', 'closed', 'all']).default('open'),
      query: z.string().optional().describe('Case-insensitive text to find in the title'),
      labels: z.array(z.string()).optional().describe('Match tasks that have any of these labels'),
    },
  }, guarded(async ({ status, query, labels }) =>
    (await local.fetchTasks({ status, query, labels })).map(summary)))

  server.registerTool('get_task', {
    description: 'Get one task in full, including its comments.',
    inputSchema: { id: z.string() },
  }, guarded(async ({ id }) => ({
    ...(await local.getTask(id)),
    comments: await local.fetchComments(id),
  })))

  server.registerTool('create_task', {
    description: 'Create a task in backlog.json.',
    inputSchema: {
      title: z.string().min(1),
      description: z.string().optional().describe('Markdown'),
      module: z.string().optional(),
      labels: z.array(z.string()).optional(),
      priority: priority.optional(),
    },
  }, guarded(args => local.createTask(args)))

  server.registerTool('update_task', {
    description: 'Change fields of a task. Omitted fields stay as they are; labels, when given, replace the old ones. Set done=true to complete it.',
    inputSchema: {
      id: z.string(),
      title: z.string().min(1).optional(),
      description: z.string().optional().describe('Markdown'),
      done: z.boolean().optional(),
      module: z.string().optional(),
      labels: z.array(z.string()).optional(),
      priority: priority.optional(),
    },
  }, guarded(({ id, ...patch }) => local.updateTask(id, patch)))

  server.registerTool('delete_task', {
    description: 'Permanently delete a task. Its comments are kept in comments.json.',
    inputSchema: { id: z.string() },
    annotations: { destructiveHint: true },
  }, guarded(async ({ id }) => {
    await local.deleteTask(id)
    return `Deleted ${id}`
  }))

  server.registerTool('add_comment', {
    description: 'Add a Markdown comment to a task.',
    inputSchema: { id: z.string(), body: z.string().min(1) },
  }, guarded(async ({ id, body }) => {
    await local.getTask(id) // comments.json is keyed by id; refuse ids that do not exist
    return local.addComment(id, body)
  }))

  server.registerTool('list_labels', {
    description: 'List the labels used across the project\'s tasks.',
    inputSchema: {},
  }, guarded(() => local.fetchLabels()))

  server.registerTool('add_github_issue_to_workspace', {
    description: 'Add a GitHub issue to the project\'s workspace list by repo and issue number. It only records the reference (no GitHub token or network needed); the IDE plugin loads the issue when it opens.',
    inputSchema: {
      repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'expected owner/repo').describe('owner/repo'),
      number: z.number().int().positive().describe('Issue number'),
    },
  }, guarded(async ({ repo, number }) => {
    await taskService.addToWorkspace('github', `${number}@${repo}`)
    return `Added ${repo}#${number} to the workspace`
  }))

  return server
}
