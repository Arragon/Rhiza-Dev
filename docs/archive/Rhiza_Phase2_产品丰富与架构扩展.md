# Rhiza 三步走规划 · 阶段二

> 文档名称：产品功能丰富与架构扩展
> 
> 启动条件：阶段一 MVP 已证明 Chat + Graph + Explicit Context 在真实用户场景中具有持续价值
> 
> 阶段定位：从“可验证核心价值的 MVP”升级为“可以长期承载复杂项目的完整产品”
> 
> 核心原则：**深化产品价值，模块化官方能力；仍不急于开放第三方平台。**

---

# 0. 阶段二目标

阶段二不再回答“Rhiza 有没有价值”，而回答：

> **Rhiza 能否从复杂对话工具成长为稳定、长期、跨资源的 AI Project Workspace？**

主要方向：

```text
更强 Context
更强 Graph
更强 Project State
更强检索与知识资源
更完整文件/网页/仓库工作流
更好的长项目性能
更丰富的官方能力
更清晰的内部模块边界
更成熟的可靠性/可观测性
```

阶段二开始“为平台做准备”，但重点是：

```text
Internal Modularity
≠
Public Plugin Platform
```

---

# 1. 阶段二架构策略

阶段一采用：

```text
Minimal Core
+
Strong Boundaries
```

阶段二扩展为：

```text
Stable Core
+
Internal Registries
+
Provider Interfaces
+
First-party Modules
```

只对已经出现多个真实实现的能力进行抽象。

例如：

```text
ContextResourceProvider
GraphLayout
ResourceParser
ArtifactRenderer
ToolProvider
SearchProvider
```

这些接口优先用于官方模块自身解耦，并通过 dogfooding 判断未来是否值得公开。

---

# 2. Universal Context Resource v1

阶段二正式把阶段一的 ContextResourceRef 扩展为可长期使用的资源层。

支持资源建议：

```text
Node
Segment
Project State
File
PDF
Web Page
Folder
Knowledge Collection
Git Repository
External URL Resource
Artifact
```

第三方 SaaS Connector 可以做少量官方集成，但仍不开放任意插件运行时。

统一链路：

```text
ContextResourceRef
↓
ContextResourceProvider
↓
Resolve / Slice
↓
ContextSlice
↓
Projection
↓
ContextCandidate
↓
Planner
```

原则继续保持：

> **Reference-first, Content-on-demand.**

资源注册表存元数据、索引和摘要，不把完整内容长期常驻内存。

---

# 3. Context Planner v2

阶段二才开始让 Planner 变得真正智能。

## 3.1 Candidate 来源

```text
Current Node
Graph neighbors
Pinned resources
Project State
Files
Knowledge Collections
Web resources
Repositories
Explicit user selections
```

## 3.2 Ranking

从阶段一简单 hybrid score 发展为可配置 pipeline：

```text
Lexical Retrieval
+
Embedding Retrieval
+
Graph Proximity
+
Recency / Freshness
+
State Relevance
+
Optional Reranker
```

要求每个阶段都能关闭/替换和 benchmark。

## 3.3 Compression

增加：

```text
Chunk selection
Cached summary
Hierarchical summary
Query-aware compression
```

禁止默认对所有资源运行昂贵 LLM Compression。

## 3.4 Conflict / Stale Suggestion

阶段二可加入“建议式”一致性检测：

```text
Potential Conflict
Potentially Stale
Superseded Candidate
```

默认产生 proposal，而不是自动改写 Project State。

---

# 4. Project State v1

阶段二正式实现 Authoritative Project State。

类型：

```text
FACT
CONSTRAINT
DECISION
HYPOTHESIS
OPEN_QUESTION
TASK
REFERENCE
ARTIFACT
```

每条 State 必须拥有：

```text
status
source/provenance
created_at
updated_at
version
confidence/verification metadata（可选）
dependencies
supersedes
```

状态变化：

```text
Candidate
↓
User / Policy Review
↓
Active State
↓
Superseded / Invalidated / Resolved
```

Project State 不是聊天摘要，也不是“模型记忆”。

---

# 5. Selective Merge

阶段二实现真正可用的分支收敛。

典型流程：

```text
Branch A
Branch B
Branch C
↓
Select source Node / Segment
↓
Synthesis Preview
↓
User Review
↓
Create SYNTHESIS Node
↓
MERGED_INTO / REFERENCES edges
↓
Optional State Candidates
```

要求保留来源，不把多个分支直接压扁成不可追踪摘要。

---

# 6. Graph v2

Graph 从“分支导航器”扩展为“项目结构浏览器”。

新增：

```text
Edge types 完整化
Node types 完整化
Filter
Search
Cluster
Semantic Zoom
Subgraph focus
Timeline / recent mode
Layout switch
Saved graph views
Large project lazy rendering
```

建议增加：

```text
DISCUSSION
QUESTION
HYPOTHESIS
DECISION
SYNTHESIS
REFERENCE
TASK
AGENT
```

Graph 不应强制所有项目使用一种视觉布局。

因此阶段二引入内部 `GraphLayoutRegistry`，但不公开第三方 API。

---

# 7. Search 与知识导航

阶段二提供统一搜索：

```text
Messages / Events
Nodes
State
Files
Artifacts
Context Resources
```

搜索模式：

```text
Exact / FTS
Semantic
Filter by Project / Type / Time / Source
```

搜索结果必须可以：

```text
Open
Add to Context
Open in Graph
Create Branch
Pin
```

搜索不是独立页面，而是进入 Context/Graph 工作流的入口。

---

# 8. File / Knowledge 工作流

阶段二扩展文件能力：

```text
PDF / Markdown / TXT / Office extraction
Document structure preservation
Chunk provenance
Version tracking
File replace / re-index
Folder / Collection
Resource preview
Citation back-link
```

重点是“引用可追溯”，不是单纯 RAG。

任何 Chunk 都应能够回到：

```text
File
Page / Section
Range
Version
```

---

# 9. Artifact 与 Tool 能力

阶段二可丰富普通 AI 产品能力：

```text
Artifact Editor
Code / Markdown / Structured Artifact
Tool Calls
MCP Gateway
Agent Node basic
Execution Gateway（独立沙箱，可选）
```

仍保持：

```text
编辑
≠
执行
```

不重新引入 Sandpack/Nodebox 成为 Product Core 依赖。

---

# 10. 多模型与 Model Profile

阶段二将模型控制从“下拉框”升级为 Profile：

```text
Model
Provider
Reasoning
Temperature
Tools
System Prompt
Context Budget Policy
```

但 Model Profile 与 Project State / Context 继续解耦。

后续可增加：

```text
Task-aware model suggestion
Cost / latency display
Fallback model
```

不要在阶段二构建复杂自动模型路由平台，除非用户数据证明必要。

---

# 11. 产品架构模块化

阶段二建立：

```text
@rhiza/internal-contracts
```

而不是立即发布：

```text
@rhiza/extension-api@1.0
```

内部接口建议包括：

```text
ContextResourceProvider
GraphLayout
ResourceParser
SearchProvider
ArtifactRenderer
ToolProvider
RuntimeAdapter
ObjectStorageProvider
```

规则：

```text
Core 只依赖 Contract
官方模块依赖 Contract
官方模块不得绕过 Domain invariant
```

这一步的目的是通过官方模块 dogfooding 找出真正稳定的 Extension Seam。

---

# 12. UI v2

阶段二 UI 目标是从“可用工具”走向“成熟工作台”。

重点升级：

```text
可配置工作区布局
Resizable panes
Saved views
Command palette
Global search
Keyboard-first workflow
Context drag & drop
Graph / Chat split view
State panel
Resource browser
Artifact panel
```

但不能让 UI 变成 IDE 式复杂度堆叠。

默认模式必须保持简洁：

```text
Navigator | Discussion | Context
```

高级用户再展开 Graph / State / Resource / Artifact。

---

# 13. 同步与多端

阶段二优先完成：

```text
Web
Desktop shell
```

Desktop 可增加：

```text
Local file access
Offline cache
Local index
Local model adapter
System integration
```

Mobile 暂时只做技术验证或轻量 companion，不要求完整复制桌面体验。

客户端共享：

```text
Domain DTO
API Schema
Manifest Schema
Graph Model
Context Model
```

平台特有能力不能进入 Domain Core。

---

# 14. Observability 与性能

阶段二正式建立产品级可观测性：

```text
API latency
Planner latency
DB query latency
Graph render timing
Embedding/index jobs
Runtime failures
Token usage
File ingestion failures
Client crash/error
```

先监控 Rhiza 自身，不做插件级 Cost Attribution。

关键性能测试覆盖：

```text
10 / 100 / 1000 Node Project
大型 Markdown / PDF
多文件 Project
长时间连续使用
Graph lazy rendering
Context Planner large candidate set
```

---

# 15. Milestone 路线图

```text
M2.0  Phase-1 Hardening & Telemetry
  ↓
M2.1  Universal Context Resource v1
  ↓
M2.2  Context Planner v2
  ↓
M2.3  Project State + Selective Merge
  ↓
M2.4  Graph v2 + Global Search
  ↓
M2.5  Knowledge / Artifact / Tool Workflows
  ↓
M2.6  Internal Modular Architecture
  ↓
M2.7  Desktop / Sync / Reliability
  ↓
M2.8  Product Expansion Validation Gate
```

部分 Milestone 可并行，但 M2.6 的 Contract 应从前面真实实现中抽取，而不是提前想象。

---

# 16. M2.0 — Phase-1 Hardening & Telemetry

## 目标

在增加功能前，先解决阶段一真实使用暴露的问题。

## 验收标准

- [ ] 阶段一 P0/P1 Bug 清零或有明确接受记录；
- [ ] 建立 Planner / Graph / API 基础性能指标；
- [ ] 建立真实使用 Funnel：Project → Branch → Graph → Context → Return；
- [ ] 已收集至少 20 个真实复杂 Project 用作 regression dataset；
- [ ] 核心数据备份/恢复流程经过演练；
- [ ] 核心 E2E tests 覆盖阶段一主流程。

---

# 17. M2.1 — Universal Context Resource v1

## 目标

让更多长期知识资源进入统一 Context 模型。

## 验收标准

- [ ] Node / Segment / State / File / Web / Collection 使用同一 ResourceRef；
- [ ] Resource Provider 可独立测试；
- [ ] 资源内容按需读取，不全量常驻；
- [ ] 每个 ContextSlice 保留 provenance；
- [ ] 文件版本更新后旧 Manifest 仍能辨识原版本；
- [ ] 大资源有明确 projection 策略；
- [ ] 10MB 级 PDF/文本、1000 文件级 Repo 测试有基准结果；
- [ ] Provider 失败时不导致整个 Turn 失败。

---

# 18. M2.2 — Context Planner v2

## 目标

提高自动 Context 质量，同时保持可解释、可降级。

## 验收标准

- [ ] Hybrid retrieval 有离线 benchmark；
- [ ] Ranking 各项权重可观测；
- [ ] 可选 reranker 不成为强制依赖；
- [ ] Compression 至少支持 chunk selection + cached summary；
- [ ] Context 候选可显示来源与选择理由；
- [ ] 1000 Node Project 的 Candidate Retrieval 有性能基准；
- [ ] Planner P95 满足内部交互目标；
- [ ] 失败时回退到显式 Context；
- [ ] 与阶段一相比，在真实 benchmark 上检索相关性显著提升。

---

# 19. M2.3 — Project State + Selective Merge

## 目标

让 Rhiza 能承载长期项目，而不仅是多分支聊天。

## 验收标准

- [ ] State 类型与生命周期完整；
- [ ] 每条 Active State 均有 provenance；
- [ ] State 可 supersede / invalidate / resolve；
- [ ] AI 可以提出 State Candidate，但不能无审查篡改权威 State；
- [ ] 多分支可选择性 Merge 成 Synthesis Node；
- [ ] Synthesis 保留所有来源引用；
- [ ] Merge 可以提出 State 更新建议；
- [ ] 真实用户能够用 State 维护至少一个持续两周以上的 Project。

---

# 20. M2.4 — Graph v2 + Global Search

## 目标

让 Graph 在大项目中仍然是导航工具，而不是负担。

## 验收标准

- [ ] Filter / Search / Focus / Cluster 可用；
- [ ] 1000 Node 项目可以通过 subgraph/lazy render 工作；
- [ ] Global Search 能检索 Node / Event / State / File；
- [ ] 搜索结果可直接 Add to Context / Open in Graph；
- [ ] GraphLayout 通过内部 Contract 接入；
- [ ] 至少两个官方 Layout 使用同一 Contract；
- [ ] Graph View 不依赖 Discussion UI state 才能工作；
- [ ] 用户能在 30 秒内定位一个大型项目中的目标 Node。

---

# 21. M2.5 — Knowledge / Artifact / Tool Workflows

## 目标

覆盖真实工作中的资料、产物和工具使用。

## 验收标准

- [ ] 文件 ingestion 支持至少 3 类高频文档格式；
- [ ] Citation 可回到原始页/段；
- [ ] Artifact 可创建、编辑、版本化；
- [ ] Tool Call 与 Node/Event 关联；
- [ ] MCP/Tool 经过统一 Gateway；
- [ ] Agent Run 进入 Graph/Run history，不形成不可追踪后台行为；
- [ ] Artifact execution 与 editor 分离；
- [ ] 用户可完成至少一条“资料 → 对话 → Artifact → 回写 Project”的完整工作流。

---

# 22. M2.6 — Internal Modular Architecture

## 目标

把已证明存在多个实现的模块抽出稳定内部 Contract。

## 验收标准

- [ ] `@rhiza/internal-contracts` 建立；
- [ ] 至少 3 类官方能力通过 Registry/Provider 接入；
- [ ] 新增一个 Graph Layout 不需要修改 Graph Core；
- [ ] 新增一个 Context Resource Provider 不需要修改 Planner Core；
- [ ] 官方模块不能直接写 Domain DB；
- [ ] 官方模块通过 Command/API 层遵守 Domain invariant；
- [ ] Contract 有独立测试；
- [ ] 尚未向第三方承诺稳定 SemVer；
- [ ] 未实现 Sandbox / Marketplace / Dependency Resolver。

这个 Milestone 是阶段三 Extension Platform 的资格考试。

---

# 23. M2.7 — Desktop / Sync / Reliability

## 目标

让 Rhiza 从 Web 产品成长为长期使用的工作环境。

## 验收标准

- [ ] Desktop 复用同一 Domain/API 语义；
- [ ] 本地文件能力通过平台 Adapter，不污染 Core；
- [ ] Web/Desktop 项目状态同步可靠；
- [ ] 离线/弱网有明确降级；
- [ ] 冲突不会导致静默数据覆盖；
- [ ] 客户端异常退出后可恢复当前工作；
- [ ] 备份/恢复经过真实灾难演练；
- [ ] 关键路径有 trace/log/metrics。

---

# 24. M2.8 — Product Expansion Validation Gate

阶段二结束必须证明 Rhiza 已经是“完整产品”，而不是功能越来越多。

## 验收条件

- [ ] 有稳定重复使用用户群；
- [ ] 用户平均 Project 生命周期显著长于阶段一；
- [ ] Graph 在大型项目中仍有持续使用，而非新鲜感消失；
- [ ] Project State 有真实重复使用；
- [ ] 用户能够跨 Node / File / Web / State 组织 Context；
- [ ] 至少两个官方模块证明 internal registry 设计有效；
- [ ] 产品可靠性允许开发者在不频繁救火的情况下继续扩展；
- [ ] 团队已经因为“第三方/官方扩展需求”真实感受到公开 Extension API 的必要性，或者明确决定继续不开放。

---

# 25. 阶段二进入阶段三的启动条件

满足越多越好，至少需要其中多数：

```text
1. 核心产品 PMF 信号明确；
2. 官方团队已经有多个可插拔模块；
3. Internal Contracts 经过多次重构趋于稳定；
4. 用户明确提出外部集成/定制需求；
5. 有开发者愿意为 Rhiza 开发扩展；
6. 团队拥有基本 Observability 和安全能力；
7. Core 开发不再是唯一资源瓶颈；
8. 开放平台的收益已大于维护成本。
```

如果这些条件不足，不进入完整插件平台建设。

---

# 26. 阶段二最终交付定义

阶段二成功后的 Rhiza：

> **不仅能管理复杂对话，还能把分散的长期资料、项目状态、分支结论和产物统一组织为可追溯、可调用、可持续演化的 AI Project Workspace。**

同时，其内部架构已经具备可靠扩展缝隙，但仍优先服务产品本身。

**END — PHASE 2**
