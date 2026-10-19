package tools.dynamia.tasks

import com.intellij.openapi.project.Project
import tools.dynamia.idebridge.BridgeSecurity
import tools.dynamia.idebridge.DynamiaWebView

/**
 * Tool-window panel for Dynamia Tasks.
 *
 * All JCEF setup, IDE bridge installation, JAR resource loading and dev-mode
 * detection are handled by [DynamiaWebView].  Resources are expected at
 * `src/main/resources/web/` inside this module's JAR.
 *
 * The [component] property exposes the [DynamiaWebView] (which is itself a
 * [javax.swing.JPanel]) so it can be handed directly to
 * [com.intellij.ui.content.ContentFactory].
 */
class DynamiaTasksPanel(project: Project) {

    val component: DynamiaWebView = DynamiaWebView(
        project             = project,
        resourceBasePath    = "web",
        devUrlEnvVar        = "DYNAMIA_DEV_URL",
        resourceClassLoader = DynamiaTasksPanel::class.java.classLoader,
        notificationGroupId = "DynamiaTasks",
        notificationDisplayName = "Dynamia Tasks",
        security            = BridgeSecurity(
            // ConfigService still reads the pre-1.0 global config from here (read-only migration).
            fsReadOnlyRoots = listOf(System.getProperty("user.home") + "/.dynamiatasks"),
            // LocalConnector.resolveAuthor(): author name for local comments.
            allowedCommands = listOf(
                listOf("git", "config", "user.name"),
                // Settings → MCP checks Node and the installed MCP server (see apps/web/composables/useMcpStatus.ts).
                listOf("node", "--version"),
                listOf("node", McpInstaller.installedFile.toString(), "--version"),
            ),
        ),
    )
}
