import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initBridge } from '@dynamia-tools/ide-bridge'
import { NodeBridge } from '@dynamia-tools/ide-bridge/node'

/** Points the global `ide` proxy at a fresh temp project dir; returns its path and a cleanup. */
export function useTempProject(): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'dynamia-tasks-'))
  initBridge(new NodeBridge({ projectPath: root }))
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}
