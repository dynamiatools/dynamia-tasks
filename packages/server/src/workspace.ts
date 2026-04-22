import fs from 'node:fs/promises'
import path from 'node:path'
import type { Workspace, WorkspaceItem, TaskView } from '@dynamia-tasks/core'
import { getConnector } from './connectors/registry.js'

export async function readWorkspace(projectPath: string): Promise<Workspace> {
  const file = path.join(projectPath, '.dynamia', 'tasks', 'workspace.json')
  try {
    const raw = await fs.readFile(file, 'utf-8')
    return JSON.parse(raw) as Workspace
  } catch {
    return { projectPath, items: [] }
  }
}

export async function writeWorkspace(ws: Workspace): Promise<void> {
  const dir = path.join(ws.projectPath, '.dynamia', 'tasks')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'workspace.json'), JSON.stringify(ws, null, 2), 'utf-8')
}

export async function resolveWorkspace(projectPath: string): Promise<{ items: TaskView[]; cached?: boolean }> {
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

  return { items: resolved }
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
  // Re-index order
  ws.items.forEach((item, i) => { item.order = i })
  await writeWorkspace(ws)
}

export async function reorderWorkspace(projectPath: string, items: WorkspaceItem[]): Promise<void> {
  const ws = await readWorkspace(projectPath)
  ws.items = items
  await writeWorkspace(ws)
}

