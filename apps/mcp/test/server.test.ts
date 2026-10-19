import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync, readFileSync } from 'node:fs'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { initBridge } from '@dynamia-tools/ide-bridge'
import { NodeBridge } from '@dynamia-tools/ide-bridge/node'
import { findProjectRoot, NOT_ACTIVE_MESSAGE } from '../src/project.js'
import { createServer } from '../src/server.js'

let root: string
let client: Client

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'dynamia-mcp-'))
  mkdirSync(join(root, '.dynamia', 'tasks'), { recursive: true })
  initBridge(new NodeBridge({ projectPath: root }))
  const [a, b] = InMemoryTransport.createLinkedPair()
  await createServer(root).connect(a)
  client = new Client({ name: 'test', version: '0' })
  await client.connect(b)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

async function call(name: string, args: Record<string, unknown> = {}) {
  const res = await client.callTool({ name, arguments: args })
  const text = (res.content as { text: string }[])[0].text
  return { isError: res.isError === true, text, json: () => JSON.parse(text) }
}

describe('dynamia-tasks MCP', () => {
  it('exposes the task tools', async () => {
    const names = (await client.listTools()).tools.map(t => t.name).sort()
    expect(names).toEqual(['add_comment', 'add_github_issue_to_workspace', 'create_task', 'delete_task', 'get_task', 'list_labels', 'list_tasks', 'update_task'])
  })

  it('creates, lists, completes and deletes a task', async () => {
    const created = (await call('create_task', { title: 'ship mcp', labels: ['mcp'], priority: 'high' })).json()
    expect(created.title).toBe('ship mcp')

    expect((await call('list_tasks')).json().map((t: { title: string }) => t.title)).toEqual(['ship mcp'])

    await call('update_task', { id: created.id, done: true })
    expect((await call('list_tasks')).json()).toEqual([])
    expect((await call('list_tasks', { status: 'closed' })).json()).toHaveLength(1)

    await call('delete_task', { id: created.id })
    expect((await call('list_tasks', { status: 'all' })).json()).toEqual([])
  })

  it('adds comments and returns them with the task', async () => {
    const { id } = (await call('create_task', { title: 'talk' })).json()
    await call('add_comment', { id, body: 'hello' })
    expect((await call('get_task', { id })).json().comments.map((c: { body: string }) => c.body)).toEqual(['hello'])
  })

  it('reports unknown ids as tool errors, not crashes', async () => {
    const res = await call('get_task', { id: 'nope' })
    expect(res.isError).toBe(true)
    expect(res.text).toContain('Task not found')
    expect((await call('add_comment', { id: 'nope', body: 'x' })).isError).toBe(true)
  })

  it('lists labels', async () => {
    await call('create_task', { title: 'a', labels: ['bug', 'api'] })
    expect((await call('list_labels')).json().map((l: { name: string }) => l.name)).toEqual(['api', 'bug'])
  })

  it('adds a GitHub issue to the workspace once, by repo and number', async () => {
    await call('add_github_issue_to_workspace', { repo: 'dynamiatools/dynamia-tasks', number: 7 })
    await call('add_github_issue_to_workspace', { repo: 'dynamiatools/dynamia-tasks', number: 7 })
    const ws = JSON.parse(readFileSync(join(root, '.dynamia', 'tasks', 'workspace.json'), 'utf8'))
    expect(ws.items.map((i: { connectorId: string; taskId: string }) => [i.connectorId, i.taskId]))
      .toEqual([['github', '7@dynamiatools/dynamia-tasks']])
  })

  it('rejects a malformed repo', async () => {
    const res = await client.callTool({ name: 'add_github_issue_to_workspace', arguments: { repo: 'nope', number: 1 } })
    expect(res.isError).toBe(true)
  })

  it('finds the project root from a subfolder, and nothing outside a project', () => {
    const sub = join(root, 'src', 'deep')
    mkdirSync(sub, { recursive: true })
    expect(findProjectRoot(sub)).toBe(root)
    const bare = mkdtempSync(join(tmpdir(), 'dynamia-bare-'))
    try { expect(findProjectRoot(bare)).toBeNull() } finally { rmSync(bare, { recursive: true, force: true }) }
  })

  it('is inert without a project: no tools, says Dynamia Tasks is not active', async () => {
    const [a, b] = InMemoryTransport.createLinkedPair()
    await createServer(null).connect(a)
    const c = new Client({ name: 'test', version: '0' })
    await c.connect(b)
    expect(c.getServerCapabilities()?.tools).toBeUndefined()
    expect(c.getInstructions()).toBe(NOT_ACTIVE_MESSAGE)
  })
})
