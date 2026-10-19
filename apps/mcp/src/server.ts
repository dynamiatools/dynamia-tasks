import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { LocalConnector } from '@dynamia-tasks/connector-local'
import { taskService } from '@dynamia-tasks/core'
import type { ConnectorTask } from '@dynamia-tasks/core'
import { NOT_ACTIVE_MESSAGE } from './project.js'
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

/**
 * Builds the server; the caller owns the transport. Expects the ide-bridge to be initialised.
 * Without a project (no .dynamia/tasks/) it exposes no tools and only says Dynamia Tasks is not active.
 */
export function createServer(projectPath: string | null): McpServer {
  if (!projectPath) {
    return new McpServer({ name: 'dynamia-tasks', version: VERSION }, { instructions: NOT_ACTIVE_MESSAGE })
  }
  const local = new LocalConnector(projectPath)
  const server = new McpServer({ name: 'dynamia-tasks', version: VERSION })

  server.registerTool('list_tasks', {
    description: 'List the project\'s local tasks (.dynamia/tasks). Returns a short summary of each; use get_task for the full text.',
    inputSchema: {
      status: z.enum(['open', 'closed', 'all']).default('open'),
      query: z.string().optional().describe('Case-insensitive text to find in the title'),
      labels: z.array(z.string()).optional().describe('Match tasks that have any of these labels'),
      priority: z.array(priority).optional().describe('Match tasks with any of these priorities'),
    },
  }, guarded(async ({ status, query, labels, priority: priorities }) =>
    (await local.fetchTasks({ status, query, labels }))
      .filter(t => !priorities?.length || (t.priority !== undefined && priorities.includes(t.priority)))
      .map(summary)))

  server.registerTool('get_task', {
    description: 'Get one task in full, including its comments.',
    inputSchema: { id: z.string() },
  }, guarded(async ({ id }) => ({
    ...(await local.getTask(id)),
    comments: await local.fetchComments(id),
  })))

  server.registerTool('create_task', {
    description: 'Create a task in backlog.json and add it to the workspace list. Labels are created by naming them.',
    inputSchema: {
      title: z.string().min(1),
      description: z.string().optional().describe('Markdown'),
      module: z.string().optional(),
      labels: z.array(z.string()).optional(),
      priority: priority.optional(),
    },
  }, guarded(async args => {
    const task = await local.createTask(args)
    await taskService.addToWorkspace('local', task.id)
    return task
  }))

  server.registerTool('update_task', {
    description: 'Change a task. Omitted fields stay as they are. done=true completes it (false reopens it). priority=null clears it. labels replaces all labels; addLabels/removeLabels change some without touching the rest. New label names are created on the fly.',
    inputSchema: {
      id: z.string(),
      title: z.string().min(1).optional(),
      description: z.string().optional().describe('Markdown'),
      done: z.boolean().optional(),
      module: z.string().optional(),
      priority: priority.nullable().optional(),
      labels: z.array(z.string()).optional(),
      addLabels: z.array(z.string()).optional(),
      removeLabels: z.array(z.string()).optional(),
    },
  }, guarded(async ({ id, priority: prio, labels, addLabels, removeLabels, ...rest }) => {
    let nextLabels = labels
    if (addLabels?.length || removeLabels?.length) {
      // shortcut: read-then-write, so a concurrent label edit between the two calls is lost; fine for a single local user.
      const current = labels ?? (await local.getTask(id)).labels?.map(l => l.name) ?? []
      nextLabels = [...new Set([...current, ...(addLabels ?? [])])].filter(l => !removeLabels?.includes(l))
    }
    return local.updateTask(id, {
      ...rest,
      labels: nextLabels,
      ...(prio !== undefined && { priority: prio ?? undefined }),
    })
  }))

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
