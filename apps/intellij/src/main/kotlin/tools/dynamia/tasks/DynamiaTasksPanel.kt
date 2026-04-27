package tools.dynamia.tasks

import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.jcef.JBCefBrowser
import org.cef.handler.CefContextMenuHandlerAdapter
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.callback.CefContextMenuParams
import org.cef.callback.CefMenuModel
import tools.dynamia.idebridge.IdeBridgeInstaller
import java.awt.BorderLayout
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.SwingConstants
import javax.swing.SwingUtilities

/**
 * JCEF-based panel for Dynamia Tasks.
 *
 * Simplified: the IDE bridge (file I/O, editor, notifications…) is fully
 * handled by [IdeBridgeInstaller] from `tools.dynamia:ide-bridge-intellij`.
 * There is no Node server or callback HTTP server.
 *
 * The URL to load is either:
 *  - DYNAMIA_DEV_URL env var  → dev mode (Nuxt hot-reload)
 *  - bundled SPA index.html   → production
 */
class DynamiaTasksPanel(
    private val project: Project,
) {
    private val log = thisLogger()

    val component: JPanel = JPanel(BorderLayout())
    private var browser: JBCefBrowser? = null

    init {
        if (!JBCefApp.isSupported()) {
            component.add(
                JLabel("JCEF is not available in this IDE build.", SwingConstants.CENTER),
                BorderLayout.CENTER,
            )
        } else {
            initialiseBrowser()
            loadApp()
        }
    }

    // ── public API ────────────────────────────────────────────────────────────

    fun loadApp() {
        SwingUtilities.invokeLater {
            val b = browser ?: return@invokeLater
            val url = resolveUrl()
            log.info("DynamiaTasks: loading $url")
            component.removeAll()
            component.add(b.component, BorderLayout.CENTER)
            component.revalidate()
            component.repaint()
            b.loadURL(url)
        }
    }

    fun showPlaceholder(message: String) {
        SwingUtilities.invokeLater {
            component.removeAll()
            component.add(JLabel(message, SwingConstants.CENTER), BorderLayout.CENTER)
            component.revalidate()
            component.repaint()
        }
    }

    // ── private ───────────────────────────────────────────────────────────────

    private fun resolveUrl(): String {
        // Dev mode: load from Nuxt dev server for hot reload
        val devUrl = System.getenv("DYNAMIA_DEV_URL")
        if (!devUrl.isNullOrBlank()) return devUrl

        // Production: bundled SPA static files served via JCEF file:// or data:
        // For now, load from the resource path (handled by IntelliJ's resource URL)
        val resource = javaClass.getResource("/web/index.html")
        return resource?.toExternalForm()
            ?: "about:blank"
    }

    private fun initialiseBrowser() {
        val jbBrowser = JBCefBrowser()

        // Install the IDE bridge (registers file I/O, editor, UI, shell callbacks)
        IdeBridgeInstaller.install(jbBrowser, project)

        // Disable browser context menu
        jbBrowser.jbCefClient.addContextMenuHandler(object : CefContextMenuHandlerAdapter() {
            override fun onBeforeContextMenu(
                b: CefBrowser, f: CefFrame,
                params: CefContextMenuParams, model: CefMenuModel,
            ) { model.clear() }
        }, jbBrowser.cefBrowser)

        component.removeAll()
        component.add(jbBrowser.component, BorderLayout.CENTER)
        component.revalidate()
        component.repaint()

        browser = jbBrowser
    }
}
