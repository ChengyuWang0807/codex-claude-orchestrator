# Demo Guide

[English](./DEMO.md) | [简体中文](./DEMO.zh-CN.md)

This guide is for showcasing one very specific story:

```text
Codex = control plane
codex-claude-orchestrator MCP = orchestration contract
Claude Code = execution plane
```

If you want to prove that Codex is not just "prompting Claude Code directly", but is instead governing task selection, preview/apply policy, validation, and session reuse through an MCP layer, these are the best demos to run.

## Demo Matrix

| Demo | What it proves | Primary task | Primary MCP tools |
| --- | --- | --- | --- |
| Demo 1 | Codex can delegate a real writing task to Claude Code without directly writing the final file | `claude-doc-preview` | `cco_doctor`, `cco_list_tasks`, `cco_run_task`, `cco_get_run_status` |
| Demo 2 | Codex can enforce a validation gate before formal landing | `claude-doc-preview` | `cco_run_task`, `cco_get_run_status`, `cco_apply_preview_artifact` |
| Demo 3 | Claude Code can stay bound to a persistent task session across repeated runs | `claude-doc-preview` | `cco_run_task`, `cco_list_sessions` |
| Demo 4 | The same orchestration layer can target Claude Code or Codex as the execution plane | `claude-doc-preview`, `codex-doc-preview` | `cco_run_task`, `cco_get_run_status` |
| Demo 5 | The pipeline still works as a deterministic onboarding demo even without an external executor | `mock-doc-preview` | `cco_run_task`, `cco_get_run_status` |

## Demo 1: Preview-Only Claude Delegation

Use this first if you want the shortest proof that Codex can command Claude Code through `codex-claude-orchestrator`.

What to paste into Codex:

```text
Use the `codex-claude-orchestrator` MCP server to demonstrate Codex controlling Claude Code.

1. Run `cco_doctor`.
2. Run `cco_list_tasks`.
3. Run the `claude-doc-preview` task.
4. Inspect the latest run status.
5. Do not apply the preview artifact yet.
6. Tell me:
   - which steps were executed through `codex-claude-orchestrator`,
   - which part stayed in Codex,
   - where the preview artifact was written,
   - whether the validation checks passed.
```

What this proves:

- Codex chooses the task and inspects the result.
- Claude Code performs the actual document generation.
- The output stays in preview mode instead of directly overwriting the formal file.

Where to look afterward:

- Preview artifact:
  `examples/workspace/.cco/sandbox/claude-doc-preview/runs/<run-id>/`
- Formal target path that has not been applied yet:
  `examples/workspace/generated/control-plane-vs-execution-plane.md`

## Demo 2: Validation-Gated Apply

Use this when you want to show that Codex is acting like a release manager rather than a blind relay.

What to paste into Codex:

```text
Use the `codex-claude-orchestrator` MCP server to run the `claude-doc-preview` task, inspect the preview, and apply it only if validation passed.

Workflow:
1. Run the task through `codex-claude-orchestrator`.
2. Check the latest run status.
3. If validation passed, apply the preview artifact.
4. Report:
   - whether the apply step happened,
   - the final generated file path,
   - which validation checks were used as the gate.
```

What this proves:

- Claude Code is not the final authority over landing changes.
- Codex can enforce a preview-first workflow.
- `codex-claude-orchestrator` exposes a structured "apply only after inspection" contract.

Expected final path after apply:

```text
examples/workspace/generated/control-plane-vs-execution-plane.md
```

## Demo 3: Persistent Claude Session Reuse

Use this when you want to show that the system is not stateless fire-and-forget orchestration.

What to paste into Codex:

```text
Use the `codex-claude-orchestrator` MCP server to prove that Claude Code can stay bound to a persistent task session.

1. Run `claude-doc-preview` twice.
2. Run `cco_list_sessions`.
3. Show whether both runs reused the same task-session binding.
4. Explain why `sessionMode: single` matters for iterative document work.
```

What this proves:

- The orchestration layer can preserve a stable execution lane.
- Claude Code does not need to be rediscovered from scratch every time.
- This is a better fit for multi-step writing, revision, and repair flows.

## Demo 4: Claude vs Codex as Execution Plane

Use this when you want to explain the architecture rather than only the mechanics.

What to paste into Codex:

```text
Use the `codex-claude-orchestrator` MCP server to compare `claude-doc-preview` and `codex-doc-preview`.

1. Run both tasks in preview mode.
2. Inspect both run statuses.
3. Compare:
   - provider kind,
   - session behavior,
   - validation result,
   - preview artifact location.
4. Explain when the Claude execution plane is a better choice than the Codex execution plane.
```

What this proves:

- The control plane is portable across providers.
- Codex can remain the orchestrator even when Claude Code is the worker.
- The same policy shape can be reused across multiple executors.

## Demo 5: Deterministic Fallback Demo

Use this for recorded demos, CI checks, onboarding, or situations where Claude Code is not available.

What to paste into Codex:

```text
Use the `codex-claude-orchestrator` MCP server to demonstrate the preview-first pipeline without any external executor.

1. Run `mock-doc-preview`.
2. Inspect the run status.
3. Explain which parts of the pipeline are still real even though the provider is mocked.
4. Tell me what this demo proves about the orchestration layer itself.
```

What this proves:

- The orchestration contract is testable without Claude Code being present.
- Preview artifact creation, validation, run ledgers, and apply semantics are independent capabilities.
- You can onboard users before they configure a live execution provider.

## Recommended Demo Order

If you are presenting the project live, this is the cleanest sequence:

1. Show that `codex-claude-orchestrator` is visible in Codex or CC Switch.
2. Run Demo 1 to show Codex delegating to Claude Code.
3. Run Demo 2 to show the apply gate.
4. Run Demo 3 if you want to talk about long-running or iterative work.
5. Run Demo 4 if you want to explain the architecture difference between control plane and execution plane.

## Pitch Line

If you need one short sentence for a README, release page, or demo video:

```text
Codex Claude Orchestrator lets Codex govern Claude Code through an MCP contract, so planning, validation, preview/apply policy, and session management stay in the control plane instead of collapsing into one ad hoc prompt loop.
```
