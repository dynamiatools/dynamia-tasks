package tools.dynamia.tasks

import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLoadHandlerAdapter
import java.awt.BorderLayout
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.SwingConstants
import javax.swing.SwingUtilities

/**
 * The JCEF-based panel that displays the Dynamia Tasks SPA.
 *
 * Lifecycle:
 *  1. Created by [DynamiaTasksWindowFactory] with the resolved server port (or null
 *     if still starting).
 *  2. If port is available immediately → browser loads the URL right away.
 *  3. If not yet available → shows a "Starting…" placeholder; [load] is called
 *     once the port is resolved.
 *  4. Before every page load, injects `window.__dynamia_host = 'intellij'` so the
 *     SPA can detect the host environment.
 */
class DynamiaTasksPanel(
    private val project: Project,
    initialPort: Int?,
) {
    private val log = thisLogger()

    // Root Swing component exposed to the tool window
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
            if (initialPort != null) load(initialPort)
            else showPlaceholder("Starting Dynamia Tasks server…")
        }
    }

    // ── public API ───────────────────────────────────────────────────────────

    /** Navigate the browser to the server on [port]. Safe to call from any thread. */
    fun load(port: Int) {
        SwingUtilities.invokeLater {
            val url = "http://localhost:$port"
            log.info("DynamiaTasks: loading SPA at $url")
            browser?.loadURL(url) ?: run {
                initialiseBrowser()
                browser?.loadURL(url)
            }
        }
    }

    // ── private ──────────────────────────────────────────────────────────────

    private fun initialiseBrowser() {
        val jbBrowser = JBCefBrowser()

        // Inject window.__dynamia_host = 'intellij' before any script runs
        jbBrowser.jbCefClient.addLoadHandler(object : CefLoadHandlerAdapter() {
            override fun onLoadStart(
                browser: CefBrowser,
                frame: CefFrame,
                transitionType: org.cef.network.CefRequest.TransitionType,
            ) {
                if (frame.isMain) {
                    browser.executeJavaScript(
                        "window.__dynamia_host = 'intellij';",
                        browser.url,
                        0,
                    )
                }
            }

            override fun onLoadError(
                browser: CefBrowser,
                frame: CefFrame,
                errorCode: org.cef.handler.CefLoadHandler.ErrorCode,
                errorText: String,
                failedUrl: String,
            ) {
                if (frame.isMain) {
                    log.warn("DynamiaTasks: JCEF load error [$errorCode] $errorText → $failedUrl")
                    showPlaceholder("Connecting to Dynamia Tasks server…")
                }
            }
        }, jbBrowser.cefBrowser)

        component.removeAll()
        component.add(jbBrowser.component, BorderLayout.CENTER)
        component.revalidate()
        component.repaint()

        browser = jbBrowser
    }

    private fun showPlaceholder(message: String) {
        SwingUtilities.invokeLater {
            component.removeAll()
            component.add(
                JLabel(message, SwingConstants.CENTER),
                BorderLayout.CENTER,
            )
            component.revalidate()
            component.repaint()
        }
    }
}

