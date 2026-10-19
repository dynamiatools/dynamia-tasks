# @dynamia-tasks/mcp

MCP server (stdio) that lets an agent manage the local Dynamia Tasks of a project (`.dynamia/tasks/*.json`). No token, no network.

## Use

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
