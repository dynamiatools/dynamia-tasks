import { statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const hasTasksDir = (dir: string) => {
  try { return statSync(join(dir, '.dynamia', 'tasks')).isDirectory() } catch { return false }
}

/**
 * The nearest folder, from `start` upwards, that has `.dynamia/tasks/`, or null.
 * The MCP only acts on projects where Dynamia Tasks has been set up; anywhere else it stays inert.
 */
export function findProjectRoot(start: string): string | null {
  let dir = resolve(start)
  for (;;) {
    if (hasTasksDir(dir)) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export const NOT_ACTIVE_MESSAGE =
  'Hey, this folder has no Dynamia Tasks support (no .dynamia/tasks/ here or in a parent folder). ' +
  'Install the plugin in VS Code or IntelliJ: https://github.com/dynamiatools/dynamia-tasks. ' +
  'Tell the user this; do not try to manage tasks with this server.'
