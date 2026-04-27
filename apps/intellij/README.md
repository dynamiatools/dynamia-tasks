# Dynamia Tasks for IntelliJ IDEA

> Your tasks, your IDE, your rules. Manage GitHub Issues & local tasks without leaving IntelliJ — no cloud, no accounts, just focus.

---

## What is Dynamia Tasks?

Dynamia Tasks is a task manager that lives **inside IntelliJ IDEA**. Instead of switching between browser tabs, issue trackers, or sticky notes, you get a clean task panel right in your IDE — always visible, always in context.

Everything runs **locally on your machine**. No cloud, no telemetry, no accounts required.

---

## Features

- 📋 **Unified task list** — see GitHub Issues and local tasks together in one panel.
- ⚡ **Workspace checklist** — pin only the tasks you're actively working on. Your personal sprint, per project.
- 🔍 **Task Explorer** — browse and pick tasks from any connected source without leaving the IDE.
- 📂 **Open files from tasks** — jump to the relevant file mentioned in a task with a single click.
- 🏷️ **Labels & filters** — filter by status, label, or assignee to stay focused.
- 🔌 **Extensible** — works with GitHub Issues out of the box. Local JSON task files require zero configuration.

---

## Getting Started

1. Install the plugin from the [JetBrains Marketplace](https://plugins.jetbrains.com).
2. Open any project in IntelliJ IDEA.
3. Click the **Dynamia Tasks** icon in the right tool window bar.
4. Start adding local tasks immediately — no setup needed.

---

## Connecting GitHub Issues

To manage GitHub Issues from IntelliJ IDEA:

1. Go to **Settings** (gear icon inside the Dynamia Tasks panel).
2. Select the **GitHub Issues** connector.
3. Enter your repository (e.g. `owner/repo`).
4. Paste a **GitHub Personal Access Token** with the `repo` scope.
   - Generate one at [github.com/settings/tokens](https://github.com/settings/tokens) → *Personal access tokens (classic)* → scope: `repo` (or `public_repo` for public repos only).
5. Save — your issues will appear in the panel instantly.

Your token is stored locally and never leaves your machine.

---

## Compatibility

- IntelliJ IDEA 2025.1 or later
- Other JetBrains IDEs based on the IntelliJ Platform (WebStorm, PyCharm, GoLand, etc.)

---

## Local Development Notes

- Gradle uses the JDK from your environment (`JAVA_HOME` or the JVM used to launch Gradle).
- If you need to pin a local JDK, set it in your user-level Gradle config (`~/.gradle/gradle.properties`) with:
  - `org.gradle.java.home=C:/Path/To/JDK`
- Do not commit machine-specific JDK paths in project files.

---

## Privacy

- ✅ No cloud backend
- ✅ No analytics or telemetry
- ✅ No account or login required
- ✅ All data stays on your machine

---

## Feedback & Issues

Found a bug or have a feature request? Open an issue on [GitHub](https://github.com/dynamiatools/dynamia-tasks/issues).
