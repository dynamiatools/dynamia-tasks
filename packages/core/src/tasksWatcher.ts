import { ide } from '@dynamia-tools/ide-bridge'
import { tasksDir } from './tasksDir.js'

const POLL_MS = 2000

function hash(text: string): number {
  let h = 5381
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return h
}

/** Cheap fingerprint of every JSON file in the tasks dir ('' when the dir is missing). */
async function fingerprint(dir: string): Promise<string> {
  let names: string[]
  try {
    names = (await ide.fs.readdir(dir)).filter(f => f.endsWith('.json')).sort()
  } catch {
    return ''
  }
  const parts: string[] = []
  for (const name of names) {
    try {
      parts.push(`${name}:${hash(await ide.fs.readFile(ide.path.join(dir, name)))}`)
    } catch {
      parts.push(`${name}:?`)
    }
  }
  return parts.join('|')
}

/**
 * Calls `onChange` when a file in `<project>/.dynamia/tasks/` changes on disk,
 * whoever wrote it (this plugin, an agent, or the user by hand). Returns an unsubscribe function.
 *
 * shortcut: polling, because the bridge has no fs.watch yet. Replace with a
 * bridge-level watcher (VS Code FileSystemWatcher / IntelliJ VFS listener) if
 * the cost of reading these files every 2s ever matters.
 */
export function watchTasksDir(projectPath: string, onChange: () => void): () => void {
  const dir = tasksDir(projectPath)
  let last: string | null = null
  let busy = false
  let stopped = false

  const tick = async () => {
    if (busy || stopped) return
    if (typeof document !== 'undefined' && document.hidden) return
    busy = true
    try {
      const next = await fingerprint(dir)
      if (stopped) return
      const changed = last !== null && next !== last
      last = next
      if (changed) onChange()
    } finally {
      busy = false
    }
  }

  void tick() // establishes the baseline
  const timer = setInterval(() => { void tick() }, POLL_MS)
  return () => {
    stopped = true
    clearInterval(timer)
  }
}
