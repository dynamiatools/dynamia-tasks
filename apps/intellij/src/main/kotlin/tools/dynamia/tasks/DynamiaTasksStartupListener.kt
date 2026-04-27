package tools.dynamia.tasks

import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity

/**
 * Runs when a project opens. No server bootstrap needed — the bridge
 * is installed lazily in [DynamiaTasksPanel] when the tool window opens.
 */
class DynamiaTasksStartupListener : ProjectActivity {
    private val log = thisLogger()

    override suspend fun execute(project: Project) {
        log.info("DynamiaTasks: project opened → ${project.basePath}")
    }
}
