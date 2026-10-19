# Dynamia Tasks

> The fastest way to manage development tasks without leaving your IDE.

Dynamia Tasks brings your GitHub issues and local tasks into one clean, focused checklist inside IntelliJ-based IDEs and VS Code.

No cloud account. No telemetry. No context switching.
Just your tasks, where you code.

---

## Why Developers Love It

- **Stay in flow**: manage tasks without opening browser tabs
- **One unified view**: GitHub + local JSON tasks in a single workspace
- **Privacy-first**: fully local architecture, your data stays on your machine
- **Flexible by design**: connector system supports multiple task sources
- **Built for daily execution**: minimal UI, fast interactions, low friction

---

## Screenshots

### IntelliJ / JetBrains IDEs

![Dynamia Tasks in IntelliJ](https://raw.githubusercontent.com/dynamiatools/dynamia-tasks/refs/heads/main/screenshots/intellij-worskpace.png)

### VS Code

![Dynamia Tasks in VS Code](https://raw.githubusercontent.com/dynamiatools/dynamia-tasks/refs/heads/main/screenshots/vscode-worskpace.png)

---

## Install

### JetBrains IDEs + Android Studio

Install from JetBrains Marketplace:

- https://plugins.jetbrains.com/plugin/31430-dynamia-tasks


### VS Code

Install from VS Code Marketplace:

- https://marketplace.visualstudio.com/items?itemName=DynamiaTools.dynamia-tasks

---

## What You Can Do

- Browse and manage GitHub issues by org/repo
- Work with local tasks stored as plain JSON files in `.dynamia/tasks/`
- Build a **personal workspace** with the tasks you are actively working on
- Group tasks by module, label, or title prefix
- Open files and receive IDE-native notifications from task actions
- Continue working offline with local cache support

---

## Perfect For

- Developers who want a task view directly inside the IDE
- Teams that prefer local-first tools over cloud-heavy systems
- Repositories that combine external issues with project-local TODO streams
- AI-assisted workflows that benefit from editable `.dynamia/tasks/*.json` files

---

## Quick Start

1. Install the plugin in your IDE.
2. Open Dynamia Tasks from the IDE sidebar/tool window.
3. Configure your connectors in **Settings**:
   - **GitHub** (optional token)
   - **Local** (`.dynamia/tasks/*.json`)
4. Add tasks to your workspace and start shipping.

---

## GitHub Setup (Optional)

If you use the GitHub connector:

1. Go to https://github.com/settings/tokens
2. Create a token:
   - Classic token: `repo` scope (add `read:org` too if you want to browse organization repositories in the Explorer)
   - Fine-grained token: `Metadata` + `Issues` read/write permissions
3. In Dynamia Tasks, open **Settings > GitHub** and paste your token

Public repositories can work without a token.

---

## Local Tasks Format

Dynamia Tasks reads any `.dynamia/tasks/*.json` file in your project. Edits made by an agent or by hand are picked up automatically (within ~2 seconds).

Projects that still use `.tasks/` are migrated on first run: the files are copied to `.dynamia/tasks/` and the old ones are left in place, so you can delete them.

```json
[
  {
    "id": "local-123e4567-e89b-12d3-a456-426614174000",
    "title": "Refactor IVA calculation",
    "description": "Move logic to IvaService and add unit tests.",
    "done": false,
    "module": "billing",
    "labels": [{ "id": "refactor", "name": "refactor" }],
    "priority": "high",
    "createdAt": "2026-04-21T10:00:00Z",
    "updatedAt": "2026-04-21T10:00:00Z"
  }
]
```

Use unique IDs with `local-{uuid}` format.

---

## Built for Local-First Development

Dynamia Tasks has no server and no backend process. The UI is a static web app bundled directly into each IDE plugin and rendered in an embedded browser (VS Code Webview / JetBrains JCEF). It talks to GitHub and to your local files directly from that embedded browser via the IDE, using [ide-bridge](https://github.com/dynamiatools/ide-bridge):

- The UI is bundled statically into the plugin — nothing to start or serve
- Configuration is stored locally, per IDE
- Workspace state (`.dynamia/tasks/workspace.json`) is stored in your project
- No external backend required

This keeps performance high and ownership in your hands.

---

## For Teams and Contributors

If you want to contribute or build custom connectors, see `CONTRIBUTING.md`.

---

## License

MIT © Dynamia Tools
