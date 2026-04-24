import * as cp   from 'node:child_process'
import * as crypto from 'node:crypto'
import * as fs   from 'node:fs'
import * as os   from 'node:os'
import * as path from 'node:path'

const PORT_REGEX = /server running on http:\/\/localhost:(\d+)/

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

  /** Starts the server. Returns the resolved port. Rejects after 30 s. */
  start(): Promise<number> {
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
      const outputLines: string[] = []

      const timeout = setTimeout(() => {
        if (resolved) return
        this.log('[dynamia-tasks] Port not resolved in 30s — trying instance file fallback')
        const fallbackPort = this.readPortFromInstanceFile()
        if (fallbackPort) {
          resolved = true
          this.port = fallbackPort
          resolve(fallbackPort)
        } else {
          proc.kill()
          reject(new Error('Dynamia Tasks: server port not resolved within 30 s'))
        }
      }, 30_000)

      const tryResolveFromLine = (line: string) => {
        outputLines.push(line)
        this.log(`server> ${line}`)
        const m = PORT_REGEX.exec(line)
        if (m && !resolved) {
          resolved = true
          clearTimeout(timeout)
          this.port = parseInt(m[1]!, 10)
          resolve(this.port)
        }
      }

      // Read stdout line by line
      proc.stdout?.setEncoding('utf8')
      proc.stdout?.on('data', (chunk: string) => {
        chunk.split('\n').forEach(l => { if (l.trim()) tryResolveFromLine(l) })
      })

      // Forward stderr to log
      proc.stderr?.setEncoding('utf8')
      proc.stderr?.on('data', (chunk: string) => {
        chunk.split('\n').forEach(l => { if (l.trim()) this.log(`server-err> ${l}`) })
      })

      proc.on('error', err => {
        clearTimeout(timeout)
        if (!resolved) reject(err)
      })

      proc.on('exit', (code, signal) => {
        this.log(`[dynamia-tasks] server process exited (code=${code} signal=${signal})`)
        clearTimeout(timeout)
        if (!resolved) {
          // Try instance file one more time before giving up
          const fallback = this.readPortFromInstanceFile()
          if (fallback) { resolved = true; resolve(fallback) }
          else reject(new Error(`Server exited before reporting port (code=${code})`))
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

  private readPortFromInstanceFile(): number | null {
    try {
      const hash = sha1(this.projectPath).slice(0, 12)
      const file = path.join(os.homedir(), '.dynamiatasks', 'instances', `${hash}.json`)
      if (!fs.existsSync(file)) return null
      const content = fs.readFileSync(file, 'utf8')
      const m = /"port"\s*:\s*(\d+)/.exec(content)
      return m ? parseInt(m[1]!, 10) : null
    } catch {
      return null
    }
  }
}

function sha1(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex')
}

