package tools.dynamia.tasks

import tools.dynamia.tasks.server.NodeServerRegistry
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

        if (port == null) {
            log.warn("DynamiaTasks: server port not yet known — showing loading panel")
        }

        val panel   = DynamiaTasksPanel(project, port)
        val content = ContentFactory.getInstance()
            .createContent(panel.component, "", false)

        toolWindow.contentManager.addContent(content)

        // If the server was still starting up, listen for port resolution and reload
        if (port == null) {
            registry.onPortResolved(project) { resolvedPort ->
                panel.load(resolvedPort)
            }
        }
    }

    override fun shouldBeAvailable(project: Project): Boolean = true
}

