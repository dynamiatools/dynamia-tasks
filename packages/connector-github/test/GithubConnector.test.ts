import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GithubConnector } from '../src/GithubConnector.js'

const issue = (number: number, title: string, extra: object = {}) => ({
  number, title, body: null, state: 'open', labels: [], assignees: [], user: null,
  comments: 0, created_at: 'x', updated_at: 'x', ...extra,
})

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init })

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

async function connector(config: object = { token: 't', repos: ['o/a'] }) {
  const c = new GithubConnector()
  await c.configure(config)
  return c
}

describe('fetchTasks', () => {
  it('url-encodes labels and sends only supported query params', async () => {
    fetchMock.mockResolvedValue(json([]))
    await (await connector()).fetchTasks({ labels: ['a&b', 'c d'], status: 'closed' })
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe('/repos/o/a/issues')
    expect(url.searchParams.get('labels')).toBe('a&b,c d')
    expect(url.searchParams.get('state')).toBe('closed')
    expect(url.searchParams.has('q')).toBe(false)
    expect(url.searchParams.has('pulls')).toBe(false)
  })

  it('filters by text locally and drops pull requests', async () => {
    fetchMock.mockResolvedValue(json([issue(1, 'Fix login'), issue(2, 'Other'), issue(3, 'login PR', { pull_request: {} })]))
    const tasks = await (await connector()).fetchTasks({ query: 'LOGIN' })
    expect(tasks.map(t => t.id)).toEqual(['1@o/a'])
  })

  it('keeps repo order even when responses arrive out of order', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const slow = url.includes('/o/a/')
      await new Promise(r => setTimeout(r, slow ? 30 : 0))
      return json([issue(1, slow ? 'from a' : 'from b')])
    })
    const tasks = await (await connector({ token: 't', repos: ['o/a', 'o/b'] })).fetchTasks()
    expect(tasks.map(t => t.title)).toEqual(['from a', 'from b'])
  })

  it('skips a malformed configured repo instead of failing everything', async () => {
    fetchMock.mockResolvedValue(json([issue(1, 'ok')]))
    const tasks = await (await connector({ token: 't', repos: ['broken', 'o/a'] })).fetchTasks()
    expect(tasks).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns nothing without a token', async () => {
    expect(await (await connector({ repos: ['o/a'] })).fetchTasks()).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces the error when a single source was requested', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 404, statusText: 'Not Found' }))
    await expect((await connector()).fetchTasks({ sourceId: 'o/a' })).rejects.toThrow(/Unable to load issues for o\/a/)
  })
})

describe('error mapping', () => {
  it('403 with an exhausted rate limit is UPSTREAM_RATE_LIMITED', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }))
    await expect((await connector()).getTask('1@o/a')).rejects.toMatchObject({ code: 'UPSTREAM_RATE_LIMITED' })
  })

  it('a plain 403 is a permissions problem, not a rate limit', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 403 }))
    await expect((await connector()).getTask('1@o/a')).rejects.toMatchObject({ code: 'UPSTREAM_FORBIDDEN' })
  })

  it('401 is UPSTREAM_AUTH_FAILED and a missing token never reaches the network', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }))
    await expect((await connector()).getTask('1@o/a')).rejects.toMatchObject({ code: 'UPSTREAM_AUTH_FAILED' })
    fetchMock.mockClear()
    await expect((await connector({})).getTask('1@o/a')).rejects.toMatchObject({ code: 'UPSTREAM_AUTH_FAILED' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('ids and repos', () => {
  it('rejects malformed task ids and repos before building a URL', async () => {
    const c = await connector()
    await expect(c.getTask('nope')).rejects.toThrow(/Invalid GitHub task id/)
    await expect(c.getTask('1@o/a/../../x')).rejects.toThrow(/Invalid repository/)
    await expect(c.createTask({ title: 't', sourceId: '../x' })).rejects.toThrow(/Invalid repository/)
    await expect(c.createTask({ title: 't', sourceId: 'o/..' })).rejects.toThrow(/Invalid repository/)
    await expect(c.fetchLabels('./x')).rejects.toThrow(/Invalid repository/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
