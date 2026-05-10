---
name: cc-orchestrator
description: Use the bundled Codex Claude Orchestrator runtime, plugin, and MCP tools for preview-first document or research workflows across Claude Code, Codex, or the mock adapter. Trigger this skill when Codex should act as the control plane, when a task needs repeatable preview/apply landing, when Claude Code should be orchestrated from a higher layer, or when the user needs MCP-guided installation and validation steps.
---

# Codex Claude Orchestrator

## Core rule

Prefer the MCP tools when they are available.

Use direct shell commands against `node ./bin/cco.mjs ...` only when:

- the MCP server has not been installed yet
- the user is debugging the local runtime itself
- you need a command that is not exposed through the current MCP tool set

## Recommended sequence

1. Check whether the MCP server is already installed:

```powershell
codex mcp get cco --json
```

2. If the MCP server is missing, install it from the plugin root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-codex-extension.ps1
```

3. Validate the runtime:

```powershell
node ./bin/cco.mjs doctor
```

4. Validate the MCP surface:

```powershell
node ./scripts/test-mcp-server.mjs
```

5. Prefer this execution order in real work:

- `cco_doctor`
- `cco_list_tasks`
- `cco_run_task` with preview mode
- `cco_get_run_status`
- human review
- `cco_apply_preview_artifact`

## Preview-first policy

- Default to preview.
- Treat apply as an explicit second step.
- If a task is risky, long-running, or externally visible, inspect the artifact path before applying.

## Useful local commands

```powershell
node ./bin/cco.mjs tasks --dir ./examples/tasks
node ./bin/cco.mjs run --config ./examples/tasks/mock-doc-preview.json
node ./bin/cco.mjs status --config ./examples/tasks/mock-doc-preview.json
node ./bin/cco.mjs apply --config ./examples/tasks/mock-doc-preview.json
```

## What the runtime owns

- task configs
- session policy
- preview/apply landing
- validation and repair
- run and session ledgers
- release packaging

## What the runtime does not own

- generic shell passthrough
- arbitrary Claude Code prompting outside the task contract
- git review or repository policy by itself

## Fallback rule

If Claude Code is unavailable, keep the workflow alive by switching the provider to `codex` or `mock` instead of abandoning the orchestration layer.
