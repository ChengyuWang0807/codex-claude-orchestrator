# codex-claude-orchestrator

[English](./README.md) | [简体中文](./README.zh-CN.md)

This repository is a standalone marketplace-style distribution of **Codex Claude Orchestrator**.

It is designed so that Codex users can install the plugin layer and the MCP layer from one clean repository, instead of pulling an unrelated larger workspace.

## Repository layout

```text
.agents/plugins/marketplace.json
plugins/codex-claude-orchestrator/
```

The actual implementation lives here:

- [plugins/codex-claude-orchestrator/README.md](./plugins/codex-claude-orchestrator/README.md)

## Fast install

### 1. Add this repository as a Codex marketplace

```powershell
codex plugin marketplace add ChengyuWang0807/codex-claude-orchestrator
```

### 2. Register the local MCP server

After cloning or downloading the repository, run:

```powershell
codex mcp add cco -- node <repo-root>\plugins\codex-claude-orchestrator\bin\cco-mcp-server.mjs
```

### 3. Or use the bundled installer

```powershell
cd <repo-root>\plugins\codex-claude-orchestrator
powershell -ExecutionPolicy Bypass -File .\scripts\install-codex-extension.ps1 -Force
```

## Fresh-machine guide

Use the dedicated installation guide for another computer:

- [plugins/codex-claude-orchestrator/docs/INSTALL.md](./plugins/codex-claude-orchestrator/docs/INSTALL.md)

## Validation

From the plugin root:

```powershell
node .\bin\cco.mjs doctor
codex mcp get cco --json
node .\scripts\test-mcp-server.mjs
```

## What this project is

- Codex as the upper-layer control plane
- Claude Code, Codex, or mock as the execution plane
- Preview-first task orchestration instead of direct overwrite-by-default automation

## License

MIT. See [LICENSE](./LICENSE).
