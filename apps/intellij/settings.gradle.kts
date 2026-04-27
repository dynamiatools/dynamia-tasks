rootProject.name = "dynamia-tasks-intellij"

// Include ide-bridge-intellij as a composite build for local development.
// In production builds (CI), use the published Maven artifact instead.
includeBuild("../../bridge/ide-bridge-intellij") {
    dependencySubstitution {
        substitute(module("tools.dynamia:ide-bridge-intellij")).using(project(":"))
    }
}

