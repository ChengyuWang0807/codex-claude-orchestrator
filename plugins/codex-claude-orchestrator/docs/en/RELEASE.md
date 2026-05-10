# Release

## Build

From the plugin root:

```powershell
node .\bin\cco.mjs pack
```

## Output

The release command creates:

- `dist/codex-claude-orchestrator-v0.2.0/`
- `dist/codex-claude-orchestrator-v0.2.0.zip`

The staged directory is already shaped like a Codex marketplace root:

```text
release-root/
  .agents/plugins/marketplace.json
  plugins/codex-claude-orchestrator/
  release-manifest.json
```

## Recommended publish flow

1. Run `node .\scripts\test-mcp-server.mjs`.
2. Run `node .\bin\cco.mjs pack`.
3. Smoke-test the staged release with a fresh Codex environment.
4. Publish the zip and the repository source.

## Fresh-machine install contract

After unzipping the release:

```powershell
codex plugin marketplace add <release-root>
```

Then register the MCP server:

```powershell
codex mcp add cco -- node <plugin-root>\bin\cco-mcp-server.mjs
```

Or use the bundled installer:

```powershell
powershell -ExecutionPolicy Bypass -File .\plugins\codex-claude-orchestrator\scripts\install-codex-extension.ps1
```

## What to verify before publishing

- `doctor` sees `node` and at least one real provider
- the mock preview task succeeds
- `scripts/test-mcp-server.mjs` passes
- the packed release contains `.agents/plugins/marketplace.json`
- the plugin manifest points to `.mcp.json`
