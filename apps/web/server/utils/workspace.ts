import fs from 'node:fs/promises'
import path from 'node:path'
import type { Workspace, WorkspaceActiveTask, WorkspaceItem, TaskView } from '@dynamia-tasks/core'

export async function readWorkspace(projectPath: string): Promise<Workspace> {
  const file = path.join(projectPath, '.dynamia', 'tasks', 'workspace.json')
  try {
    const raw = await fs.readFile(file, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Workspace>
    return {
      projectPath,
      items: parsed.items ?? [],
      activeTask: parsed.activeTask ?? null,
    }
  } catch {
    return { projectPath, items: [], activeTask: null }
  }
}

export async function writeWorkspace(ws: Workspace): Promise<void> {
  const dir = path.join(ws.projectPath, '.dynamia', 'tasks')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'workspace.json'), JSON.stringify(ws, null, 2), 'utf-8')
}

export async function resolveWorkspace(projectPath: string): Promise<{ items: TaskView[]; activeTask: WorkspaceActiveTask | null }> {
  const ws = await readWorkspace(projectPath)
  const resolved: TaskView[] = []

  for (const item of ws.items.sort((a, b) => a.order - b.order)) {
    try {
      const connector = getConnector(item.connectorId)
      const task = await connector.getTask(item.taskId)
      resolved.push({
        ...task,
        connectorName: connector.name,
        connectorIcon: connector.icon,
        capabilities: connector.capabilities,
      })
    } catch (e) {
      console.warn(`[workspace] Could not resolve ${item.connectorId}:${item.taskId}:`, (e as Error).message)
    }
  }

  const activeExists = ws.activeTask
    ? ws.items.some(i => i.connectorId === ws.activeTask?.connectorId && i.taskId === ws.activeTask?.taskId)
    : false

  return {
    items: resolved,
    activeTask: activeExists ? ws.activeTask : null,
  }
}

export async function addToWorkspace(projectPath: string, connectorId: string, taskId: string): Promise<void> {
  const ws = await readWorkspace(projectPath)
  if (ws.items.some(i => i.connectorId === connectorId && i.taskId === taskId)) return
  const item: WorkspaceItem = {
    connectorId,
    taskId,
    addedAt: new Date().toISOString(),
    order: ws.items.length,
  }
  ws.items.push(item)
  await writeWorkspace(ws)
}

export async function removeFromWorkspace(projectPath: string, connectorId: string, taskId: string): Promise<void> {
  const ws = await readWorkspace(projectPath)
  ws.items = ws.items.filter(i => !(i.connectorId === connectorId && i.taskId === taskId))
  if (ws.activeTask?.connectorId === connectorId && ws.activeTask.taskId === taskId) {
    ws.activeTask = null
  }
  ws.items.forEach((item, i) => { item.order = i })
  await writeWorkspace(ws)
}

export async function reorderWorkspace(projectPath: string, items: WorkspaceItem[]): Promise<void> {
  const ws = await readWorkspace(projectPath)
  ws.items = items
  await writeWorkspace(ws)
}

export async function clearWorkspace(projectPath: string): Promise<void> {
  const ws = await readWorkspace(projectPath)
  ws.items = []
  ws.activeTask = null
  await writeWorkspace(ws)
}

export async function setActiveWorkspaceTask(projectPath: string, activeTask: WorkspaceActiveTask | null): Promise<void> {
  const ws = await readWorkspace(projectPath)

  if (!activeTask) {
    ws.activeTask = null
    await writeWorkspace(ws)
    return
  }

  const exists = ws.items.some(i => i.connectorId === activeTask.connectorId && i.taskId === activeTask.taskId)
  if (!exists) {
    throw createError({ statusCode: 400, statusMessage: 'Task is not in workspace' })
  }

  ws.activeTask = activeTask
  await writeWorkspace(ws)
}

