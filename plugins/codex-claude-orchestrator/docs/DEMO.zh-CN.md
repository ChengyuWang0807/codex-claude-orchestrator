# Demo 指南

[English](./DEMO.md) | [简体中文](./DEMO.zh-CN.md)

这份文档专门用来展示一件事：

```text
Codex = 控制面
cco MCP = 编排契约层
Claude Code = 执行面
```

如果你想证明 Codex 不是“直接 prompt 一下 Claude Code”那么简单，而是通过 MCP 层来治理任务选择、preview/apply 策略、校验规则和会话复用，那么下面这几组 demo 最适合拿来展示。

## Demo 矩阵

| Demo | 证明什么 | 主要任务 | 主要 MCP 工具 |
| --- | --- | --- | --- |
| Demo 1 | Codex 可以把真实写作任务委派给 Claude Code，而且不会直接写正式文件 | `claude-doc-preview` | `cco_doctor`、`cco_list_tasks`、`cco_run_task`、`cco_get_run_status` |
| Demo 2 | Codex 可以在正式落盘前执行校验闸门 | `claude-doc-preview` | `cco_run_task`、`cco_get_run_status`、`cco_apply_preview_artifact` |
| Demo 3 | Claude Code 可以在多次运行之间复用持久会话绑定 | `claude-doc-preview` | `cco_run_task`、`cco_list_sessions` |
| Demo 4 | 同一套编排层既可以把 Claude Code 当执行面，也可以把 Codex 当执行面 | `claude-doc-preview`、`codex-doc-preview` | `cco_run_task`、`cco_get_run_status` |
| Demo 5 | 即使没有外部执行器，整套流程仍然可以用 deterministic mock 做演示和入门 | `mock-doc-preview` | `cco_run_task`、`cco_get_run_status` |

## Demo 1：只生成 Preview，由 Claude Code 执行

如果你想用最短路径证明“Codex 可以通过 `cco` 指挥 Claude Code”，就先跑这个。

可以直接贴给 Codex：

```text
请使用 `cco` MCP server 演示 Codex 如何控制 Claude Code。

1. 运行 `cco_doctor`。
2. 运行 `cco_list_tasks`。
3. 执行 `claude-doc-preview` 任务。
4. 检查最新一次运行状态。
5. 先不要 apply preview artifact。
6. 最后告诉我：
   - 哪些步骤是通过 `cco` 执行的，
   - 哪些部分仍然由 Codex 自己负责，
   - preview artifact 被写到了哪里，
   - validation checks 是否通过。
```

这个 demo 证明了：

- Codex 负责选择任务、检查状态、解释结果。
- Claude Code 负责实际的文档生成。
- 结果先进入 preview，而不是直接覆盖正式文件。

运行后重点看：

- Preview 产物目录：
  `examples/workspace/.cco/sandbox/claude-doc-preview/runs/<run-id>/`
- 尚未 apply 的正式目标路径：
  `examples/workspace/generated/control-plane-vs-execution-plane.md`

## Demo 2：校验通过后再 Apply

如果你想展示 Codex 不是“中转站”，而更像“上线治理器”，就跑这个。

可以直接贴给 Codex：

```text
请使用 `cco` MCP server 运行 `claude-doc-preview` 任务，检查 preview，并且只在 validation passed 的情况下才 apply。

工作流要求：
1. 通过 `cco` 运行该任务。
2. 检查最新一次运行状态。
3. 如果 validation passed，则 apply preview artifact。
4. 最后汇报：
   - 是否真的执行了 apply，
   - 最终生成文件的路径，
   - 这次作为闸门使用了哪些 validation checks。
```

这个 demo 证明了：

- Claude Code 不是最终落盘的决策者。
- Codex 可以执行 preview-first 治理流程。
- `cco` 暴露的是“先检查、再 apply”的结构化契约，而不是裸奔式调用。

如果 apply 成功，正式文件会落到：

```text
examples/workspace/generated/control-plane-vs-execution-plane.md
```

## Demo 3：持久 Claude 会话复用

如果你想展示这个系统不是一次性、无状态、fire-and-forget 的编排，就跑这个。

可以直接贴给 Codex：

```text
请使用 `cco` MCP server 证明 Claude Code 可以绑定到一个持久任务会话。

1. 连续运行两次 `claude-doc-preview`。
2. 运行 `cco_list_sessions`。
3. 说明这两次运行是否复用了同一个 task-session binding。
4. 解释为什么 `sessionMode: single` 对迭代式文档工作很重要。
```

这个 demo 证明了：

- 编排层可以维持稳定的执行通道。
- Claude Code 不需要每次都从零重新发现、重新热身。
- 这更适合多轮文档撰写、修改、补救与迭代。

## Demo 4：Claude 执行面 vs Codex 执行面

如果你想讲清楚架构价值，而不仅仅是跑通流程，就跑这个。

可以直接贴给 Codex：

```text
请使用 `cco` MCP server 对比 `claude-doc-preview` 和 `codex-doc-preview`。

1. 以 preview mode 运行这两个任务。
2. 检查它们各自的 run status。
3. 对比：
   - provider kind，
   - session behavior，
   - validation result，
   - preview artifact location。
4. 解释在什么情况下，Claude execution plane 比 Codex execution plane 更合适。
```

这个 demo 证明了：

- 控制面是可移植的，不绑死某一个执行器。
- 即使 Claude Code 真正在干活，Codex 仍然可以稳定担任编排者。
- 同一套策略壳可以复用到多个执行平面。

## Demo 5：Deterministic Fallback Demo

如果你要录屏、做 CI、做入门演示，或者当前没有可用的 Claude Code，就跑这个。

可以直接贴给 Codex：

```text
请使用 `cco` MCP server 演示一条不依赖外部执行器的 preview-first pipeline。

1. 运行 `mock-doc-preview`。
2. 检查 run status。
3. 解释虽然 provider 是 mocked，但这条 pipeline 里哪些部分仍然是真实能力。
4. 告诉我这个 demo 本身证明了编排层的哪些能力。
```

这个 demo 证明了：

- 就算没有 Claude Code，编排契约依然可以被验证。
- Preview 产物、校验、run ledger、apply 语义本身都是独立能力。
- 用户在接入真实执行器之前，也能先理解并测试整套工作流。

## 推荐演示顺序

如果你是现场展示项目，最顺的顺序是：

1. 先展示 `cco` 已经被 Codex 或 CC Switch 识别到。
2. 跑 Demo 1，展示 Codex 如何把任务委托给 Claude Code。
3. 跑 Demo 2，展示 apply 闸门。
4. 如果你要讲长期任务或多轮修订，再跑 Demo 3。
5. 如果你要讲架构层面的价值，再跑 Demo 4。

## 一句话讲项目

如果你要放在 README、发布页或者 demo 视频文案里，可以直接用这句：

```text
Codex Claude Orchestrator 让 Codex 通过 MCP 契约来治理 Claude Code，因此规划、校验、preview/apply 策略和会话管理都留在控制面，而不是塌缩成一次性的临时 prompt 循环。
```
