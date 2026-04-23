# IntelliJ Plugin — `apps/intellij`

## Responsibility

This plugin integrates Dynamia Tasks into IntelliJ IDEA as a Tool Window with a JCEF panel.

## What It Does

1. `DynamiaTasksPlugin.kt` — `StartupActivity`: resolves `project.basePath`, launches `NodeServerManager`
2. `NodeServerManager.kt` — runs `node packages/server/dist/cli.js` as a child process via `ProcessBuilder`:
   ```kotlin
   // Do NOT pass --port: the CLI auto-selects the first free port from 7842.
   // The actual port is persisted in ~/.dynamiatasks/instances/<hash>.json
   // and exposed at GET /api/instance once the server is up.
   ProcessBuilder(
     "node", serverBundlePath,
     "--cwd", project.basePath ?: homePath,
     "--ide-callback", "http://127.0.0.1:<callbackPort>"
   ).start()
   ```
   After launching the process, read the actual port using one of these methods (in order of preference):
   - **Stdout**: parse the line `✓ dynamia-tasks server running on http://localhost:<PORT>` from the process output.
   - **Instance file**: read `~/.dynamiatasks/instances/<sha1(projectPath)[0..12]>.json` → field `port`.
   - **Endpoint**: `GET http://localhost:<PORT>/api/instance` (requires knowing the port first; useful for verification).
3. `IdeCallbackServer.kt` — embedded HTTP server on an auto-selected port (starting from 7843):
   - `POST /ide/open-file` → `OpenFileDescriptor(project, file, line).navigate(true)`
   - `POST /ide/notify` → `Notifications.Bus.notify(Notification(...))`
4. `DynamiaTasksWindowFactory.kt` — creates the Tool Window
5. `DynamiaTasksPanel.kt` — JCEF Browser pointing to `http://localhost:<PORT>` (discovered in step 2), injects `window.__dynamia_host = 'intellij'` via `executeJavaScript` before page load. The SPA uses `window.location.origin` as its API base — no port is hardcoded in the frontend.

## Stack

- Kotlin + Gradle + IntelliJ Platform Plugin SDK
- `plugin.xml` declares: `toolWindow`, `applicationService`, `postStartupActivity`
- Minimum IDE version: 2024.1

## Build

```bash
cd apps/intellij
./gradlew buildPlugin
```

## Expected Structure

```
apps/intellij/
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties
├── src/main/
│   ├── kotlin/com/dynamia/tasks/
│   │   ├── DynamiaTasksPlugin.kt
│   │   ├── DynamiaTasksWindowFactory.kt
│   │   ├── DynamiaTasksPanel.kt
│   │   └── server/
│   │       ├── NodeServerManager.kt
│   │       └── IdeCallbackServer.kt
│   └── resources/
│       └── META-INF/plugin.xml
└── src/main/resources/
    └── web/               # copy of apps/web/.output/public/
```
