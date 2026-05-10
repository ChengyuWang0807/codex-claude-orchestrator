# 安装指南

[English](./INSTALL.md) | [简体中文](./INSTALL.zh-CN.md)

## 适用范围

这份文档提供一条以 Windows 为优先的安装与验证路径，适合在新机器上快速完成 `codex-claude-orchestrator` 的部署。

如果只是想先确认项目是否可用，建议优先使用 **mock** 路径，因为它不依赖 Claude Code。

## 前置条件

请先准备：

- Node.js 20 或更高版本
- Codex CLI

可选：

- Claude Code CLI
  仅在需要测试 `claude` provider 时才需要

## 方案 A：从打包后的 release 安装

这是最接近外部用户实际使用方式的安装路径。

### 1. 将 release zip 放到目标机器

使用：

```text
plugins/codex-claude-orchestrator/dist/codex-claude-orchestrator-v0.2.0.zip
```

解压到任意目录，例如：

```text
D:\tools\codex-claude-orchestrator-v0.2.0\
```

解压后目录应如下所示：

```text
<release-root>\
  .agents\plugins\marketplace.json
  plugins\codex-claude-orchestrator\
```

### 2. 登录 Codex

如果目标机器使用 API key 模式：

```powershell
codex login --with-api-key
```

### 3. 注册 marketplace 根目录

```powershell
codex plugin marketplace add <release-root>
```

示例：

```powershell
codex plugin marketplace add D:\tools\codex-claude-orchestrator-v0.2.0
```

### 4. 注册 MCP server

最明确的写法是：

```powershell
codex mcp add codex-claude-orchestrator -- node <plugin-root>\bin\cco-mcp-server.mjs
```

示例：

```powershell
codex mcp add codex-claude-orchestrator -- node D:\tools\codex-claude-orchestrator-v0.2.0\plugins\codex-claude-orchestrator\bin\cco-mcp-server.mjs
```

也可以直接使用内置安装脚本：

```powershell
cd <plugin-root>
powershell -ExecutionPolicy Bypass -File .\scripts\install-codex-extension.ps1 -SkipMarketplace
```

这里使用 `-SkipMarketplace`，是因为第 3 步已经完成了 marketplace 注册。

## 方案 B：从仓库源码直接安装

如果目标机器直接克隆了仓库源码：

```powershell
cd <repo-root>\plugins\codex-claude-orchestrator
powershell -ExecutionPolicy Bypass -File .\scripts\install-codex-extension.ps1
```

这条路径适合开发机，因为它可以一步同时注册 marketplace 和 MCP entry。

## 验证清单

在插件根目录执行：

```powershell
node .\bin\cco.mjs doctor
codex mcp get codex-claude-orchestrator --json
node .\scripts\test-mcp-server.mjs
```

成功标志包括：

- `doctor` 输出中 `node` 和 `codex` 为可用状态
- `codex mcp get codex-claude-orchestrator --json` 能打印 stdio server 配置
- `test-mcp-server.mjs` 以 `MCP server smoke test passed.` 结束

## 首次推荐任务

建议先从 mock provider 开始，因为依赖最少：

```powershell
node .\bin\cco.mjs run --config .\examples\tasks\mock-doc-preview.json --json
node .\bin\cco.mjs status --config .\examples\tasks\mock-doc-preview.json --json
node .\bin\cco.mjs apply --config .\examples\tasks\mock-doc-preview.json --json
```

这组命令可以验证：

- preview artifact 生成
- run status 检查
- apply 到正式目标路径的流程

## 如果还要测试 Claude Code

先安装并登录 Claude Code，然后执行：

```powershell
node .\bin\cco.mjs run --config .\examples\tasks\claude-doc-preview.json --json
```

## 如果还要测试 Codex 作为执行面

执行：

```powershell
node .\bin\cco.mjs run --config .\examples\tasks\codex-smoke.json --json
```

这是最干净的 API-only 验证路径。

## 清理方式

只移除本地 MCP 注册：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-codex-extension.ps1 -Alias codex-claude-orchestrator -KeepMarketplace
```

同时移除 MCP entry 和 marketplace 注册：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-codex-extension.ps1 -Alias codex-claude-orchestrator
```

## 多版本反复测试时的推荐重置流程

如果需要频繁迭代多个版本，建议使用这组命令：

```powershell
cd <repo-root>\plugins\codex-claude-orchestrator
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-codex-extension.ps1 -Alias codex-claude-orchestrator -KeepMarketplace
powershell -ExecutionPolicy Bypass -File .\scripts\install-codex-extension.ps1 -Force
node .\scripts\test-mcp-server.mjs
```

这样可以获得一套干净的 `codex-claude-orchestrator` 重装流程，而不需要每次都重新添加 marketplace。
