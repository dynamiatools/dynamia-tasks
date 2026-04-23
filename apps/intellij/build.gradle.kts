import org.jetbrains.intellij.platform.gradle.TestFrameworkType

plugins {
    id("org.jetbrains.kotlin.jvm")          version "2.1.20"
    id("org.jetbrains.intellij.platform")   version "2.3.0"
}

group   = providers.gradleProperty("pluginGroup").get()
version = providers.gradleProperty("pluginVersion").get()

val javaVersion: String by project

kotlin {
    jvmToolchain(javaVersion.toInt())
}

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        val platformVersion: String by project
        val platformType:    String by project
        create(platformType, platformVersion)

        // JCEF is bundled — no extra dependency needed
        bundledPlugin("com.intellij.platform.images") // lightweight, keeps deps minimal
        instrumentationTools()
        pluginVerifier()
        testFramework(TestFrameworkType.Platform)
    }
}

intellijPlatform {
    pluginConfiguration {
        name = providers.gradleProperty("pluginName")
        version = providers.gradleProperty("pluginVersion")
        ideaVersion {
            sinceBuild = "251"   // 2025.1
        }
    }

    signing {
        // Sign only in CI via environment variables:
        // CERTIFICATE_CHAIN, PRIVATE_KEY, PRIVATE_KEY_PASSWORD, PUBLISH_TOKEN
        certificateChainFile   = providers.environmentVariable("CERTIFICATE_CHAIN_FILE")
            .map { file(it) }.orElse(provider { null }).orNull?.let { it } ?: run { null }
    }

    publishing {
        token = providers.environmentVariable("PUBLISH_TOKEN")
    }

    pluginVerification {
        ides {
            recommended()
        }
    }
}

// ── Copy Nuxt full-stack output into plugin resources ────────────────────────
// Nuxt build produces:
//   .output/server/  → Nitro server bundle (index.mjs + chunks/)
//   .output/public/  → Static SPA assets (served by Nitro automatically)
// We also bundle cli.mjs (the port-discovery launcher) separately.
val nuxtOutputDir = file("${rootProject.projectDir}/../../apps/web/.output")
val nuxtCliFile   = file("${rootProject.projectDir}/../../apps/web/cli.mjs")

tasks.register<Copy>("copyNuxtOutput") {
    from(nuxtOutputDir)
    into(layout.projectDirectory.dir("src/main/resources/nuxt-output"))
    onlyIf { nuxtOutputDir.exists() }
}

tasks.register<Copy>("copyCliLauncher") {
    from(nuxtCliFile)
    into(layout.projectDirectory.dir("src/main/resources/server"))
    onlyIf { nuxtCliFile.exists() }
}

tasks.named("processResources") {
    dependsOn("copyNuxtOutput", "copyCliLauncher")
}

tasks.named("prepareSandbox") {
    dependsOn("copyNuxtOutput", "copyCliLauncher")
}

tasks.named("buildPlugin") {
    dependsOn("copyNuxtOutput", "copyCliLauncher")
}


