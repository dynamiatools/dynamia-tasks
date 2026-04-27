# Contributing to Dynamia Tasks

Thanks for helping improve Dynamia Tasks.

This guide follows standard GitHub contribution practices and focuses on the most valuable ways to contribute:

- Testing the plugin across IDEs and operating systems
- Reporting high-quality issues
- Implementing new connectors

## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Test the Plugin on Different Platforms](#test-the-plugin-on-different-platforms)
- [Report Issues](#report-issues)
- [Implement a New Connector](#implement-a-new-connector)
- [Open a Pull Request](#open-a-pull-request)
- [Style and Project Rules](#style-and-project-rules)

## Ways to Contribute

You can contribute even if you do not write code:

1. Validate UX and workflows in your IDE and OS
2. Report bugs with clear reproduction steps
3. Suggest product improvements or documentation updates
4. Build and publish new connectors
5. Review open pull requests

## Test the Plugin on Different Platforms

One of the best contributions is testing real workflows in different environments.

### Install Sources

- JetBrains IDEs and Android Studio: https://plugins.jetbrains.com/plugin/31430-dynamia-tasks
- VS Code: https://marketplace.visualstudio.com/items?itemName=DynamiaTools.dynamia-tasks

### Recommended Coverage Matrix

Try at least one scenario per row when possible:

| OS | IDEs |
|---|---|
| Windows 11 | VS Code, IntelliJ IDEA, Android Studio |
| macOS | VS Code, IntelliJ IDEA, Android Studio |
| Linux | VS Code, IntelliJ IDEA |

### Core Scenarios to Validate

- Open plugin view and verify server starts correctly
- Configure only `local` connector and manage local tasks
- Configure only `github` connector and browse/manage issues
- Use both connectors at the same time in one workspace
- Verify capability-driven UI behavior (for example, no comments for local tasks)
- Validate offline behavior and cache fallback when network is unavailable

When reporting test results, include:

- OS version
- IDE name and version
- Plugin version
- Node.js version (if relevant)
- Expected behavior vs actual behavior

## Report Issues

Before opening a new issue, search existing issues first.

### What to Include

Use this structure in your issue:

- **Title**: short and specific
- **Summary**: what happened and why it matters
- **Steps to reproduce**: numbered steps
- **Expected result**
- **Actual result**
- **Environment**: OS, IDE, plugin version, Node.js version
- **Logs/screenshots**: include errors from IDE logs, extension host logs, or server output
- **Sample data**: minimal `.tasks/*.json` or config snippet if relevant

### Issue Types

- Bug report
- Regression
- Connector compatibility problem
- UX improvement request
- Documentation gap

## Implement a New Connector

Connectors are first-class extension points in Dynamia Tasks.

### 1) Create a Connector Package

Create a new package in `packages/connector-{name}/`.

Expected files:

- `package.json`
- `tsconfig.json`
- `src/index.ts`
- connector implementation class (for example `src/JiraConnector.ts`)

### 2) Implement `TaskConnector`

Use the interface from `packages/core/src/connectors/types.ts`.

Requirements:

- Unique connector `id` in lowercase kebab-case
- Capability map aligned with real support (`canComment`, `canSubtasks`, etc.)
- Full required methods implemented (`fetchTasks`, `getTask`, `updateTask`, `createTask`, ...)
- Optional methods only when capability is supported

### 3) Register in Server Registry

Register your connector in `apps/web/server/utils/registry.ts`.

### 4) Validate Behavior

- Connector can be configured via API config endpoints
- Unsupported operations return `CAPABILITY_NOT_SUPPORTED`
- UI behavior is capability-driven (not connector-id specific)

### 5) Add Documentation

Update `README.md` (user-facing) and `ARCHITECTURE.md` (technical) if behavior or setup changes.

## Open a Pull Request

Use the default GitHub flow:

1. Fork the repository
2. Create a branch from `main`
3. Make focused commits
4. Push branch to your fork
5. Open a pull request

### PR Checklist

- Clear title and description
- Linked issue (if one exists)
- Scope is focused (one topic per PR)
- Tests or validation notes included
- Screenshots or short recordings for UI changes
- Documentation updated when needed

## Style and Project Rules

Please follow repository architecture and coding rules:

- Read `ARCHITECTURE.md`
- Keep the app local-first (no cloud backend)
- Do not use `localStorage` for connector config or tokens
- Keep task-related types in `packages/core/src/types.ts`
- Route task operations through server API (no direct connector usage in SPA)
- Use capability-driven UI checks instead of connector-id checks

Thanks again for contributing to Dynamia Tasks.

