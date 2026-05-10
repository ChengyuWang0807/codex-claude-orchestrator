# codex-claude-orchestrator

[English](./README.md) | [简体中文](./README.zh-CN.md)

这是 **Codex Claude Orchestrator** 的独立发布仓库，采用 marketplace 风格目录组织，方便 Codex 用户直接安装插件层和 MCP 层，而不需要拉取一个与发布无关的大型工作区。

## 仓库结构

```text
.agents/plugins/marketplace.json
plugins/codex-claude-orchestrator/
```

实际实现和详细说明在这里：

- [plugins/codex-claude-orchestrator/README.md](./plugins/codex-claude-orchestrator/README.md)
- [plugins/codex-claude-orchestrator/README.zh-CN.md](./plugins/codex-claude-orchestrator/README.zh-CN.md)

## 快速安装

### 1. 把这个仓库加到 Codex marketplace

```powershell
codex plugin marketplace add ChengyuWang0807/codex-claude-orchestrator
```

### 2. 注册本地 MCP Server

在你 clone 或下载仓库之后，执行：

```powershell
codex mcp add cco -- node <repo-root>\plugins\codex-claude-orchestrator\bin\cco-mcp-server.mjs
```

### 3. 或者直接使用内置安装脚本

```powershell
cd <repo-root>\plugins\codex-claude-orchestrator
powershell -ExecutionPolicy Bypass -File .\scripts\install-codex-extension.ps1 -Force
```

## 异机安装指南

如果你是在另一台电脑上测试，请看这份文档：

- [plugins/codex-claude-orchestrator/docs/INSTALL.md](./plugins/codex-claude-orchestrator/docs/INSTALL.md)

## 迭代测试时如何先卸载旧版本

如果你是在反复测试不同版本，建议每次先卸载旧的 `cco`，再重新安装：

```powershell
cd <repo-root>\plugins\codex-claude-orchestrator
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-codex-extension.ps1 -Alias cco -KeepMarketplace
powershell -ExecutionPolicy Bypass -File .\scripts\install-codex-extension.ps1 -Force
```

如果你连 marketplace 注册也想一起清掉，做一次彻底重置，可以执行：

```powershell
cd <repo-root>\plugins\codex-claude-orchestrator
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-codex-extension.ps1 -Alias cco
```

## 直接对 Codex 说什么

如果你想让 Codex 从零开始接手整个部署流程，可以直接把下面这段话发给它：

```text
请通过 HTTPS 从 GitHub 拉取并部署 codex-claude-orchestrator，然后完成验证。

1. 克隆 `https://github.com/ChengyuWang0807/codex-claude-orchestrator.git`。
2. 进入 `.\codex-claude-orchestrator\plugins\codex-claude-orchestrator`。
3. 如果需要先登录 Codex，请提醒我执行 `codex login --with-api-key`。
4. 如果已经装过旧版本，请先运行 `powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-codex-extension.ps1 -Alias cco -KeepMarketplace`。
5. 运行 `powershell -ExecutionPolicy Bypass -File .\scripts\install-codex-extension.ps1 -Force`。
6. 运行 `codex mcp get cco --json`。
7. 运行 `node .\scripts\test-mcp-server.mjs`。
8. 运行 `node .\bin\cco.mjs run --config .\examples\tasks\mock-doc-preview.json --json`。
9. 最后告诉我拉取、卸载、安装、MCP 接线、mock preview 工作流是否都成功了；如果失败，请指出失败步骤和修复方法。
```

## 验证方式

在插件根目录执行：

```powershell
node .\bin\cco.mjs doctor
codex mcp get cco --json
node .\scripts\test-mcp-server.mjs
```

## 项目定位

- 让 Codex 充当上层控制面
- 让 Claude Code、Codex 或 mock 充当下层执行面
- 采用 preview-first 的任务编排，而不是默认直接覆盖正式文件

## 许可证

MIT。见 [LICENSE](./LICENSE)。
