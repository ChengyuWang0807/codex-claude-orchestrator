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
codex mcp add codex-claude-orchestrator -- node <repo-root>\plugins\codex-claude-orchestrator\bin\cco-mcp-server.mjs
```

### 3. Or use the bundled installer

```powershell
cd <repo-root>\plugins\codex-claude-orchestrator
powershell -ExecutionPolicy Bypass -File .\scripts\install-codex-extension.ps1 -Force
```

## Fresh-machine guide

Use the dedicated installation guide for another computer:

- [plugins/codex-claude-orchestrator/docs/INSTALL.md](./plugins/codex-claude-orchestrator/docs/INSTALL.md)

## Demo gallery

If you want to showcase the MCP's ability to let Codex orchestrate Claude Code, start here:

- [plugins/codex-claude-orchestrator/docs/DEMO.md](./plugins/codex-claude-orchestrator/docs/DEMO.md)
- [plugins/codex-claude-orchestrator/docs/DEMO.zh-CN.md](./plugins/codex-claude-orchestrator/docs/DEMO.zh-CN.md)

The demo guide includes:

- preview-only Claude delegation
- validation-gated apply
- persistent task-session reuse
- Claude-vs-Codex execution-plane comparison

The default MCP server name is `codex-claude-orchestrator`. The older short alias `cco` is kept only as a legacy compatibility name during migration.

## Reinstall for iterative testing

If you are testing multiple versions and want to remove the previous install first, use this reset flow:

```powershell
cd <repo-root>\plugins\codex-claude-orchestrator
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-codex-extension.ps1 -Alias codex-claude-orchestrator -KeepMarketplace
powershell -ExecutionPolicy Bypass -File .\scripts\install-codex-extension.ps1 -Force
```

If you also want to remove the marketplace registration and do a full clean reset:

```powershell
cd <repo-root>\plugins\codex-claude-orchestrator
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-codex-extension.ps1 -Alias codex-claude-orchestrator
```

## What to tell Codex

If you want Codex to handle the whole deployment flow for you, paste this directly:

```text
Please deploy and verify codex-claude-orchestrator from GitHub using HTTPS only.

1. Clone `https://github.com/ChengyuWang0807/codex-claude-orchestrator.git`.
2. Enter `.\codex-claude-orchestrator\plugins\codex-claude-orchestrator`.
3. If Codex login is required, tell me to run `codex login --with-api-key` first.
4. If an old `cco` or `codex-claude-orchestrator` install exists, run `powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-codex-extension.ps1 -Alias codex-claude-orchestrator -KeepMarketplace` first.
5. Run `powershell -ExecutionPolicy Bypass -File .\scripts\install-codex-extension.ps1 -Force`.
6. Run `codex mcp get codex-claude-orchestrator --json`.
7. Run `node .\scripts\test-mcp-server.mjs`.
8. Run `node .\bin\cco.mjs run --config .\examples\tasks\mock-doc-preview.json --json`.
9. Tell me whether clone, uninstall, installation, MCP wiring, and the mock preview workflow all succeeded. If anything fails, show the failing step and the fix.
```

## Validation

From the plugin root:

```powershell
node .\bin\cco.mjs doctor
codex mcp get codex-claude-orchestrator --json
node .\scripts\test-mcp-server.mjs
```

## What this project is

- Codex as the upper-layer control plane
- Claude Code, Codex, or mock as the execution plane
- Preview-first task orchestration instead of direct overwrite-by-default automation

## License

MIT. See [LICENSE](./LICENSE).
