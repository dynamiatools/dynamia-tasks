# @dynamia-tasks/mcp

MCP server (stdio) that lets an agent manage the local Dynamia Tasks of a project (`.dynamia/tasks/*.json`). No token, no network.

## Bundled with the plugins

`pnpm build:mcp` produces one self-contained file, `apps/mcp/dist/dynamia-tasks-mcp.mjs` (needs only Node 20+). The VS Code extension and the IntelliJ plugin ship it and copy it to `~/.dynamiatasks/mcp/` each time they start. VS Code 1.101+ also registers it in its own MCP list. IntelliJ cannot register MCP servers from a plugin, so the guide in the plugin's **Settings → MCP for agents** (with a Verify button) shows the JSON to paste. `node dynamia-tasks-mcp.mjs --version` is what Verify runs.

## Use from source

```bash
pnpm build:packages && pnpm --filter @dynamia-tasks/mcp build
claude mcp add dynamia-tasks -- node /path/to/dynamia-tasks/apps/mcp/dist/index.js /path/to/project
```

The project root is the first argument, then `DYNAMIA_TASKS_PROJECT`, then the current directory.

## Tools (`mcp__dynamia-tasks__*`)

| Tool | What it does |
| --- | --- |
| `list_tasks` | Summaries; filter by `status` (default `open`), `query`, `labels` |
| `get_task` | One task in full, with its comments |
| `create_task` | New task in `backlog.json` |
| `update_task` | Change fields; `done: true` completes it |
| `delete_task` | Remove a task |
| `add_comment` | Markdown comment on a task |
| `list_labels` | Labels in use |
| `add_github_issue_to_workspace` | Add `repo` (`owner/repo`) + issue `number` to the workspace list. Only records the reference; GitHub itself is not queried |

GitHub issues are otherwise out of scope for the MCP.
