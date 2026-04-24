package tools.dynamia.tasks.server

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Application-level service that holds per-project server state.
 * Allows [DynamiaTasksWindowFactory] to retrieve the server port even if the
 * Tool Window is opened after the server has started.
 */
@Service(Service.Level.APP)
class NodeServerRegistry {

    data class Entry(
        val manager: NodeServerManager,
        val callbackServer: IdeCallbackServer,
        val port: Int,
    )

    /** Structured error reported when bootstrap fails. */
    data class BootstrapError(
        val message: String,
        val cause: Throwable?,
        /** Human-readable diagnostic lines shown in the error panel. */
        val diagnostics: List<String>,
    )

    private val log       = thisLogger()
    private val entries   = ConcurrentHashMap<String, Entry>()
    private val listeners = ConcurrentHashMap<String, CopyOnWriteArrayList<(Int) -> Unit>>()
    private val errors    = ConcurrentHashMap<String, BootstrapError>()
    private val errListeners = ConcurrentHashMap<String, CopyOnWriteArrayList<(BootstrapError) -> Unit>>()

    fun register(
        project: Project,
        manager: NodeServerManager,
        callbackServer: IdeCallbackServer,
        port: Int,
    ) {
        val key = projectKey(project)
        errors.remove(key)
        entries[key] = Entry(manager, callbackServer, port)
        log.info("DynamiaTasks: registered project $key on port $port")

        // Notify any listeners waiting for the port
        listeners.remove(key)?.forEach { it(port) }
    }

    fun reportError(project: Project, error: BootstrapError) {
        val key = projectKey(project)
        errors[key] = error
        log.warn("DynamiaTasks: bootstrap error for $key — ${error.message}")

        errListeners.remove(key)?.forEach {
            ApplicationManager.getApplication().invokeLater { it(error) }
        }
    }

    fun serverPort(project: Project): Int? = entries[projectKey(project)]?.port
    fun serverError(project: Project): BootstrapError? = errors[projectKey(project)]

    fun stop(project: Project) {
        val key   = projectKey(project)
        errors.remove(key)
        val entry = entries.remove(key) ?: return
        entry.manager.stop()
        entry.callbackServer.stop()
    }

    /**
     * Registers a one-shot callback invoked on the EDT once the port is known.
     * If the port is already available, calls the callback immediately.
     */
    fun onPortResolved(project: Project, callback: (Int) -> Unit) {
        val key  = projectKey(project)
        val port = entries[key]?.port
        if (port != null) {
            ApplicationManager.getApplication().invokeLater { callback(port) }
            return
        }
        listeners.getOrPut(key) { CopyOnWriteArrayList() }.add(callback)
    }

    /**
     * Registers a one-shot callback invoked on the EDT if bootstrap fails.
     * If the error is already known, calls the callback immediately.
     */
    fun onError(project: Project, callback: (BootstrapError) -> Unit) {
        val key = projectKey(project)
        val err = errors[key]
        if (err != null) {
            ApplicationManager.getApplication().invokeLater { callback(err) }
            return
        }
        errListeners.getOrPut(key) { CopyOnWriteArrayList() }.add(callback)
    }

    private fun projectKey(project: Project): String =
        project.basePath ?: project.name

    companion object {
        val instance: NodeServerRegistry
            get() = ApplicationManager.getApplication().getService(NodeServerRegistry::class.java)
    }
}

