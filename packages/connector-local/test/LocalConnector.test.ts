import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { initBridge } from '@dynamia-tools/ide-bridge'
import { NodeBridge } from '@dynamia-tools/ide-bridge/node'
import { tmpdir } from 'node:os'
import { LocalConnector } from '../src/LocalConnector.js'

let root: string
let dir: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'dynamia-local-'))
  dir = join(root, '.dynamia', 'tasks')
  mkdirSync(dir, { recursive: true })
  initBridge(new NodeBridge({ projectPath: root }))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const backlog = () => join(dir, 'backlog.json')

describe('LocalConnector', () => {
  it('createTask appends to the existing backlog', async () => {
    const c = new LocalConnector(root)
    await c.createTask({ title: 'one' })
    await c.createTask({ title: 'two' })
    expect(JSON.parse(readFileSync(backlog(), 'utf8')).map((t: { title: string }) => t.title)).toEqual(['one', 'two'])
  })

  it('createTask refuses to overwrite a corrupt backlog.json', async () => {
    writeFileSync(backlog(), '[{"id":"local-1","title":"precious"')
    const c = new LocalConnector(root)
    await expect(c.createTask({ title: 'new' })).rejects.toThrow(/not valid JSON/)
    expect(readFileSync(backlog(), 'utf8')).toBe('[{"id":"local-1","title":"precious"')
  })

  it('concurrent createTask calls do not lose tasks', async () => {
    const c = new LocalConnector(root)
    await Promise.all(Array.from({ length: 8 }, (_, i) => c.createTask({ title: `t${i}` })))
    expect(JSON.parse(readFileSync(backlog(), 'utf8'))).toHaveLength(8)
  })

  it('addComment refuses to overwrite a corrupt comments.json', async () => {
    const file = join(dir, 'comments.json')
    writeFileSync(file, '{ broken')
    const c = new LocalConnector(root)
    await expect(c.addComment('local-1', 'hi')).rejects.toThrow(/not valid JSON/)
    expect(readFileSync(file, 'utf8')).toBe('{ broken')
  })

  it('does not treat workspace.json or comments.json as task lists', async () => {
    writeFileSync(join(dir, 'workspace.json'), JSON.stringify({ items: [] }))
    writeFileSync(join(dir, 'comments.json'), JSON.stringify({}))
    const c = new LocalConnector(root)
    await c.createTask({ title: 'only' })
    expect(await c.fetchTasks()).toHaveLength(1)
  })

  it('skips a corrupt list when reading but keeps the others', async () => {
    writeFileSync(join(dir, 'bad.json'), '{ nope')
    const c = new LocalConnector(root)
    await c.createTask({ title: 'ok' })
    expect(await c.fetchTasks()).toHaveLength(1)
  })
})
