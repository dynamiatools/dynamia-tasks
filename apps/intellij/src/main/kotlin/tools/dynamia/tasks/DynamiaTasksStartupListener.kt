package tools.dynamia.tasks

import tools.dynamia.tasks.server.IdeCallbackServer
import tools.dynamia.tasks.server.NodeServerManager
import tools.dynamia.tasks.server.NodeServerRegistry
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.ProjectManagerListener

/**
 * Starts the Node server when a project opens and stops it when the project closes.
 * Registered via <projectListeners> in plugin.xml.
 */
class DynamiaTasksStartupListener : ProjectManagerListener {

    private val log = thisLogger()

    @Suppress("OVERRIDE_DEPRECATION")
    override fun projectOpened(project: Project) {
        log.info("DynamiaTasks: project opened → ${project.basePath}")
        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                bootstrap(project)
            } catch (e: Exception) {
                log.error("DynamiaTasks: bootstrap failed", e)
            }
        }
    }

    @Suppress("OVERRIDE_DEPRECATION")
    override fun projectClosing(project: Project) {
        log.info("DynamiaTasks: project closing → ${project.basePath}")
        NodeServerRegistry.instance.stop(project)
    }

    // ── internal ──────────────────────────────────────────────────────────────

    private fun bootstrap(project: Project) {
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
}



