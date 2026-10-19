package tools.dynamia.tasks

import com.intellij.openapi.diagnostic.Logger
import java.nio.file.Files
import java.nio.file.Path

/**
 * Copies the MCP server bundled in the plugin JAR (`mcp/dynamia-tasks-mcp.mjs`) to a stable path
 * that Claude Code, AI Assistant, Junie, etc. can point at. Same location the VS Code extension
 * and the web settings page use.
 */
object McpInstaller {
    private const val RESOURCE = "mcp/dynamia-tasks-mcp.mjs"

    val installedFile: Path = Path.of(System.getProperty("user.home"), ".dynamiatasks", "mcp", "dynamia-tasks-mcp.mjs")

    @Synchronized
    fun install(log: Logger) {
        val bundled = McpInstaller::class.java.classLoader.getResourceAsStream(RESOURCE)?.use { it.readBytes() }
        if (bundled == null) {
            log.info("DynamiaTasks: MCP server not bundled in this build")
            return
        }
        try {
            if (Files.exists(installedFile) && Files.readAllBytes(installedFile).contentEquals(bundled)) return
            Files.createDirectories(installedFile.parent)
            Files.write(installedFile, bundled)
            log.info("DynamiaTasks: MCP server installed → $installedFile")
        } catch (e: Exception) {
            log.warn("DynamiaTasks: could not install the MCP server: ${e.message}")
        }
    }
}
