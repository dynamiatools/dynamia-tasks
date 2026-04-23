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

// ── Copy Nuxt static output + server bundle into plugin resources ────────────
val webOutputDir    = file("${rootProject.projectDir}/../../apps/web/.output/public")
val serverBundleDir = file("${rootProject.projectDir}/../../packages/server/dist")

tasks.register<Copy>("copyWebResources") {
    from(webOutputDir)
    into(layout.projectDirectory.dir("src/main/resources/web"))
    onlyIf { webOutputDir.exists() }
}

tasks.register<Copy>("copyServerBundle") {
    from(serverBundleDir) {
        include("cli.bundle.js")   // self-contained esbuild bundle — no node_modules needed
    }
    into(layout.projectDirectory.dir("src/main/resources/server"))
    onlyIf { File(serverBundleDir, "cli.bundle.js").exists() }
}

tasks.named("processResources") {
    dependsOn("copyWebResources", "copyServerBundle")
}

tasks.named("prepareSandbox") {
    dependsOn("copyWebResources", "copyServerBundle")
}

tasks.named("buildPlugin") {
    dependsOn("copyWebResources", "copyServerBundle")
}


