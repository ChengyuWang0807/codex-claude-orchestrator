# Changelog

## 0.2.0 - 2026-05-10

- Added a local stdio MCP server with task-oriented tools for doctor, tasks, run status, session listing, and preview apply.
- Added `status` and `apply` commands to the `cco` runtime so MCP and CLI share the same operational contract.
- Reworked release packaging to emit a marketplace-style release root plus zip archive.
- Added installer, uninstaller, and end-to-end MCP smoke test scripts.
- Added a dedicated fresh-machine installation guide for cross-device testing.
- Rewrote the bundled examples and docs to remove encoding issues and document the plugin, MCP, CLI, and release layers consistently.

## 0.1.0 - 2026-05-09

- Added a standalone CLI with `doctor`, `run`, `tasks`, `sessions`, `watch`, and `pack` commands.
- Added provider adapters for `claude`, `codex`, and `mock`.
- Added session ledgers, sandbox preview artifacts, preview/apply write modes, and validation/repair loops.
- Added a Codex plugin manifest plus a reusable skill entry for orchestration workflows.
- Added sample tasks, prompt templates, context files, release packaging, and watchdog helpers.
