package tools.dynamia.tasks

import tools.dynamia.tasks.server.NodeServerRegistry
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory

/**
 * Creates the "Dynamia Tasks" Tool Window on the right side of the IDE.
 * The actual JCEF panel is created lazily so JCEF is initialised only when
 * the user opens the window for the first time.
 */
class DynamiaTasksWindowFactory : ToolWindowFactory {

    private val log = thisLogger()

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val registry = NodeServerRegistry.instance
        val port     = registry.serverPort(project)
        val error    = registry.serverError(project)

        if (port == null && error == null) {
            log.warn("DynamiaTasks: server port not yet known — showing loading panel")
        }

        val panel = DynamiaTasksPanel(
            project      = project,
            initialPort  = port,
            initialError = error,
            onRetry      = { retryBootstrap(project, toolWindow) },
        )
        val content = ContentFactory.getInstance()
            .createContent(panel.component, "", false)

        toolWindow.contentManager.addContent(content)

        // Server still starting — listen for port resolution or error
        if (port == null && error == null) {
            registry.onPortResolved(project) { resolvedPort ->
                panel.load(resolvedPort)
            }
            registry.onError(project) { err ->
                panel.showError(err)
            }
        }
    }

    override fun shouldBeAvailable(project: Project): Boolean = true

    // ── retry ─────────────────────────────────────────────────────────────────

    private fun retryBootstrap(project: Project, toolWindow: ToolWindow) {
        log.info("DynamiaTasks: user requested retry for ${project.basePath}")
        val registry = NodeServerRegistry.instance

        // Recreate the content with a fresh loading panel
        val loadingPanel = DynamiaTasksPanel(
            project      = project,
            initialPort  = null,
            initialError = null,
            onRetry      = { retryBootstrap(project, toolWindow) },
        )
        val content = ContentFactory.getInstance()
            .createContent(loadingPanel.component, "", false)

        ApplicationManager.getApplication().invokeLater {
            toolWindow.contentManager.removeAllContents(true)
            toolWindow.contentManager.addContent(content)
        }

        // Re-run bootstrap on a pooled thread
        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                DynamiaTasksStartupListener().bootstrap(project)

                registry.onPortResolved(project) { resolvedPort ->
                    loadingPanel.load(resolvedPort)
                }
                registry.onError(project) { err ->
                    loadingPanel.showError(err)
                }
            } catch (e: Exception) {
                log.error("DynamiaTasks: retry bootstrap failed", e)
            }
        }
    }
}
