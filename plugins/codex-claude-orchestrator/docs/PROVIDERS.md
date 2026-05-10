# Providers

## Summary

The runtime treats providers as interchangeable execution adapters under one control-plane contract.

```text
choose_provider = argmax(availability * workflow_fit * operator_familiarity)
```

If `availability = 0`, the provider is not a real option no matter how attractive the workflow fit looks.

## Claude Code

- Invocation shape: `claude --print --bare ...`
- Session style: explicit UUID plus `--session-id` or `--resume`
- Best at: long-form writing or CC-native authoring where Claude should remain the execution specialist

## Codex

- Invocation shape: `codex exec ...` or `codex exec resume ...`
- Session style: persisted thread id or ephemeral mode
- Best at: Codex-first environments, API-key-only setups, and orchestration demos that should stay inside the Codex ecosystem

## Mock

- Invocation shape: built-in deterministic generator
- Session style: none
- Best at: smoke tests, CI validation, onboarding, and preview/apply demonstrations without external model dependencies

## Selection guidance

- Prefer `claude` when the user explicitly wants Claude Code to be the specialist worker.
- Prefer `codex` when the machine only has Codex installed or when the whole stack should be API-key driven.
- Prefer `mock` when validating release quality, MCP wiring, or preview/apply mechanics.
