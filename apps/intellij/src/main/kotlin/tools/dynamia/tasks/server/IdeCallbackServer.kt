package tools.dynamia.tasks.server

import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.fileEditor.OpenFileDescriptor
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.notification.Notification
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress

/**
 * Lightweight HTTP server (JDK built-in [HttpServer]) that receives callbacks
 * from the Node server and executes IDE-native actions.
 *
 * Endpoints:
 *  POST /ide/open-file  — body: `{ "path": "/abs/path", "line": 42 }`
 *  POST /ide/notify     — body: `{ "type": "info|warning|error|success", "message": "..." }`
 */
class IdeCallbackServer(
    private val project: Project,
    private val startPort: Int,
) {
    private val log = thisLogger()

    private var server: HttpServer? = null

    /** Starts the server and returns the port it bound to. */
    fun start(): Int {
        val port   = findFreePort(startPort)
        val httpSrv = HttpServer.create(InetSocketAddress("127.0.0.1", port), 0)

        httpSrv.createContext("/ide/open-file") { ex -> handle(ex, ::handleOpenFile) }
        httpSrv.createContext("/ide/notify")    { ex -> handle(ex, ::handleNotify) }
        httpSrv.executor = null   // default executor (single-threaded is fine)
        httpSrv.start()

        server = httpSrv
        log.info("DynamiaTasks: IdeCallbackServer started on :$port")
        return port
    }

    fun stop() {
        server?.stop(1)
        server = null
    }

    // ── request dispatch ─────────────────────────────────────────────────────

    private fun handle(ex: HttpExchange, action: (Map<String, Any?>) -> Unit) {
        try {
            if (ex.requestMethod != "POST") {
                respond(ex, 405, """{"error":"method not allowed"}""")
                return
            }
            val body  = ex.requestBody.bufferedReader().readText()
            val json  = parseJson(body)
            action(json)
            respond(ex, 200, """{"ok":true}""")
        } catch (e: Exception) {
            log.warn("DynamiaTasks: callback error", e)
            respond(ex, 500, """{"error":"${e.message}"}""")
        }
    }

    private fun respond(ex: HttpExchange, code: Int, body: String) {
        val bytes = body.toByteArray()
        ex.responseHeaders.add("Content-Type", "application/json")
        ex.sendResponseHeaders(code, bytes.size.toLong())
        ex.responseBody.use { it.write(bytes) }
    }

    // ── handlers ──────────────────────────────────────────────────────────────

    private fun handleOpenFile(body: Map<String, Any?>) {
        val path = body["path"] as? String
            ?: error("missing 'path' in open-file request")
        val line = (body["line"] as? Number)?.toInt()?.minus(1)?.coerceAtLeast(0) ?: 0

        com.intellij.openapi.application.ApplicationManager.getApplication().invokeLater {
            val vFile = LocalFileSystem.getInstance().findFileByPath(path)
                ?: error("Virtual file not found: $path")
            OpenFileDescriptor(project, vFile, line, 0).navigate(true)
        }
    }

    private fun handleNotify(body: Map<String, Any?>) {
        val message = body["message"] as? String ?: return
        val type    = when ((body["type"] as? String)?.lowercase()) {
            "error"   -> NotificationType.ERROR
            "warning" -> NotificationType.WARNING
            else      -> NotificationType.INFORMATION
        }

        com.intellij.openapi.application.ApplicationManager.getApplication().invokeLater {
            val group = NotificationGroupManager.getInstance()
                .getNotificationGroup("DynamiaTasks")
            val notification = group?.createNotification(message, type)
                ?: Notification("DynamiaTasks", "Dynamia Tasks", message, type)
            notification.notify(project)
        }
    }

    // ── minimal JSON parser (no external deps) ────────────────────────────────

    /**
     * Parses a flat JSON object like `{ "key": "value", "num": 42 }`.
     * Not a full parser — sufficient for our small callback payloads.
     */
    private fun parseJson(raw: String): Map<String, Any?> {
        val result = mutableMapOf<String, Any?>()
        val content = raw.trim().removeSurrounding("{", "}").trim()
        if (content.isEmpty()) return result

        // Split on commas that are NOT inside strings (basic approach)
        val pairRegex = Regex(""""([^"]+)"\s*:\s*("([^"]*?)"|(-?\d+(?:\.\d+)?)|true|false|null)""")
        pairRegex.findAll(content).forEach { match ->
            val key = match.groupValues[1]
            val raw2 = match.groupValues[2]
            result[key] = when {
                raw2.startsWith("\"") -> match.groupValues[3]
                raw2 == "true"        -> true
                raw2 == "false"       -> false
                raw2 == "null"        -> null
                else                  -> raw2.toDoubleOrNull() ?: raw2
            }
        }
        return result
    }
}

