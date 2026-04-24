package tools.dynamia.tasks.server

import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import java.io.File
import java.net.ServerSocket
import java.security.MessageDigest
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

/**
 * Spawns the Node.js server as a child process and resolves the actual port
 * that was auto-selected by the CLI.
 *
 * Port discovery order:
 *  1. Stdout line: `✓ dynamia-tasks server running on http://localhost:<PORT>`
 *  2. Instance file: `~/.dynamiatasks/instances/<sha1(projectPath)[0..12]>.json`
 */
class NodeServerManager(
    private val project: Project,
    private val callbackUrl: String,
) {
    private val log = thisLogger()

    private var process: Process? = null

    /** Starts the server and returns the resolved port. Blocks until the port is known. */
    fun start(): Int {
        val serverBundle = resolveServerBundle()
        val projectPath = project.basePath ?: System.getProperty("user.home")
        val nodeExe = resolveNodeExecutable()

        log.info("DynamiaTasks: launching $nodeExe $serverBundle --cwd $projectPath")

        // On Windows we must launch through cmd so that .cmd shims (e.g. from nvm-windows
        // or fnm) are resolved correctly.  On Unix a direct exec is fine.
        val command = if (isWindows)
            listOf("cmd.exe", "/c", nodeExe, serverBundle, "--cwd", projectPath, "--ide-callback", callbackUrl)
        else
            listOf(nodeExe, serverBundle, "--cwd", projectPath, "--ide-callback", callbackUrl)

        val pb = ProcessBuilder(command).apply {
            redirectErrorStream(true)           // merge stderr → stdout
            environment()["FORCE_COLOR"] = "0"  // no ANSI in logs
        }

        val proc = pb.start()
        process = proc

        // Stream stdout to IDE log + capture port line
        val port = readPortFromProcess(proc, projectPath)

        if (port == null) {
            proc.destroyForcibly()
            error("DynamiaTasks: could not resolve server port — check node/server bundle")
        }

        return port
    }

    fun stop() {
        process?.let {
            log.info("DynamiaTasks: stopping server process")
            it.destroy()
            if (!it.waitFor(5, TimeUnit.SECONDS)) it.destroyForcibly()
        }
        process = null
    }

    // ── port discovery ────────────────────────────────────────────────────────

    private fun readPortFromProcess(proc: Process, projectPath: String): Int? {
        val portRegex = Regex("""server running on http://localhost:(\d+)""")
        val outputLines = mutableListOf<String>()

        // Read stdout in a separate daemon thread to avoid blocking the caller
        val future = CompletableFuture<Int>()
        val readerThread = Thread({
            val reader = proc.inputStream.bufferedReader()
            var handedOff = false
            try {
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    val l = line!!
                    outputLines.add(l)
                    log.info("server> $l")
                    val port = portRegex.find(l)?.groupValues?.get(1)?.toIntOrNull()
                    if (port != null) {
                        future.complete(port)
                        handedOff = true
                        // Keep draining stdout in background so the process doesn't block.
                        // The tail thread takes ownership of the reader and closes it when done.
                        Thread({
                            try {
                                reader.forEachLine { log.info("server> $it") }
                            } catch (e: Exception) {
                                if (proc.isAlive) log.warn("DynamiaTasks: log-tail error", e)
                            } finally {
                                runCatching { reader.close() }
                            }
                        }, "dynamia-server-log-tail")
                            .also { it.isDaemon = true }.start()
                        break
                    }
                }
                if (!handedOff) {
                    // Stream ended without finding port
                    log.warn("DynamiaTasks: server stdout ended. Output:\n${outputLines.joinToString("\n")}")
                    if (!future.isDone) future.complete(null)
                }
            } catch (e: Exception) {
                if (!future.isDone) future.completeExceptionally(e)
            } finally {
                if (!handedOff) runCatching { reader.close() }
            }
        }, "dynamia-server-reader")
        readerThread.isDaemon = true
        readerThread.start()

        // Wait up to 30 s for the port line
        val port = runCatching { future.get(30, TimeUnit.SECONDS) }.getOrNull()
        if (port != null) return port

        log.warn(
            "DynamiaTasks: port not resolved within 30s. Process alive=${proc.isAlive}. Output:\n${
                outputLines.joinToString(
                    "\n"
                )
            }"
        )

        // Fallback: instance file
        return readPortFromInstanceFile(projectPath)
    }

    private fun readPortFromInstanceFile(projectPath: String): Int? {
        val hash = sha1(projectPath).take(12)
        val file = File(System.getProperty("user.home"), ".dynamiatasks/instances/$hash.json")

        if (!file.exists()) return null

        return try {
            val content = file.readText()
            // Minimal JSON parse — avoid pulling in a full JSON library
            Regex(""""port"\s*:\s*(\d+)""").find(content)?.groupValues?.get(1)?.toIntOrNull()
        } catch (e: Exception) {
            log.warn("DynamiaTasks: could not read instance file $file", e)
            null
        }
    }

    // ── path resolution ───────────────────────────────────────────────────────

    private val isWindows = System.getProperty("os.name").lowercase().startsWith("win")

    private fun resolveNodeExecutable(): String {
        val home = System.getProperty("user.home")

        if (isWindows) {
            // ── Windows ──────────────────────────────────────────────────────
            val appData  = System.getenv("APPDATA")  ?: "$home\\AppData\\Roaming"
            val localApp = System.getenv("LOCALAPPDATA") ?: "$home\\AppData\\Local"

            val candidates = listOf(
                // Official installer default locations
                "C:\\Program Files\\nodejs\\node.exe",
                "C:\\Program Files (x86)\\nodejs\\node.exe",
                // nvm-windows  (APPDATA\nvm\<version>\node.exe)
                // — resolved below via directory scan
                // Volta
                "$home\\.volta\\bin\\node.exe",
                // fnm on Windows (stored in LOCALAPPDATA)
                "$localApp\\fnm\\aliases\\default\\node.exe",
                // Scoop
                "$home\\scoop\\apps\\nodejs\\current\\node.exe",
                "$home\\scoop\\apps\\nodejs-lts\\current\\node.exe",
                // Chocolatey
                "C:\\ProgramData\\chocolatey\\bin\\node.exe",
                // User-level PATH additions
                "$localApp\\Programs\\nodejs\\node.exe",
            )

            for (c in candidates) {
                val f = File(c)
                if (f.isFile && f.canExecute()) return f.absolutePath
            }

            // nvm-windows — scan APPDATA\nvm\v*\node.exe, pick latest
            val nvmWinDir = File(appData, "nvm")
            if (nvmWinDir.isDirectory) {
                val nodeExe = nvmWinDir.listFiles()
                    ?.filter { it.isDirectory && it.name.startsWith("v") }
                    ?.sortedDescending()
                    ?.mapNotNull { File(it, "node.exe").takeIf { f -> f.canExecute() } }
                    ?.firstOrNull()
                if (nodeExe != null) return nodeExe.absolutePath
            }

            // fnm on Windows — node-versions directory
            val fnmWinDir = File(localApp, "fnm\\node-versions")
            if (fnmWinDir.isDirectory) {
                val nodeExe = fnmWinDir.listFiles()
                    ?.sortedDescending()
                    ?.mapNotNull { File(it, "installation\\node.exe").takeIf { f -> f.canExecute() } }
                    ?.firstOrNull()
                if (nodeExe != null) return nodeExe.absolutePath
            }

            // `where node` — Windows equivalent of `which`
            runCatching {
                val proc = ProcessBuilder("cmd.exe", "/c", "where node")
                    .redirectErrorStream(true)
                    .start()
                val result = proc.inputStream.bufferedReader().readLine()?.trim()
                proc.waitFor(5, TimeUnit.SECONDS)
                if (!result.isNullOrEmpty() && File(result).canExecute()) {
                    log.info("DynamiaTasks: node found via 'where': $result")
                    return result
                }
            }

            log.warn("DynamiaTasks: node.exe not found in any known Windows location; falling back to bare 'node'")
            return "node"
        }

        // ── Unix / macOS ──────────────────────────────────────────────────────
        val candidates = listOf(
            "/usr/local/bin/node",
            "/usr/bin/node",
            "/opt/homebrew/bin/node",              // macOS ARM Homebrew
            "/opt/homebrew/opt/node/bin/node",
            "$home/.volta/bin/node",
            "$home/.fnm/aliases/default/bin/node",
            "$home/.local/bin/node",
            "$home/bin/node",
        )

        for (c in candidates) {
            val f = File(c)
            if (f.isFile && f.canExecute()) return f.absolutePath
        }

        // nvm — pick latest installed version
        val nvmDir = File(home, ".nvm/versions/node")
        if (nvmDir.isDirectory) {
            val nodeExe = nvmDir.listFiles()
                ?.sortedDescending()
                ?.mapNotNull { File(it, "bin/node").takeIf { f -> f.canExecute() } }
                ?.firstOrNull()
            if (nodeExe != null) return nodeExe.absolutePath
        }

        // fnm — resolve the "default" alias symlink properly
        // fnm may store its data in ~/.fnm or ~/.local/share/fnm depending on the version/config
        val fnmDirs = listOf(
            File(home, ".fnm/node-versions"),
            File(home, ".local/share/fnm/node-versions"),
        )
        for (fnmDir in fnmDirs) {
            if (!fnmDir.isDirectory) continue
            val nodeExe = fnmDir.listFiles()
                ?.sortedDescending()
                ?.mapNotNull { File(it, "installation/bin/node").takeIf { f -> f.canExecute() } }
                ?.firstOrNull()
            if (nodeExe != null) return nodeExe.absolutePath
        }

        // Ask the login shell — this respects .bashrc / .zshrc / .profile and picks up
        // nvm/fnm/volta shims that are only available in interactive sessions.
        // IntelliJ's JVM typically runs with a stripped-down PATH; the login shell has the full one.
        val loginShells = listOf("/bin/bash", "/bin/zsh", "/usr/bin/bash", "/usr/bin/zsh")
        for (shell in loginShells) {
            if (!File(shell).canExecute()) continue
            runCatching {
                val proc = ProcessBuilder(shell, "-l", "-c", "which node")
                    .redirectErrorStream(true)
                    .start()
                val result = proc.inputStream.bufferedReader().readLine()?.trim()
                proc.waitFor(5, TimeUnit.SECONDS)
                if (!result.isNullOrEmpty() && File(result).canExecute()) {
                    log.info("DynamiaTasks: node found via login shell ($shell): $result")
                    return result
                }
            }
        }

        // Try `which node` with current (possibly restricted) PATH
        runCatching {
            val result = ProcessBuilder("which", "node")
                .also { it.environment()["PATH"] = System.getenv("PATH") ?: "/usr/local/bin:/usr/bin:/bin" }
                .start().inputStream.bufferedReader().readLine()?.trim()
            if (!result.isNullOrEmpty()) return result
        }

        // Last fallback — rely on PATH at exec time
        log.warn("DynamiaTasks: node executable not found in any known location; falling back to bare 'node'")
        return "node"
    }

    private fun resolveServerBundle(): String {
        val home = System.getProperty("user.home")

        // 1. Monorepo dev — prefer the live cli.mjs so changes are picked up immediately.
        //    NOTE: The hardcoded home-path candidate is checked first and INDEPENDENTLY of
        //    codeSourcePath, because in IntelliJ sandbox (runIde) the plugin ClassLoader does
        //    not expose a usable codeSource, making codeSourcePath null and causing the whole
        //    block to be skipped (defaulting to the bundled — potentially stale — resources).
        val liveByHome = File(home, "IdeaProjects/dynamia-tasks/apps/web/cli.mjs").canonicalFile
        if (liveByHome.exists()) {
            log.info("DynamiaTasks: using live cli.mjs at ${liveByHome.absolutePath}")
            return liveByHome.absolutePath
        }

        // Relative-path candidates from the class code-source (works when running from
        // build/classes/kotlin/main in a standard Gradle layout).
        val codeSourcePath = runCatching {
            File(NodeServerManager::class.java.protectionDomain.codeSource.location.toURI())
        }.getOrNull()
        if (codeSourcePath != null) {
            val candidates = listOf(
                File(codeSourcePath, "../../../../apps/web/cli.mjs"),
                File(codeSourcePath, "../../../../../apps/web/cli.mjs"),
                File(codeSourcePath.parentFile, "../../../../apps/web/cli.mjs"),
                File(codeSourcePath.parentFile, "../../../../../apps/web/cli.mjs"),
            )
            val live = candidates.map { it.canonicalFile }.firstOrNull { it.exists() }
            if (live != null) {
                log.info("DynamiaTasks: using live cli.mjs at ${live.absolutePath}")
                return live.absolutePath
            }
        }

        // 2. Bundled inside the plugin JAR → extract cli.mjs + .output/ tree to temp
        if (NodeServerManager::class.java.getResource("/server/cli.mjs") != null) {
            val cliPath = extractToTemp("server/cli.mjs", "cli.mjs")
            extractNuxtOutputToTemp()
            return cliPath
        }

        error("DynamiaTasks: cli.mjs not found. Run `pnpm --filter @dynamia-tasks/web build` first.")
    }

    /**
     * Returns a cache key combining the plugin version and the JAR's last-modified timestamp.
     * Returns null when running from an exploded-resources directory (sandbox / runIde), meaning
     * no caching should be applied and files should always be re-extracted.
     */
    private fun buildCacheKey(): String? {
        val version = NodeServerManager::class.java.`package`?.implementationVersion ?: "dev"
        val jarFile = runCatching {
            File(NodeServerManager::class.java.protectionDomain.codeSource.location.toURI())
        }.getOrNull()
        return if (jarFile != null && jarFile.isFile) "${version}-${jarFile.lastModified()}" else null
    }

    /**
     * Extracts the /nuxt-output/ tree from the JAR (or build directory) to a temp directory
     * so that cli.mjs can find .output/server/index.mjs at a predictable relative path.
     *
     * - JAR mode   : uses a content-stable key (version + JAR last-modified) so the same
     *                build is never extracted twice but a new build always re-extracts.
     * - Sandbox mode (file:// URL): cacheKey is null → temp dir is always wiped and
     *                re-populated, guaranteeing the latest build resources are used.
     */
    private fun extractNuxtOutputToTemp() {
        val cacheKey = buildCacheKey()

        // Resolve (or create) the destination directory
        val destDir = if (cacheKey != null) {
            File(System.getProperty("java.io.tmpdir"), "dynamia-tasks-$cacheKey")
        } else {
            // Sandbox / dev mode: no stable key → always use a fixed "dev" dir and wipe it
            File(System.getProperty("java.io.tmpdir"), "dynamia-tasks-dev-sandbox")
        }

        // In cached (JAR) mode: skip extraction when the marker file already exists
        if (cacheKey != null && File(destDir, ".output/server/index.mjs").exists()) {
            log.info("DynamiaTasks: reusing extracted Nuxt output at ${destDir.absolutePath}")
            return
        }

        // Clean up stale extraction directories from previous builds to avoid wasting disk space
        File(System.getProperty("java.io.tmpdir")).listFiles { f ->
            f.isDirectory && f.name.startsWith("dynamia-tasks-") && f.name != destDir.name
        }?.forEach { stale ->
            log.info("DynamiaTasks: removing stale extraction dir ${stale.absolutePath}")
            stale.deleteRecursively()
        }

        // In sandbox mode wipe only the .output sub-directory so we always use the latest
        // Nuxt build assets, but leave cli.mjs (placed by extractToTemp) untouched.
        if (cacheKey == null) {
            val outputDir = File(destDir, ".output")
            if (outputDir.exists()) {
                log.info("DynamiaTasks: sandbox mode — wiping previous .output at ${outputDir.absolutePath}")
                outputDir.deleteRecursively()
            }
        }

        log.info("DynamiaTasks: extracting Nuxt output to ${destDir.absolutePath}")
        destDir.mkdirs()

        // Locate the nuxt-output resources — works both from a JAR (production plugin)
        // and from a plain directory (IntelliJ sandbox / runIde).
        val resUrl = NodeServerManager::class.java.getResource("/server/cli.mjs")
            ?: error("DynamiaTasks: cannot locate plugin resources – /server/cli.mjs not found")

        val urlStr = resUrl.toString()
        if (urlStr.startsWith("jar:")) {
            // jar:file:/path/to/plugin.jar!/server/cli.mjs  →  open the JAR and enumerate entries
            val jarPath = urlStr.removePrefix("jar:").substringBefore("!")
            val jar = java.util.jar.JarFile(File(java.net.URI(jarPath)))
            jar.use { jf ->
                jf.entries().asSequence()
                    .filter { it.name.startsWith("nuxt-output/") && !it.isDirectory }
                    .forEach { entry ->
                        // nuxt-output/server/index.mjs → destDir/.output/server/index.mjs
                        val relative = entry.name.removePrefix("nuxt-output/")
                        val dest = File(destDir, ".output/$relative")
                        dest.parentFile.mkdirs()
                        jf.getInputStream(entry).use { i -> dest.outputStream().use { o -> i.copyTo(o) } }
                    }
            }
        } else {
            // file: URL → sandbox / exploded resources directory; walk the file tree directly
            // resUrl points to .../server/cli.mjs  →  nuxt-output/ is a sibling of server/
            // Use toURI() which correctly handles Windows paths like file:/C:/...
            val resourcesRoot = File(resUrl.toURI()).parentFile.parentFile  // …/generated-resources/
            val nuxtOutputSrc = File(resourcesRoot, "nuxt-output")
            if (!nuxtOutputSrc.isDirectory) {
                log.warn("DynamiaTasks: nuxt-output directory not found at ${nuxtOutputSrc.absolutePath}")
                return
            }
            nuxtOutputSrc.walkTopDown()
                .filter { it.isFile }
                .forEach { src ->
                    val relative = src.relativeTo(nuxtOutputSrc).path
                    val dest = File(destDir, ".output/$relative")
                    dest.parentFile.mkdirs()
                    src.copyTo(dest, overwrite = true)
                }
        }
        log.info("DynamiaTasks: Nuxt output extracted to ${destDir.absolutePath}")
    }

    private fun extractToTemp(resourcePath: String, fileName: String): String {
        val cacheKey = buildCacheKey()
        val dirName = if (cacheKey != null) "dynamia-tasks-$cacheKey" else "dynamia-tasks-dev-sandbox"
        val destFile = File(System.getProperty("java.io.tmpdir"), "$dirName/$fileName")
        // In sandbox mode (no cacheKey) always overwrite so the latest resource is used
        if (!destFile.exists() || cacheKey == null) {
            destFile.parentFile.mkdirs()
            NodeServerManager::class.java.getResourceAsStream("/$resourcePath")!!
                .use { i -> destFile.outputStream().use { o -> i.copyTo(o) } }
            log.info("DynamiaTasks: extracted /$resourcePath → ${destFile.absolutePath} (${destFile.length() / 1024}KB)")
        }
        return destFile.absolutePath
    }


    private fun sha1(input: String): String =
        MessageDigest.getInstance("SHA-1")
            .digest(input.toByteArray())
            .joinToString("") { "%02x".format(it) }
}

/** Finds the first available TCP port starting from startPort. **/
fun findFreePort(startPort: Int): Int {
    var port = startPort
    while (port < startPort + 100) {
        try {
            ServerSocket(port).use { return port }
        } catch (_: Exception) {
            port++
        }
    }
    error("No free port found starting from $startPort")
}
