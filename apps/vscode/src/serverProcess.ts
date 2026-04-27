import * as cp   from 'node:child_process'
import * as crypto from 'node:crypto'
import * as fs   from 'node:fs'
import * as os   from 'node:os'
import * as path from 'node:path'

const READY_PREFIX = 'DT_INSTANCE_READY '
const PORT_PATTERNS = [
  /server running on http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/i,
  /listening on http:\/\/(?:localhost|127\.0\.0\.1|\[::]|0\.0\.0\.0):(\d+)/i,
]
const DEFAULT_START_TIMEOUT_MS = 60_000
const INSTANCE_POLL_INTERVAL_MS = 750

interface InstanceInfo {
  port: number
  projectPath: string
  pid: number
  startedAt: string
}

/**
 * Spawns `node cli.mjs --cwd <projectPath> --ide-callback <callbackUrl>`
 * and resolves the actual port chosen by the CLI.
 *
 * Port discovery order:
 *  1. Stdout line matching `server running on http://localhost:<PORT>`
 *  2. Instance file `~/.dynamiatasks/instances/<sha1(projectPath)[0..12]>.json`
 */
export class ServerProcess {
  private proc: cp.ChildProcess | null = null
  private port = 0

  constructor(
    private readonly nodeExe:      string,
    private readonly serverBundle: string,
    private readonly projectPath:  string,
    private readonly callbackUrl:  string,
    private readonly log:          (msg: string) => void,
  ) {}

  /** Starts the server. Returns the resolved port. Rejects after timeout. */
  async start(): Promise<number> {
    return this.startSingle()
  }

  private startSingle(): Promise<number> {
    return new Promise((resolve, reject) => {
      const args = [
        this.serverBundle,
        '--cwd',          this.projectPath,
        '--ide-callback', this.callbackUrl,
      ]

      this.log(`[dynamia-tasks] launching: ${this.nodeExe} ${args.join(' ')}`)

      const env = { ...process.env, FORCE_COLOR: '0' }

      const proc = cp.spawn(this.nodeExe, args, {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      this.proc = proc

      let resolved = false
      const timeoutMs = this.resolveStartTimeoutMs()
      const timeout = setTimeout(() => {
        if (resolved) return
        this.log(`[dynamia-tasks] Port not resolved in ${Math.round(timeoutMs / 1000)}s — trying instance file fallback`)
        const fallbackPort = this.readPortFromInstanceFile()?.port ?? null
        if (fallbackPort) {
          resolved = true
          this.port = fallbackPort
          clearInterval(instancePoll)
          resolve(fallbackPort)
        } else {
          clearInterval(instancePoll)
          proc.kill()
          reject(new Error(`Dynamia Tasks: server port not resolved within ${Math.round(timeoutMs / 1000)} s`))
        }
      }, timeoutMs)

      const instancePoll = setInterval(() => {
        if (resolved) return
        const fallback = this.readPortFromInstanceFile()
        if (!fallback) return
        resolved = true
        clearTimeout(timeout)
        clearInterval(instancePoll)
        this.port = fallback.port
        this.log(`[dynamia-tasks] Port resolved via instance file: ${fallback.port}`)
        void this.verifyResolvedPort(fallback.port)
        resolve(fallback.port)
      }, INSTANCE_POLL_INTERVAL_MS)

      const tryResolveFromLine = (line: string) => {
        this.log(`server> ${line}`)
        const ready = parseReadyLine(line)
        if (ready && this.isMatchingProject(ready.projectPath) && !resolved) {
          resolved = true
          clearTimeout(timeout)
          clearInterval(instancePoll)
          this.port = ready.port
          void this.verifyResolvedPort(ready.port)
          resolve(ready.port)
          return
        }
        const m = matchPort(line)
        if (m && !resolved) {
          resolved = true
          clearTimeout(timeout)
          clearInterval(instancePoll)
          this.port = parseInt(m[1]!, 10)
          void this.verifyResolvedPort(this.port)
          resolve(this.port)
        }
      }

      // Read stdout incrementally; chunks can split lines on Windows.
      proc.stdout?.setEncoding('utf8')
      let stdoutBuffer = ''
      proc.stdout?.on('data', (chunk: string) => {
        stdoutBuffer += chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        const lines = stdoutBuffer.split('\n')
        stdoutBuffer = lines.pop() ?? ''
        lines.forEach(l => { if (l.trim()) tryResolveFromLine(l.trim()) })
      })
      proc.stdout?.on('end', () => {
        const last = stdoutBuffer.trim()
        if (last) tryResolveFromLine(last)
      })

      // Forward stderr to log
      proc.stderr?.setEncoding('utf8')
      proc.stderr?.on('data', (chunk: string) => {
        chunk.split('\n').forEach(l => { if (l.trim()) this.log(`server-err> ${l}`) })
      })

      proc.on('error', err => {
        clearTimeout(timeout)
        clearInterval(instancePoll)
        if (this.proc === proc) {
          this.proc = null
          this.port = 0
        }
        if (!resolved) reject(err)
      })

      proc.on('exit', (code, signal) => {
        this.log(`[dynamia-tasks] server process exited (code=${code} signal=${signal})`)
        clearTimeout(timeout)
        clearInterval(instancePoll)
        if (!resolved) {
          // Try instance file one more time before giving up
          const fallback = this.readPortFromInstanceFile()?.port ?? null
          if (fallback) {
            resolved = true
            this.port = fallback
            void this.verifyResolvedPort(fallback)
            resolve(fallback)
          }
          else {
            if (this.proc === proc) {
              this.proc = null
              this.port = 0
            }
            reject(new Error(`Server exited before reporting port (code=${code})`))
          }
        }
      })
    })
  }

  stop() {
    if (this.proc && !this.proc.killed) {
      this.log('[dynamia-tasks] stopping server process')
      this.proc.kill()
    }
    this.proc = null
    this.port = 0
  }

  getPort() {
    return this.port
  }

  isRunning() {
    return this.proc !== null && !this.proc.killed
  }

  // ── port fallback ─────────────────────────────────────────────────────────

  private readPortFromInstanceFile(): InstanceInfo | null {
    try {
      const hash = sha1(normalizeProjectPath(this.projectPath)).slice(0, 12)
      const file = path.join(os.homedir(), '.dynamiatasks', 'instances', `${hash}.json`)
      if (!fs.existsSync(file)) return null
      const content = fs.readFileSync(file, 'utf8')
      const parsed = JSON.parse(content) as Partial<InstanceInfo>
      if (!parsed.projectPath || !this.isMatchingProject(parsed.projectPath)) return null
      return isValidInstanceInfo(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  private isMatchingProject(candidateProjectPath: string): boolean {
    return normalizeProjectPath(candidateProjectPath) === normalizeProjectPath(this.projectPath)
  }

  private async verifyResolvedPort(port: number): Promise<void> {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/instance`)
      if (!res.ok) {
        this.log(`[dynamia-tasks] instance verification failed for :${port} (HTTP ${res.status})`)
        return
      }
      const instance = await res.json() as Partial<InstanceInfo>
      if (!instance.projectPath || !this.isMatchingProject(instance.projectPath)) {
        this.log(`[dynamia-tasks] instance verification mismatch for :${port} (expected ${this.projectPath}, got ${instance.projectPath ?? 'unknown'})`)
        return
      }
      this.log(`[dynamia-tasks] instance verified for ${instance.projectPath} on :${port}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      this.log(`[dynamia-tasks] instance verification skipped for :${port} (${msg})`)
    }
  }

  private resolveStartTimeoutMs(): number {
    const raw = process.env['DYNAMIA_START_TIMEOUT_MS']
    const parsed = raw ? parseInt(raw, 10) : NaN
    return Number.isFinite(parsed) && parsed >= 10_000 ? parsed : DEFAULT_START_TIMEOUT_MS
  }
}

function sha1(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex')
}

function normalizeProjectPath(projectPath: string): string {
  const resolved = path.resolve(projectPath)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function isValidInstanceInfo(value: Partial<InstanceInfo>): value is InstanceInfo {
  return typeof value.port === 'number'
    && typeof value.projectPath === 'string'
    && typeof value.pid === 'number'
    && typeof value.startedAt === 'string'
}

function parseReadyLine(line: string): InstanceInfo | null {
  if (!line.startsWith(READY_PREFIX)) return null
  try {
    const parsed = JSON.parse(line.slice(READY_PREFIX.length)) as Partial<InstanceInfo>
    return isValidInstanceInfo(parsed) ? parsed : null
  } catch {
    return null
  }
}

function matchPort(line: string): RegExpExecArray | null {
  for (const pattern of PORT_PATTERNS) {
    const m = pattern.exec(line)
    if (m) return m
  }
  return null
}

