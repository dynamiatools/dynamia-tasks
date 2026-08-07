package tools.dynamia.tasks

import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import java.awt.BorderLayout
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.SwingConstants

/**
 * Creates the "Dynamia Tasks" Tool Window.
 * Simplified: no server registry, panel is self-contained.
 */
class DynamiaTasksWindowFactory : ToolWindowFactory {
    private val log = thisLogger()

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        // DynamiaTasksPanel embeds a JCEF-based web view (via DynamiaWebView). On IDE builds
        // where com.intellij.ui.jcef.* isn't on the classpath (JCEF has no classic
        // com.intellij.modules.* compatibility alias to gate on via plugin.xml, so this can
        // only be detected at runtime), simply *loading* that class throws NoClassDefFoundError/
        // LinkageError — not a recoverable exception — so we must catch Throwable here.
        val component = try {
            DynamiaTasksPanel(project).component
        } catch (e: Throwable) {
            log.warn("DynamiaTasks: web view unavailable (JCEF missing in this IDE build)", e)
            unavailablePlaceholder()
        }
        val content = ContentFactory.getInstance().createContent(component, "", false)
        toolWindow.contentManager.addContent(content)
        log.info("DynamiaTasks: tool window created for ${project.basePath}")
    }

    override fun shouldBeAvailable(project: Project): Boolean = true

    private fun unavailablePlaceholder(): JPanel = JPanel(BorderLayout()).apply {
        add(
            JLabel("Dynamia Tasks requires JCEF, which is not available in this IDE build.", SwingConstants.CENTER),
            BorderLayout.CENTER,
        )
    }
}
