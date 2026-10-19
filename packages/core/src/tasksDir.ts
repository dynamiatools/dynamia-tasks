import { ide } from '@dynamia-tools/ide-bridge'

/** Everything the plugin persists inside a project lives here. */
export const TASKS_DIR_PARTS = ['.dynamia', 'tasks'] as const
export const WORKSPACE_FILE = 'workspace.json'
export const COMMENTS_FILE = 'comments.json'

/** JSON files in the tasks dir that are not task lists. */
export const NON_TASK_FILES: ReadonlySet<string> = new Set([WORKSPACE_FILE, COMMENTS_FILE])

export function tasksDir(projectPath: string): string {
  return ide.path.join(projectPath, ...TASKS_DIR_PARTS)
}

export function isTaskListFile(name: string): boolean {
  return name.endsWith('.json') && !NON_TASK_FILES.has(name)
}

// ── Legacy migration ──────────────────────────────────────────────────────────

const migrations = new Map<string, Promise<void>>()

/**
 * Copies state from the old locations (`.tasks/*.json`, `.dynamiatasks/workspace.json`)
 * into `.dynamia/tasks/`. Never overwrites a file that already exists in the new
 * location and never deletes the old ones. Runs once per project per session.
 *
 * shortcut: drop this once the 1.0.x line is no longer in use.
 */
export function migrateLegacyState(projectPath: string): Promise<void> {
  let done = migrations.get(projectPath)
  if (!done) {
    done = doMigrate(projectPath).catch((e) => {
      console.warn('[dynamia-tasks] legacy state migration failed:', (e as Error).message)
    })
    migrations.set(projectPath, done)
  }
  return done
}

async function doMigrate(projectPath: string): Promise<void> {
  const target = tasksDir(projectPath)
  const sources: { dir: string; files: string[] }[] = []

  const legacyTasks = ide.path.join(projectPath, '.tasks')
  if (await ide.fs.exists(legacyTasks)) {
    const names = (await ide.fs.readdir(legacyTasks)).filter(f => f.endsWith('.json'))
    sources.push({ dir: legacyTasks, files: names })
  }
  const legacyWorkspace = ide.path.join(projectPath, '.dynamiatasks')
  if (await ide.fs.exists(ide.path.join(legacyWorkspace, WORKSPACE_FILE))) {
    sources.push({ dir: legacyWorkspace, files: [WORKSPACE_FILE] })
  }
  if (sources.length === 0) return

  await ide.fs.mkdir(target, { recursive: true })
  for (const { dir, files } of sources) {
    for (const file of files) {
      const dest = ide.path.join(target, file)
      if (await ide.fs.exists(dest)) continue
      await ide.fs.writeFile(dest, await ide.fs.readFile(ide.path.join(dir, file)))
    }
  }
}
