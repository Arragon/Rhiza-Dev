# Rhiza LibreChat Migration Baseline

> **Superseded(2026-08-22)**:本文档描述的迁移策略与"clean-base 前不合并功能代码"等门槛已实质过时并废止;LibreChat 仅作为 Runtime Adapter 边界(见 V4.0 架构书 §7.6)。upstream commit 锁定等信息仅作历史参考。现行基线:`docs/Rhiza_技术架构设计书_V4.0_20260822.md`。

## 1. Purpose

本文依据《ContextGraph 技术设计书 v2.0》记录当前交互 MVP 向 LibreChat v0.8.7 clean-base 迁移时的边界。当前仓库不包含 LibreChat 源码或对应 Git 分支，因此本次完成的是可复用的产品层与视觉层迁移，不把缺失的 Runtime 和基础设施标记为已完成。

## 2. Locked upstream

- Upstream: LibreChat v0.8.7
- Commit: `9e74cc0e57b395926122bd4062c1fcedc48ed465`
- Usage: Runtime source only
- Update policy: selectively cherry-pick security, provider, streaming, MCP and agent fixes

不得从 upstream 继承 LibreChat 产品品牌、Conversation 最高层模型、Mongo 领域结构、Admin Panel、Sandpack/Nodebox 执行链或产品法律文本。

## 3. Reusable Rhiza product layer

| Current module | Target ownership | Migration rule |
|---|---|---|
| `src/components/ChatView.tsx` | `apps/web` | 保留节点级讨论、Anchor 临时探索和显式保留语义 |
| `src/components/GraphView.tsx` | `packages/graph` + `apps/web` | 保留 Node 级默认视图，不退化为 Message 图 |
| `src/components/ContextPanel.tsx` | `packages/context` + `apps/web` | 严格区分 Recommended、Active、Excluded |
| `src/components/StateView.tsx` | `packages/state` + `apps/web` | Project State 与 Conversation Graph 分离 |
| `server/domain.ts` | `packages/domain` | 迁移为独立 Rhiza DTO，不引用 LibreChat schema |
| `server/provider-service.ts` | Runtime adapter | 保留当前 API 配置，并通过 LibreChat 共享 schema/策略逐步替换重复实现 |
| `app/static/css/*` | `apps/web` design tokens | 作为 Rhiza 视觉源，不继承 LibreChat 品牌样式 |

## 4. Runtime contract

目标 Runtime 必须通过 Rhiza 自有接口接入：

```ts
interface AIRuntime {
  listModels(): Promise<ModelInfo[]>;
  generate(request: RuntimeRequest): AsyncIterable<RuntimeEvent>;
  invokeTool(request: ToolRequest): Promise<ToolResult>;
  runAgent(request: AgentRequest): AsyncIterable<RuntimeEvent>;
}
```

`RuntimeRequest` 只能引用已冻结的 Context Manifest。LibreChat 内部 Conversation、Mongo document 或任意历史 messages 不得成为 Rhiza Domain 的 Source of Truth。

## 5. Required clean-base gates

只有以下项目均完成，才可称为“基于 LibreChat 的 Rhiza clean-base”：

1. 从指定 commit 建立可重现分支并保留 MIT notice。
2. 删除 Sandpack/Nodebox、LibreChat Admin Panel 与产品品牌/法律模板。
3. 建立 `AIRuntime` adapter，完成模型目录、流式事件、Tool/MCP 能力映射。
4. Rhiza Domain 使用 PostgreSQL 作为 Source of Truth；Mongo 仅允许出现在 adapter/migration 边界。
5. 每次生成绑定不可变 Context Manifest，Assistant Response 保存 `manifest_id`。
6. Unit、Integration、E2E 与 Manifest replay 测试通过。
7. 生成第三方 notices、许可证报告和 CycloneDX/SPDX SBOM。

## 6. Current gap

当前 MVP 已实现节点级讨论、Anchor 支线、图谱、Context 生命周期、Manifest 记录、Provider Registry 与视觉产品层。

已完成的迁移基础：

- 获取并审计指定 commit 的隔离源码快照；
- 建立 `AIRuntime`、`RuntimeRequest` 与 `RuntimeEvent`；
- 通过 `ProviderRuntime` 验证 Runtime 可替换边界；
- 已 fetch 官方 `v0.8.7` tag，并建立固定基线分支 `librechat-v0.8.7` 与集成分支 `codex/rhiza-librechat-runtime`；
- 精确安装 `librechat-data-provider@0.8.509`，复用 Model Spec schema、endpoint 枚举和文件能力策略；
- Agent 请求采用 LibreChat 非 LangChain 路径的角色化消息顺序，同时保留 Rhiza Context Prompt；
- 将 OpenAI-compatible Provider SSE 归一化为 Rhiza Runtime Event，并通过 `/api/chat/stream` 传递给浏览器；
- 浏览器支持增量 Assistant Message，服务端只在 `RUN_END` 后提交领域数据；
- 覆盖流式成功提交和 `RUN_ERROR` 零持久化回归测试；
- 模型调用前冻结 Project、Node、Request、Model Profile 与 Context 来源；
- 对话历史继续严格按活动 Node 隔离；
- 保留 LibreChat MIT notice 和第三方说明。

尚未实现 PostgreSQL、统一 Auth、实际文件上传/Ingestion、MCP Gateway、License Gate 和 SBOM。完整 `@librechat/agents` 当前要求 Node.js 24，需在运行环境升级后再进行集成。迁移剩余能力时应继续使用现有 Provider/API Key，并保持产品 API 语义，避免用 upstream 数据模型反向塑造 Rhiza Domain。
