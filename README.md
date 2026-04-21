# Dynamia Tasks

> A minimal, developer-first task manager that lives inside your IDE.

Dynamia Tasks unifies tasks from **any source** into a single checklist UI — fast, no friction, no cloud. It runs entirely local as a plugin for IntelliJ IDEA and VS Code, powered by a flexible **Connector** system.

```
🧾 Billing
  [ ] Fix IVA calculation          ← GitHub Issue #142
  [x] Price rounding fix           ← GitHub Issue #98

📊 Reports
  [ ] Refactor sales filter        ← local task
```

---

## Features

- **Connector system** — pluggable task sources; add GitHub, local files, or any third-party tool
- **GitHub Issues** — browse by org, repo, labels, or title; manage sub-issues and comments
- **Local tasks** — plain JSON files in `.tasks/`, editable by hand or from the UI
- **Workspace** — curate a focused list of tasks you're actually working on today
- **Capability-driven UI** — each connector declares what it supports; the UI adapts automatically
- **Grouped checklist** — tasks organized by module, label, or `[Module]` prefix in title
- **Offline cache** — issues cached locally when network is unavailable
- **LLM-friendly** — `.tasks/*.json` files are readable and writable by AI agents
- **IDE-native** — open files in editor, native notifications, no browser tab needed

---

## How It Works

```
IDE Plugin (IntelliJ / VS Code)
  └─ spawns Node.js local server on localhost:7842
  └─ opens WebView → http://localhost:7842

Node Server
  ├─ serves Nuxt SPA (static)
  ├─ connector registry (local, github, ...)
  ├─ reads/writes ~/.dynamiatasks/config.json
  └─ reads/writes {project}/.dynamiatasks/workspace.json

Connectors
  ├─ local   → {project}/.tasks/*.json
  ├─ github  → GitHub REST API (with your PAT)
  └─ ...     → any third-party source

Nuxt SPA
  └─ talks to server via fetch() → localhost:7842
  └─ never talks to connectors directly
```

No cloud. No telemetry. No accounts. Just your token, your files, your IDE.

---

## Connector System

Every task source is a **Connector** — a package that implements a standard interface. The UI adapts automatically based on what each connector declares it can do:

| Capability | GitHub | Local | (your connector) |
|---|---|---|---|
| Create tasks | ✅ | ✅ | ? |
| Edit tasks | ✅ | ✅ | ? |
| Delete tasks | ❌ | ✅ | ? |
| Comments | ✅ | ❌ | ? |
| Sub-tasks | ✅ | ❌ | ? |
| Labels | ✅ | ✅ | ? |
| Assignees | ✅ | ❌ | ? |
| Explorer | ✅ | ❌ | ? |

Adding a new connector requires only creating a new package — no changes to the core, SPA, or IDE plugins.

---

## Installation

### VS Code

> Coming soon on the VS Code Marketplace.

Install from VSIX:

```bash
pnpm build:vscode
code --install-extension apps/vscode/dynamia-tasks.vsix
```

### IntelliJ IDEA

> Coming soon on JetBrains Marketplace.

Install from disk:

```
Settings → Plugins → ⚙️ → Install Plugin from Disk...
→ select apps/intellij/build/libs/dynamia-tasks.jar
```

---

## Requirements

- **Node.js** 20+ (must be in PATH)
- **GitHub Personal Access Token** — only if using the GitHub connector
- IntelliJ IDEA 2023.1+ or VS Code 1.85+

---

## GitHub Setup

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Generate a **classic token** with these scopes:

| Scope | Required For |
|---|---|
| `repo` | Read/write issues and comments (private repos) |
| `read:org` | Browse organization repositories |

3. Open Dynamia Tasks → **Settings → GitHub** → paste your token
4. Add your organizations or specific repos

> Public repos work with no token.

---

## File Structure

### Global (`~/.dynamiatasks/`)

```
~/.dynamiatasks/
├── config.json          # All connector configs + UI preferences
└── cache/
    └── *.json           # Per-connector offline cache
```

### Per Project

```
your-project/
├── .dynamiatasks/
│   └── workspace.json   # Your curated task list (gitignore this)
└── .tasks/
    ├── backlog.json      # Local tasks
    └── sprint-may.json   # As many files as you want
```

Add `.dynamiatasks/` to your `.gitignore`. Commit `.tasks/` if you want to share local tasks with your team.

---

## Local Tasks

Local tasks are plain JSON — edit directly or via the UI. Both work.

```json
[
  {
    "id": "local-f3a1c2b4",
    "title": "Refactor IVA calculation",
    "description": "Move logic to IvaService, add unit tests.",
    "done": false,
    "module": "billing",
    "labels": [{ "id": "refactor", "name": "refactor" }],
    "priority": "high",
    "createdAt": "2026-04-21T10:00:00Z",
    "updatedAt": "2026-04-21T10:00:00Z"
  }
]
```

Any `.tasks/*.json` file is picked up automatically. IDs must be unique across all files — use `"local-{uuid}"` format.

---

## Task Grouping

Tasks in the workspace are grouped by:

1. `task.module` field (explicit)
2. First label name
3. `[Module]` prefix in title → `[Billing] Fix IVA` → group `billing`
4. Fallback: `other`

---

## Monorepo Structure

```
dynamia-tasks/
├── packages/
│   ├── core/              # Shared types and connector interface
│   ├── server/            # Fastify local server + connector registry
│   ├── connector-local/   # Built-in: local JSON tasks
│   └── connector-github/  # Built-in: GitHub Issues
└── apps/
    ├── web/               # Nuxt 3 SPA (static)
    ├── vscode/            # VS Code extension
    └── intellij/          # IntelliJ plugin (Kotlin)
```

---

## Development

### Setup

```bash
git clone https://github.com/dynamia-tools/dynamia-tasks
cd dynamia-tasks
pnpm install
```

### Run (browser standalone mode)

```bash
# Terminal 1 — local server
pnpm dev:server

# Terminal 2 — Nuxt SPA
pnpm dev:web
```

Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
pnpm build:all       # everything
pnpm build:web       # Nuxt SPA only
pnpm build:vscode    # VS Code extension
```

---

## Writing a Connector

Implement the `TaskConnector` interface from `@dynamia-tasks/core`:

```typescript
import type { TaskConnector, ConnectorTask, TaskFilter } from '@dynamia-tasks/core'

export class MyConnector implements TaskConnector {
  readonly id = 'my-connector'
  readonly name = 'My Task Source'
  readonly icon = '🔌'
  readonly capabilities = {
    canCreate: true, canDelete: false, canEdit: true,
    canComment: false, canSubtasks: false, canAssign: false,
    canLabel: true, hasDetail: true, hasExplorer: true,
  }

  async isConfigured() { return true }
  async configure(config: unknown) { /* save config */ }
  getConfigSchema() { return { fields: [ /* your fields */ ] } }

  async fetchTasks(filter?: TaskFilter): Promise<ConnectorTask[]> {
    // fetch from your source, map to ConnectorTask
  }

  // implement remaining required methods...
}
```

Then register it in `packages/server/src/connectors/registry.ts`:

```typescript
import { MyConnector } from '@dynamia-tasks/connector-my'
registerConnector(new MyConnector())
```

That's it. The server, SPA, and IDE plugins work automatically.

---

## Architecture

Full details on data models, API contracts, connector interface, IDE plugin internals, and agent implementation guidelines:

**[ARCHITECTURE.md](./ARCHITECTURE.md)**

---

## Roadmap

### MVP
- [x] Architecture + connector system design
- [ ] Monorepo + core types + connector interface
- [ ] `connector-local` + `connector-github`
- [ ] Local server (Fastify) with generic connector routes
- [ ] Nuxt SPA + workspace view + explorer
- [ ] VS Code extension
- [ ] IntelliJ plugin

### Phase 2
- [ ] Task detail with capability-driven sections
- [ ] GitHub comments + sub-issues
- [ ] Local task CRUD from UI + file watcher
- [ ] Auto-rendered connector config forms

### Phase 3
- [ ] Dark mode + keyboard shortcuts
- [ ] Connector SDK documentation
- [ ] Example: `connector-linear` or `connector-jira`
- [ ] Workspace search + drag-and-drop reorder

---

## Contributing

Read [ARCHITECTURE.md](./ARCHITECTURE.md) before contributing — especially the **Connector System** and **Agent Guidelines** sections.

```bash
pnpm install
pnpm dev:server & pnpm dev:web
```

---

## License

MIT © [Dynamia Tools](https://github.com/dynamia-tools)
