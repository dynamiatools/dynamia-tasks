# Changelog

All notable changes to the Dynamia Tasks VS Code extension are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.0.0]

- **New MCP server for agents** (tools `mcp__dynamia-tasks__*`), bundled with the extension and
  copied to `~/.dynamiatasks/mcp/` on startup:
  - List tasks (filter by status, text, label and priority), read one with its comments, create
    (it also joins the workspace), update (title, description, done, priority, labels), delete
    and comment.
  - Add a GitHub issue to the workspace by repo and issue number.
  - It only acts in folders that have `.dynamia/tasks/` (also from a subfolder); anywhere else it
    just says the folder has no Dynamia Tasks support. One global registration serves every project.
  - VS Code 1.101+ lists it under *MCP: List Servers*. **Settings → MCP for agents** verifies the
    install and shows how to connect Claude Code, VS Code and IntelliJ.
- **Task files moved to `.dynamia/tasks/`** (task lists, comments and the workspace state).
  Existing `.tasks/*.json` and `.dynamiatasks/workspace.json` are copied automatically the
  first time; the old files are left in place so you can delete them.
- Edits made to those files by an agent or by hand are picked up automatically (within ~2 s).
- Local tasks are no longer lost when `backlog.json` or `comments.json` is corrupt or when
  several changes happen at once; a corrupt file now shows an error instead of being overwritten.
- GitHub: label filters with special characters work, permission errors are no longer reported
  as rate limiting, and repositories load in parallel.
- Security: the web view can only access files in your project and can no longer run arbitrary
  commands.

## [1.0.7]

- Task descriptions and comments now render as Markdown (GitHub-flavored: tables, code
  blocks, task lists) instead of raw text.
- Posting a comment now shows an error notification if it fails, instead of failing silently.

## Earlier versions

Change tracking for this file starts at 1.0.7. For the full history of changes shipped in
prior releases, see the [commit log](https://github.com/dynamiatools/dynamia-tasks/commits/main/apps/web)
(the extension shares its UI code with the IntelliJ plugin under `apps/web`).
