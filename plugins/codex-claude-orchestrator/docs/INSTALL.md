# Install Guide

## Scope

This guide is the fastest Windows-first path for testing the extension on another computer.

If you only want to know whether the project is usable on a fresh machine, use the **mock** path first. It does not depend on Claude Code.

## Prerequisites

Install these first:

- Node.js 20 or newer
- Codex CLI

Optional:

- Claude Code CLI, if you want to test the `claude` provider

## Option A: Test from the packaged release

This is the best approximation of what external users will do.

### 1. Copy the release zip to the other computer

Use:

```text
plugins/codex-claude-orchestrator/dist/codex-claude-orchestrator-v0.2.0.zip
```

Unzip it anywhere, for example:

```text
D:\tools\codex-claude-orchestrator-v0.2.0\
```

After unzipping, you should have:

```text
<release-root>\
  .agents\plugins\marketplace.json
  plugins\codex-claude-orchestrator\
```

### 2. Log in to Codex

If the machine uses API only:

```powershell
codex login --with-api-key
```

### 3. Register the marketplace root

```powershell
codex plugin marketplace add <release-root>
```

Example:

```powershell
codex plugin marketplace add D:\tools\codex-claude-orchestrator-v0.2.0
```

### 4. Register the MCP server

The most explicit path is:

```powershell
codex mcp add codex-claude-orchestrator -- node <plugin-root>\bin\cco-mcp-server.mjs
```

Example:

```powershell
codex mcp add codex-claude-orchestrator -- node D:\tools\codex-claude-orchestrator-v0.2.0\plugins\codex-claude-orchestrator\bin\cco-mcp-server.mjs
```

You can also use the bundled installer:

```powershell
cd <plugin-root>
powershell -ExecutionPolicy Bypass -File .\scripts\install-codex-extension.ps1 -SkipMarketplace
```

Use `-SkipMarketplace` here because the release root has already been added in step 3.

## Option B: Test directly from the repository checkout

If you clone the repo onto another computer:

```powershell
cd <repo-root>\plugins\codex-claude-orchestrator
powershell -ExecutionPolicy Bypass -File .\scripts\install-codex-extension.ps1
```

This route is convenient for development machines because it can register both the marketplace root and the MCP entry in one step.

## Validation checklist

From the plugin root:

```powershell
node .\bin\cco.mjs doctor
codex mcp get codex-claude-orchestrator --json
node .\scripts\test-mcp-server.mjs
```

What success looks like:

- `doctor` shows `node` and `codex` as available
- `codex mcp get codex-claude-orchestrator --json` prints a stdio server config
- `test-mcp-server.mjs` ends with `MCP server smoke test passed.`

## Fastest first-run task

Start with the mock provider because it has the fewest dependencies:

```powershell
node .\bin\cco.mjs run --config .\examples\tasks\mock-doc-preview.json --json
node .\bin\cco.mjs status --config .\examples\tasks\mock-doc-preview.json --json
node .\bin\cco.mjs apply --config .\examples\tasks\mock-doc-preview.json --json
```

This verifies:

- preview artifact generation
- run status inspection
- apply flow into the formal target path

## If you want to test Claude Code too

Install and log in to Claude Code first, then run:

```powershell
node .\bin\cco.mjs run --config .\examples\tasks\claude-doc-preview.json --json
```

## If you want to test Codex as the execution plane

Run:

```powershell
node .\bin\cco.mjs run --config .\examples\tasks\codex-smoke.json --json
```

This is the cleanest API-only validation path.

## Cleanup

To remove the local MCP registration:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-codex-extension.ps1 -Alias codex-claude-orchestrator -KeepMarketplace
```

To remove both the MCP entry and marketplace registration:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-codex-extension.ps1 -Alias codex-claude-orchestrator
```

## Recommended reset flow for repeated testing

If you are iterating on multiple versions, use this sequence:

```powershell
cd <repo-root>\plugins\codex-claude-orchestrator
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-codex-extension.ps1 -Alias codex-claude-orchestrator -KeepMarketplace
powershell -ExecutionPolicy Bypass -File .\scripts\install-codex-extension.ps1 -Force
node .\scripts\test-mcp-server.mjs
```

That gives you a clean `codex-claude-orchestrator` reinstall without forcing you to re-add the marketplace each time.
