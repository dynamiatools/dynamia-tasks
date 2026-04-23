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

        log.info("DynamiaTasks: launching node $serverBundle --cwd $projectPath")

        val pb = ProcessBuilder(
            resolveNodeExecutable(),
            serverBundle,
            "--cwd", projectPath,
            "--ide-callback", callbackUrl,
        ).apply {
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
            try {
                proc.inputStream.bufferedReader().use { reader ->
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        val l = line!!
                        outputLines.add(l)
                        log.info("server> $l")
                        val port = portRegex.find(l)?.groupValues?.get(1)?.toIntOrNull()
                        if (port != null) {
                            future.complete(port)
                            // Keep draining stdout in background so the process doesn't block
                            Thread({ reader.forEachLine { log.info("server> $it") } }, "dynamia-server-log-tail")
                                .also { it.isDaemon = true }.start()
                            return@use
                        }
                    }
                    // Stream ended without finding port
                    log.warn("DynamiaTasks: server stdout ended. Output:\n${outputLines.joinToString("\n")}")
                    if (!future.isDone) future.complete(null)
                }
            } catch (e: Exception) {
                if (!future.isDone) future.completeExceptionally(e)
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

    private fun resolveNodeExecutable(): String {
        val home = System.getProperty("user.home")

        // Fixed candidate paths (most common install locations)
        val candidates = listOf(
            "/usr/local/bin/node",
            "/usr/bin/node",
            "/opt/homebrew/bin/node",              // macOS ARM Homebrew
            "/opt/homebrew/opt/node/bin/node",
            "$home/.volta/bin/node",
            "$home/.fnm/aliases/default/bin/node",
        )

        // Direct hits
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

        // Try `which node` as last resort (may work on well-configured PATH)
        runCatching {
            val result = ProcessBuilder("which", "node")
                .also { it.environment()["PATH"] = System.getenv("PATH") ?: "/usr/local/bin:/usr/bin:/bin" }
                .start().inputStream.bufferedReader().readLine()?.trim()
            if (!result.isNullOrEmpty()) return result
        }

        // Last fallback — rely on PATH at exec time
        return "node"
    }

    private fun resolveServerBundle(): String {
        val home = System.getProperty("user.home")

        // 1. Monorepo dev — prefer the live cli.mjs so changes are picked up immediately
        val codeSourcePath = runCatching {
            File(NodeServerManager::class.java.protectionDomain.codeSource.location.toURI())
        }.getOrNull()
        if (codeSourcePath != null) {
            val candidates = listOf(
                // Running from build/classes/kotlin/main inside the monorepo
                File(codeSourcePath, "../../../../apps/web/cli.mjs"),
                File(codeSourcePath, "../../../../../apps/web/cli.mjs"),
                File(codeSourcePath.parentFile, "../../../../apps/web/cli.mjs"),
                File(codeSourcePath.parentFile, "../../../../../apps/web/cli.mjs"),
                // Absolute monorepo location based on home
                File(home, "IdeaProjects/dynamia-tasks/apps/web/cli.mjs"),
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
     * Extracts the /nuxt-output/ tree from the JAR to a temp directory so that
     * cli.mjs can find .output/server/index.mjs at a predictable relative path.
     */
    private fun extractNuxtOutputToTemp() {
        val version = NodeServerManager::class.java.`package`?.implementationVersion ?: "dev"
        val destDir = File(System.getProperty("java.io.tmpdir"), "dynamia-tasks-$version")

        if (File(destDir, ".output/server/index.mjs").exists()) {
            log.info("DynamiaTasks: reusing extracted Nuxt output at ${destDir.absolutePath}")
            return
        }

        log.info("DynamiaTasks: extracting Nuxt output to ${destDir.absolutePath}")
        destDir.mkdirs()

        val codeSource = NodeServerManager::class.java.protectionDomain.codeSource.location
        val jar = java.util.jar.JarFile(File(codeSource.toURI()))
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
        log.info("DynamiaTasks: Nuxt output extracted to ${destDir.absolutePath}")
    }

    private fun extractToTemp(resourcePath: String, fileName: String): String {
        val version = NodeServerManager::class.java.`package`?.implementationVersion ?: "dev"
        val destFile = File(System.getProperty("java.io.tmpdir"), "dynamia-tasks-$version/$fileName")
        if (!destFile.exists()) {
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
