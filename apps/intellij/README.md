# IntelliJ Plugin — `apps/intellij`

## Responsabilidad

Este plugin integra Dynamia Tasks en IntelliJ IDEA como un Tool Window con panel JCEF.

## Qué hace

1. `DynamiaTasksPlugin.kt` — `StartupActivity`: determina `project.basePath`, lanza `NodeServerManager`
2. `NodeServerManager.kt` — ejecuta `node packages/server/dist/cli.js` como proceso hijo con `ProcessBuilder`:
   ```kotlin
   ProcessBuilder(
     "node", serverBundlePath,
     "--port", "7842",
     "--cwd", project.basePath ?: homePath,
     "--ide-callback", "http://127.0.0.1:7843"
   ).start()
   ```
3. `IdeCallbackServer.kt` — servidor HTTP embebido en puerto `7843`:
   - `POST /ide/open-file` → `OpenFileDescriptor(project, file, line).navigate(true)`
   - `POST /ide/notify` → `Notifications.Bus.notify(Notification(...))`
4. `DynamiaTasksWindowFactory.kt` — crea el Tool Window
5. `DynamiaTasksPanel.kt` — JCEF Browser apuntando a `http://localhost:7842`, inyecta `window.__dynamia_host = 'intellij'` via `executeJavaScript` antes del page load

## Stack

- Kotlin + Gradle + IntelliJ Platform Plugin SDK
- `plugin.xml` declara: `toolWindow`, `applicationService`, `postStartupActivity`
- Minimum IDE version: 2024.1

## Build pendiente

```bash
cd apps/intellij
./gradlew buildPlugin
```

## Estructura esperada

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

