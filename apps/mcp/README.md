# @dynamia-tasks/mcp

MCP server (stdio) that lets an agent manage the local Dynamia Tasks of a project (`.dynamia/tasks/*.json`). No token, no network.

## Bundled with the plugins

`pnpm build:mcp` produces one self-contained file, `apps/mcp/dist/dynamia-tasks-mcp.mjs` (needs only Node 20+). The VS Code extension and the IntelliJ plugin ship it and copy it to `~/.dynamiatasks/mcp/` each time they start. VS Code 1.101+ also registers it in its own MCP list. IntelliJ cannot register MCP servers from a plugin, so the guide in the plugin's **Settings → MCP for agents** (with a Verify button) shows the JSON to paste. `node dynamia-tasks-mcp.mjs --version` is what Verify runs.

## Use from source

```bash
pnpm build:packages && pnpm --filter @dynamia-tasks/mcp build
claude mcp add dynamia-tasks -- node /path/to/dynamia-tasks/apps/mcp/dist/index.js /path/to/project
```

Register it once with `--scope user` and no project path to use it everywhere:

```bash
claude mcp add --scope user dynamia-tasks -- node ~/.dynamiatasks/mcp/dynamia-tasks-mcp.mjs
```

The server starts from the first argument, then `DYNAMIA_TASKS_PROJECT`, then the current directory, and uses the nearest folder (that one or a parent) with `.dynamia/tasks/`. If there is none it is inert: no tools, and its instructions say Dynamia Tasks is not installed or active there.

## Tools (`mcp__dynamia-tasks__*`)

| Tool | What it does |
| --- | --- |
| `list_tasks` | Summaries; filter by `status` (default `open`), `query`, `labels`, `priority` |
| `get_task` | One task in full, with its comments |
| `create_task` | New task in `backlog.json` (title, description, module, labels, priority); also added to the workspace list |
| `update_task` | Change title, description, `done`, module, `priority` (`null` clears it) and labels (`labels` replaces, `addLabels`/`removeLabels` adjust; new names are created) |
| `delete_task` | Remove a task |
| `add_comment` | Markdown comment on a task |
| `list_labels` | Labels in use |
| `add_github_issue_to_workspace` | Add `repo` (`owner/repo`) + issue `number` to the workspace list. Only records the reference; GitHub itself is not queried |

GitHub issues are otherwise out of scope for the MCP.
