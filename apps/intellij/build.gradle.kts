import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("org.jetbrains.kotlin.jvm")          version "2.1.20"
    id("org.jetbrains.intellij.platform")   version "2.3.0"
}

group   = providers.gradleProperty("pluginGroup").get()
version = providers.gradleProperty("pluginVersion").get()

val javaVersion = providers.gradleProperty("javaVersion").orElse("17").get()

kotlin {
    // Use the OS/environment JDK (JAVA_HOME/current JVM) and only pin the bytecode target.
    compilerOptions {
        jvmTarget.set(JvmTarget.fromTarget(javaVersion))
    }
}

java {
    val target = JavaVersion.toVersion(javaVersion)
    sourceCompatibility = target
    targetCompatibility = target
}

tasks.withType<JavaCompile>().configureEach {
    options.release.set(javaVersion.toInt())
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
        pluginVerifier()
        testFramework(TestFrameworkType.Platform)
    }

    // IDE Bridge — IntelliJ implementation (local project during dev)
    implementation(project(":ide-bridge-intellij"))
    // OR when consuming from Maven Central:
    // implementation("tools.dynamia:ide-bridge-intellij:1.0.0")

    // Gson bundled by IntelliJ Platform — compileOnly so it doesn't double-ship
    compileOnly("com.google.code.gson:gson:2.10.1")
}

intellijPlatform {
    pluginConfiguration {
        name = providers.gradleProperty("pluginName")
        version = providers.gradleProperty("pluginVersion")
        ideaVersion {
            sinceBuild = "251"        // 2025.1 minimum
            untilBuild = provider { null } // no upper bound → compatible with all future versions
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

// ── Copy bundled Nuxt SPA into plugin resources ───────────────────────────────
// The SPA is now pure static (no Nitro server). We only copy .output/public/.

val nuxtPublicDir = file("${rootProject.projectDir}/../../apps/web/.output/public")
val generatedResources = layout.buildDirectory.dir("generated-resources")

tasks.register<Copy>("copyNuxtSpa") {
    from(nuxtPublicDir)
    into(generatedResources.map { it.dir("web") })
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    onlyIf { nuxtPublicDir.exists() }
}

// Register the generated directory as a resource source set so that
// processResources picks it up and includes it in the plugin JAR.
sourceSets["main"].resources.srcDir(generatedResources)

tasks.named<Copy>("processResources") {
    dependsOn("copyNuxtSpa")
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
}
