package tools.dynamia.tasks

import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory

/**
 * Creates the "Dynamia Tasks" Tool Window.
 * Simplified: no server registry, panel is self-contained.
 */
class DynamiaTasksWindowFactory : ToolWindowFactory {
    private val log = thisLogger()

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel   = DynamiaTasksPanel(project)
        val content = ContentFactory.getInstance().createContent(panel.component, "", false)
        toolWindow.contentManager.addContent(content)
        log.info("DynamiaTasks: tool window created for ${project.basePath}")
    }

    override fun shouldBeAvailable(project: Project): Boolean = true
}
