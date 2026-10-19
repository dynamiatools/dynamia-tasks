import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { isTaskListFile, migrateLegacyState, tasksDir } from '../src/tasksDir.js'
import { TaskService } from '../src/TaskService.js'
import { useTempProject } from './helpers.js'

let project: ReturnType<typeof useTempProject>
beforeEach(() => { project = useTempProject() })
afterEach(() => project.cleanup())

describe('isTaskListFile', () => {
  it('accepts task lists and rejects state files and non-json', () => {
    expect(isTaskListFile('backlog.json')).toBe(true)
    expect(isTaskListFile('workspace.json')).toBe(false)
    expect(isTaskListFile('comments.json')).toBe(false)
    expect(isTaskListFile('notes.md')).toBe(false)
  })
})

describe('migrateLegacyState', () => {
  it('copies legacy files, keeps the originals and never overwrites existing ones', async () => {
    const { root } = project
    mkdirSync(join(root, '.tasks'))
    mkdirSync(join(root, '.dynamiatasks'))
    mkdirSync(tasksDir(root), { recursive: true })
    writeFileSync(join(root, '.tasks', 'backlog.json'), '["legacy"]')
    writeFileSync(join(root, '.tasks', 'other.json'), '["other"]')
    writeFileSync(join(root, '.dynamiatasks', 'workspace.json'), '{"legacy":true}')
    writeFileSync(join(tasksDir(root), 'backlog.json'), '["current"]')

    await migrateLegacyState(root)

    expect(readFileSync(join(tasksDir(root), 'backlog.json'), 'utf8')).toBe('["current"]')
    expect(readFileSync(join(tasksDir(root), 'other.json'), 'utf8')).toBe('["other"]')
    expect(readFileSync(join(tasksDir(root), 'workspace.json'), 'utf8')).toBe('{"legacy":true}')
    expect(existsSync(join(root, '.tasks', 'backlog.json'))).toBe(true)
  })
})

describe('TaskService workspace file', () => {
  it('does not wipe a corrupt workspace.json when a write is attempted', async () => {
    const { root } = project
    mkdirSync(tasksDir(root), { recursive: true })
    const file = join(tasksDir(root), 'workspace.json')
    writeFileSync(file, '{ not json')

    const svc = new TaskService()
    await expect(svc.addToWorkspace('local', 'local-1')).rejects.toThrow(/not valid JSON/)
    expect(readFileSync(file, 'utf8')).toBe('{ not json')
    // reading still works (empty view) instead of crashing the UI
    expect(await svc.loadWorkspace()).toEqual({ items: [], activeTask: null })
  })

  it('writes workspace.json under .dynamia/tasks', async () => {
    const svc = new TaskService()
    await svc.addToWorkspace('local', 'local-1')
    const ws = JSON.parse(readFileSync(join(tasksDir(project.root), 'workspace.json'), 'utf8'))
    expect(ws.items).toHaveLength(1)
  })
})

describe('TaskService.init', () => {
  const stub = (id: string, configure: (c: unknown) => Promise<void>) => ({
    id, name: id, icon: '', capabilities: {} as never,
    isConfigured: async () => true, configure, getConfigSchema: () => ({ fields: [] }),
    fetchTasks: async () => [], getTask: async () => { throw new Error('n/a') },
    updateTask: async () => { throw new Error('n/a') }, createTask: async () => { throw new Error('n/a') },
  })

  it('keeps configuring the other connectors when one throws', async () => {
    const svc = new TaskService()
    await svc.saveConfig({ connectors: { bad: { a: 1 }, good: { b: 2 } }, ui: { theme: 'dark', groupBy: 'module', defaultView: 'workspace' } })
    const configured: string[] = []
    svc.register(stub('bad', async () => { throw new Error('keychain unavailable') }))
    svc.register(stub('good', async () => { configured.push('good') }))
    await expect(svc.init()).resolves.toBeUndefined()
    expect(configured).toEqual(['good'])
  })
})
