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
import tools.dynamia.tasks.server.NodeServerRegistry
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
    project: Project,
    initialPort: Int?,
    initialError: NodeServerRegistry.BootstrapError? = null,
    private val onRetry: (() -> Unit)? = null,
) {
    private val log = thisLogger()

    // Root Swing component exposed to the tool window
    val component: JPanel = JPanel(BorderLayout())

    private var browser: JBCefBrowser? = null
    private var retryQuery: JBCefJSQuery? = null

    init {
        if (!JBCefApp.isSupported()) {
            component.add(
                JLabel("JCEF is not available in this IDE build.", SwingConstants.CENTER),
                BorderLayout.CENTER,
            )
        } else {
            initialiseBrowser()
            when {
                initialError != null -> showError(initialError)
                initialPort  != null -> load(initialPort)
                else                 -> showPlaceholder("Starting Dynamia Tasks server…")
            }
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

    /** Renders a rich HTML error page in the JCEF panel. Safe to call from any thread. */
    fun showError(error: NodeServerRegistry.BootstrapError) {
        SwingUtilities.invokeLater {
            val b = browser
            if (b == null) {
                initialiseBrowser()
                showError(error)
                return@invokeLater
            }
            // Wire the JS → Kotlin retry callback once
            if (retryQuery == null && onRetry != null) {
                val q = JBCefJSQuery.create(b as JBCefBrowserBase)
                q.addHandler { _ ->
                    onRetry.invoke()
                    null
                }
                retryQuery = q
            }
            b.loadHTML(buildErrorHtml(error, retryQuery))
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

    // ── error HTML ───────────────────────────────────────────────────────────

    private fun buildErrorHtml(
        error: NodeServerRegistry.BootstrapError,
        retryQuery: JBCefJSQuery?,
    ): String {
        val diagItems = error.diagnostics.joinToString("\n") { line ->
            val escaped = line
                .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            when {
                line.startsWith("✅") -> "<li class='ok'>$escaped</li>"
                line.startsWith("❌") -> "<li class='err'>$escaped</li>"
                line.startsWith("   →") -> "<li class='hint'>$escaped</li>"
                else -> "<li class='info'>$escaped</li>"
            }
        }

        val retryJs = if (retryQuery != null)
            retryQuery.inject("'retry'")
        else
            "window.location.reload();"

        val causeText = error.cause?.let { cause ->
            val msg = cause.message?.replace("&", "&amp;")?.replace("<", "&lt;")?.replace(">", "&gt;") ?: ""
            "<details><summary>Stack trace</summary><pre>${stackTraceText(cause)}</pre></details>"
        } ?: ""

        return """<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    background: #1e1f22;
    color: #dfe1e5;
    padding: 24px;
    min-height: 100vh;
  }
  .card {
    background: #2b2d30;
    border: 1px solid #393b40;
    border-radius: 8px;
    padding: 20px 24px;
    max-width: 640px;
    margin: 0 auto;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 15px;
    font-weight: 600;
    color: #f28b82;
    margin-bottom: 8px;
  }
  .title svg { flex-shrink: 0; }
  .subtitle {
    color: #9da0a8;
    font-size: 12px;
    margin-bottom: 20px;
    line-height: 1.5;
  }
  h3 {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: #9da0a8;
    margin-bottom: 8px;
  }
  ul { list-style: none; display: flex; flex-direction: column; gap: 4px; margin-bottom: 20px; }
  li { padding: 6px 10px; border-radius: 4px; font-size: 12px; line-height: 1.5; font-family: monospace; }
  li.ok   { background: #1e3a2f; color: #6fcf97; }
  li.err  { background: #3a1f1f; color: #f28b82; }
  li.hint { background: transparent; color: #9da0a8; padding-left: 20px; font-style: italic; }
  li.info { background: #252629; color: #9da0a8; }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; }
  button {
    padding: 7px 16px;
    border-radius: 5px;
    border: none;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity .15s;
  }
  button:hover { opacity: .85; }
  .btn-primary { background: #4f8ef7; color: #fff; }
  .btn-secondary { background: #393b40; color: #dfe1e5; }
  details { margin-top: 16px; }
  summary { font-size: 11px; color: #9da0a8; cursor: pointer; user-select: none; margin-bottom: 6px; }
  pre {
    background: #16181a;
    border-radius: 4px;
    padding: 10px;
    font-size: 11px;
    color: #9da0a8;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 200px;
    overflow-y: auto;
  }
</style>
</head>
<body>
<div class="card">
  <div class="title">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f28b82" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    Dynamia Tasks — Startup Error
  </div>
  <p class="subtitle">${error.message.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")}</p>

  <h3>Diagnostics</h3>
  <ul>
$diagItems
  </ul>

  <div class="actions">
    <button class="btn-primary" onclick="$retryJs">Retry</button>
    <button class="btn-secondary" onclick="window.open('https://nodejs.org','_blank')">Get Node.js</button>
  </div>

  $causeText
</div>
</body>
</html>"""
    }

    private fun stackTraceText(t: Throwable): String {
        val sb = StringBuilder()
        sb.append(t.toString()).append("\n")
        t.stackTrace.take(20).forEach { sb.append("  at $it\n") }
        if (t.cause != null) {
            sb.append("Caused by: ").append(t.cause.toString()).append("\n")
            t.cause!!.stackTrace.take(10).forEach { sb.append("  at $it\n") }
        }
        return sb.toString()
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    }
}
