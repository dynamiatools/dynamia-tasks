import * as http from 'node:http'
import * as vscode from 'vscode'
import { findFreePort } from './nodeResolver'

type CallbackBody = Record<string, unknown>

/**
 * Minimal HTTP server that receives callbacks from the Node server and
 * executes VS Code-native actions.
 *
 * Endpoints:
 *  POST /ide/open-file  — { "path": "/abs/path/file.ts", "line": 42 }
 *  POST /ide/notify     — { "type": "info|warning|error|success", "message": "..." }
 */
export class IdeCallbackServer {
  private server: http.Server | null = null
  private port = 0

  /** Starts the server and returns the port it bound to. */
  async start(startPort = 7843): Promise<number> {
    this.port = await findFreePort(startPort)

    this.server = http.createServer((req, res) => {
      this.dispatch(req, res)
    })

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(this.port, '127.0.0.1', () => resolve())
    })

    return this.port
  }

  stop() {
    this.server?.close()
    this.server = null
  }

  getPort() {
    return this.port
  }

  // ── request dispatch ────────────────────────────────────────────────────

  private dispatch(req: http.IncomingMessage, res: http.ServerResponse) {
    if (req.method !== 'POST') {
      this.respond(res, 405, { error: 'Method Not Allowed' })
      return
    }

    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        const json = JSON.parse(body) as CallbackBody

        if (req.url === '/ide/open-file') {
          this.handleOpenFile(json)
          this.respond(res, 200, { ok: true })
        } else if (req.url === '/ide/notify') {
          this.handleNotify(json)
          this.respond(res, 200, { ok: true })
        } else {
          this.respond(res, 404, { error: 'Not Found' })
        }
      } catch (err: unknown) {
        this.respond(res, 500, { error: String(err) })
      }
    })
    req.on('error', () => this.respond(res, 400, { error: 'Bad Request' }))
  }

  // ── handlers ─────────────────────────────────────────────────────────────

  private handleOpenFile(body: CallbackBody) {
    const filePath = body['path'] as string | undefined
    if (!filePath) throw new Error("missing 'path' field")

    const line = typeof body['line'] === 'number' ? Math.max(0, body['line'] - 1) : 0

    vscode.workspace.openTextDocument(filePath).then(doc => {
      vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.One,
        selection:  new vscode.Range(line, 0, line, 0),
      })
    }, err => {
      vscode.window.showErrorMessage(`Dynamia Tasks: could not open file: ${err}`)
    })
  }

  private handleNotify(body: CallbackBody) {
    const message = (body['message'] as string | undefined) ?? ''
    const type    = (body['type'] as string | undefined)?.toLowerCase()

    if (type === 'error') {
      vscode.window.showErrorMessage(`Dynamia Tasks: ${message}`)
    } else if (type === 'warning') {
      vscode.window.showWarningMessage(`Dynamia Tasks: ${message}`)
    } else {
      vscode.window.showInformationMessage(`Dynamia Tasks: ${message}`)
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private respond(res: http.ServerResponse, status: number, body: object) {
    const json = JSON.stringify(body)
    res.writeHead(status, {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(json),
    })
    res.end(json)
  }
}

