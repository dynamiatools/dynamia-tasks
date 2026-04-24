package tools.dynamia.tasks

import tools.dynamia.tasks.server.IdeCallbackServer
import tools.dynamia.tasks.server.NodeServerManager
import tools.dynamia.tasks.server.NodeServerRegistry
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.ProjectCloseListener
import com.intellij.openapi.startup.ProjectActivity
import java.io.File

/**
 * Starts the Node server when a project opens (via ProjectActivity — the modern API).
 * Shutdown is handled by subscribing to ProjectManagerListener.projectClosing.
 */
class DynamiaTasksStartupListener : ProjectActivity {

    private val log = thisLogger()

    override suspend fun execute(project: Project) {
        log.info("DynamiaTasks: project opened → ${project.basePath}")

        // ProjectCloseListener.TOPIC is a project-level topic — subscribe via project.messageBus
        project.messageBus.connect().subscribe(ProjectCloseListener.TOPIC, object : ProjectCloseListener {
            override fun projectClosing(project: Project) {
                log.info("DynamiaTasks: project closing → ${project.basePath}")
                NodeServerRegistry.instance.stop(project)
            }
        })

        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                bootstrap(project)
            } catch (e: Exception) {
                log.error("DynamiaTasks: bootstrap failed", e)
                NodeServerRegistry.instance.reportError(project, diagnose(e))
            }
        }
    }

    // ── internal ──────────────────────────────────────────────────────────────

    fun bootstrap(project: Project) {
        val registry = NodeServerRegistry.instance

        // Auto-select a free callback port starting from 7843
        val callbackServer = IdeCallbackServer(project, startPort = 7843)
        val callbackPort   = callbackServer.start()
        log.info("DynamiaTasks: IDE callback server listening on :$callbackPort")

        val manager = NodeServerManager(
            project          = project,
            callbackUrl      = "http://127.0.0.1:$callbackPort",
        )
        val serverPort = manager.start()
        log.info("DynamiaTasks: Node server on :$serverPort for ${project.basePath}")

        registry.register(project, manager, callbackServer, serverPort)
    }

    // ── error diagnosis ───────────────────────────────────────────────────────

    private fun diagnose(e: Exception): NodeServerRegistry.BootstrapError {
        val os   = System.getProperty("os.name") ?: "Unknown OS"
        val home = System.getProperty("user.home") ?: ""
        val isWindows = os.lowercase().startsWith("win")
        val diag = mutableListOf<String>()

        diag += "OS: $os"

        // Detect Node.js
        val nodeExe = findNodeOnPath(home, isWindows)
        if (nodeExe != null) {
            diag += "✅ Node.js found: $nodeExe"
        } else {
            diag += "❌ Node.js NOT found in any known location"
            diag += if (isWindows)
                "   → Install Node.js from https://nodejs.org or via nvm-windows / Scoop / Chocolatey"
            else
                "   → Install Node.js from https://nodejs.org or via nvm / fnm / Homebrew"
        }

        // Detect server bundle
        val hasBundledCli = NodeServerManager::class.java.getResource("/server/cli.mjs") != null
        if (hasBundledCli) {
            diag += "✅ Server bundle found (bundled in plugin JAR)"
        } else {
            val webDir = File(home, "IdeaProjects/dynamia-tasks/apps/web")
            val cliFile = File(webDir, "cli.mjs")
            if (cliFile.exists()) {
                diag += "✅ Server bundle found: ${cliFile.absolutePath}"
            } else {
                diag += "❌ Server bundle (cli.mjs) NOT found"
                diag += "   → Run: pnpm --filter @dynamia-tasks/web build"
            }
        }

        // Exception type hint
        val rootMsg = e.message ?: e.javaClass.simpleName
        val hint = when {
            rootMsg.contains("Cannot run program", ignoreCase = true) ||
            rootMsg.contains("error=2")                               -> "Node.js executable could not be launched."
            rootMsg.contains("cli.mjs", ignoreCase = true)            -> "Server bundle (cli.mjs) was not found."
            rootMsg.contains("port", ignoreCase = true)               -> "Server started but port could not be resolved within the timeout."
            rootMsg.contains("codeSource", ignoreCase = true)         -> "Could not locate plugin JAR to extract server bundle."
            else                                                       -> rootMsg
        }

        return NodeServerRegistry.BootstrapError(
            message     = hint,
            cause       = e,
            diagnostics = diag,
        )
    }

    /** Quick node detection (mirrors the main logic in NodeServerManager but read-only). */
    private fun findNodeOnPath(home: String, isWindows: Boolean): String? {
        val candidates: List<String> = if (isWindows) {
            val appData  = System.getenv("APPDATA")      ?: "$home\\AppData\\Roaming"
            val localApp = System.getenv("LOCALAPPDATA") ?: "$home\\AppData\\Local"
            listOf(
                "C:\\Program Files\\nodejs\\node.exe",
                "C:\\Program Files (x86)\\nodejs\\node.exe",
                "$home\\.volta\\bin\\node.exe",
                "$localApp\\fnm\\aliases\\default\\node.exe",
                "$home\\scoop\\apps\\nodejs\\current\\node.exe",
                "C:\\ProgramData\\chocolatey\\bin\\node.exe",
                "$localApp\\Programs\\nodejs\\node.exe",
            ) + (File(appData, "nvm").takeIf { it.isDirectory }
                ?.listFiles()
                ?.filter { it.isDirectory && it.name.startsWith("v") }
                ?.sortedDescending()
                ?.map { "${it.absolutePath}\\node.exe" } ?: emptyList())
        } else {
            listOf(
                "/usr/local/bin/node", "/usr/bin/node",
                "/opt/homebrew/bin/node", "/opt/homebrew/opt/node/bin/node",
                "$home/.volta/bin/node", "$home/.fnm/aliases/default/bin/node",
                "$home/.local/bin/node", "$home/bin/node",
            ) + (File(home, ".nvm/versions/node").takeIf { it.isDirectory }
                ?.listFiles()?.sortedDescending()
                ?.map { "${it.absolutePath}/bin/node" } ?: emptyList())
        }
        return candidates.map { File(it) }.firstOrNull { it.isFile && it.canExecute() }?.absolutePath
    }
}
