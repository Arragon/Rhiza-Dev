# Rhiza 三步走规划 · 阶段三

> **Superseded(2026-08-22)**:本文档为历史规划,其中的里程碑编号为 Legacy 语义,不定义当前工作。现行基线:`docs/Rhiza_开发路线图_V4.0_20260822.md`。

> 文档名称：长期发展规划与远景目标
> 
> 启动条件：核心产品已验证，内部模块化已稳定，真实生态需求已经出现
> 
> 阶段定位：从成熟 AI Workspace 演进为可扩展 Context-Native Platform
> 
> 核心原则：**平台能力必须从成熟产品中抽取，而不是提前凭想象定义。**

---

# 0. 长期愿景

阶段三的目标不是“做一个插件商店”。

Rhiza 的长期方向应当是：

> **成为一种以 Context、Graph、State、Provenance 为核心的通用 AI 工作环境，使不同领域、不同数据源、不同模型与不同工具可以围绕同一个可追溯项目知识结构协同工作。**

最终形态：

```text
AI Chat
↓
Context-Native Workspace
↓
Extensible Knowledge / Work Platform
↓
Personal / Team Context Operating Layer
```

但每一层都必须建立在上一层已经被用户证明有价值的基础上。

---

# 1. 阶段三总体架构

阶段三才正式从：

```text
Rhiza Core
+
Internal Contracts
+
Official Modules
```

演进为：

```text
Rhiza Kernel
│
├── Domain Command / Query API
├── Context Resource API
├── Graph API
├── UI Extension Points
├── Runtime Broker
├── Permission / Capability System
├── Extension Host
└── Compatibility System

        ↓

Official Extensions
Third-party Extensions
Enterprise / Native Extensions
```

平台不能允许插件绕过 Domain invariant。

原则保持：

> **Plugins own capabilities, not the Core.**

---

# 2. Rhiza Kernel

长期 Kernel 应保持尽可能小。

建议核心仅包括：

```text
Identity / Workspace
Permission / Capability
Project / Node / Event identity
Domain Command Bus
Query API
Domain Event System
Context Manifest integrity
Project State integrity
Plugin Host
Plugin Registry
Extension Storage abstraction
Sync / Version infrastructure
```

大量“产品功能”应逐步可以被 First-party Extension 实现，但不要求为了插件化而把核心功能全部移出 Core。

---

# 3. Public Extension API

只有经过阶段二 dogfooding 的内部接口才允许公开。

发布路线：

```text
internal-contracts
↓
extension-api alpha
↓
official dogfooding
↓
closed developer preview
↓
beta
↓
stable 1.0
```

不要直接承诺一开始就长期稳定。

分阶段开放能力：

```text
Wave 1
Command / Theme / Panel / View

Wave 2
Graph Layout / Context Provider / Search Provider

Wave 3
Knowledge Extension / Tool / Connector

Wave 4
Agent / Runtime / Native Extension
```

高风险能力越晚开放。

---

# 4. Extension Manifest

长期插件应使用显式 Manifest 描述：

```text
id
version
rhiza api version
target platforms
permissions
activation events
capabilities
dependencies
optional dependencies
conflicts
extension points
```

任何兼容性问题尽可能在激活前发现。

核心原则：

> **Compatibility before activation, not after failure.**

---

# 5. 依赖与兼容性

长期兼容策略不要复制游戏 Mod 的“手调 Load Order”。

流程：

```text
Installed Extensions
↓
Manifest Validation
↓
API Version Validation
↓
Dependency Resolution
↓
Capability Resolution
↓
Conflict Detection
↓
Permission Check
↓
Platform Check
↓
Extension Plan
↓
Activation
```

原则：

```text
No correctness by load order.
```

如果存在依赖，必须显式声明。

如果存在处理顺序，使用语义 Pipeline Stage。

如果能力只能唯一提供，使用 Exclusive Capability + 明确用户选择。

不要使用 `last loaded wins`。

---

# 6. Dependency Resolver 的克制设计

长期也不建议一开始自研完整 SAT Solver。

早期 Extension Platform 限制：

```text
SemVer 简单范围
禁止循环依赖
禁止 peer dependency
依赖深度限制
显式冲突
一个 workspace lockfile
```

普通 npm/JS 库依赖应跟随插件自身 bundle 或 sandbox 隔离，不进入 Rhiza 全局依赖解析。

全局 resolver 只处理：

```text
Rhiza Extension API
Plugin-to-plugin dependency
Shared Capability Contract
```

---

# 7. Extension Lifecycle

长期采用：

```text
DISCOVER
↓
VALIDATE
↓
RESOLVE
↓
REGISTER
↓
ACTIVATE
↓
RUN
↓
DEACTIVATE
```

区分：

```text
Installed ≠ Loaded ≠ Activated ≠ Running
```

100 个已安装插件不能意味着 100 个 Runtime 常驻。

---

# 8. Trust Level 与 Sandbox

建议四级：

```text
Tier 0 — Declarative
Theme / Layout / Template

Tier 1 — Sandboxed
Worker / iframe
普通第三方插件

Tier 2 — Trusted Extension
用户明确授权的高级本地能力

Tier 3 — Native / Enterprise
filesystem / native API / local model
```

默认第三方插件从 Tier 0/1 开始。

Native 权限绝不默认开启。

---

# 9. Permission / Capability System

长期权限至少可覆盖：

```text
project.read / write
messages.read / write
context.read / propose
state.read / propose / write
files.read / write
graph.read / write
knowledge.read
network.access
runtime.invoke
tools.register
ui.extend
theme.override
clipboard
local-files
secrets.use
```

用户安装时展示“能力语言”，而不是内部 API 语言。

例如：

```text
此扩展可以读取当前 Project 和 Graph，
可以向 Context 提议内容，
但不能访问本地文件、网络或 API Key。
```

---

# 10. Runtime Broker / Credential Broker

插件永远不能直接读取模型 API Key / OAuth token。

正确模式：

```text
Plugin
↓
Runtime Broker
↓
Provider
```

和：

```text
Plugin
↓
Credential Broker
↓
External Service
```

这样 Rhiza 可以统一处理：

```text
permission
rate limit
budget
audit
revoke
cost attribution
```

---

# 11. UI Extension Platform

长期 UI 分两条轨道。

## 标准扩展

```text
Theme tokens
Layout definitions
Panels
Views
Commands
Toolbar actions
Node renderers
Artifact renderers
Graph layouts
```

## 完全自定义 View

使用：

```text
iframe / Web Component / Sandboxed View
```

允许插件内部使用 React/Vue/Svelte，而不依赖 Rhiza 内部 React 版本。

只有高信任扩展才允许 in-process UI。

---

# 12. Context / Knowledge Extension

这是 Rhiza 长期最有战略价值的扩展面。

第三方可提供：

```text
ContextResourceProvider
ContextRetriever
ContextRankFeature
ContextCompressor
KnowledgeExtractor
KnowledgeTransformer
KnowledgeValidator
KnowledgeView
```

应用场景：

```text
科研
法律
软件工程
医学文献
教育
产品管理
企业知识
```

不同领域可以拥有自己的知识语义，但不能 ALTER Core schema。

采用 namespaced extension entities / properties。

---

# 13. Agent / Automation

长期 Agent 不应成为独立于 Rhiza 项目的黑箱。

Agent 必须：

```text
consume Context Manifest
produce Events / Artifacts
record Tool Calls
record Runtime Run
produce optional State Candidates
participate in Graph
```

长期可发展：

```text
Scheduled Agent
Multi-agent workflow
Background research
Watchers
Task execution
Human approval gates
```

但任何后台行为都必须有明确权限、预算和可追踪状态。

---

# 14. Marketplace

Marketplace 只能在 Extension API 和 Sandbox 都稳定后启动。

至少具备：

```text
Package signing
Integrity hash
Publisher identity
Permission declaration
License metadata
Automated scanning
Compatibility metadata
Version history
User reporting
Emergency disable/revoke
```

Marketplace 不是阶段三起点，而是后半程结果。

---

# 15. Compatibility Diagnostics / Safe Mode

长期必须避免传统 Mod 生态中的“启动崩溃后自己排查”。

提供：

```text
Compatibility Report
Extension Resolution Plan
Last Activation Trace
Per-plugin errors
Safe Mode
Disable all third-party extensions
Binary isolation assistance
```

更新 Rhiza 前：

```text
simulate compatibility
↓
report incompatible extensions
↓
update / disable / hold decision
```

---

# 16. Extension Lockfile

每个 Workspace 可以生成：

```text
rhiza.extensions.lock
```

记录：

```text
exact plugin version
extension api version
capability provider selections
resolution hash
```

用于：

```text
reproducibility
team sharing
backup
migration
replay
```

---

# 17. 性能与资源治理

长期插件性能红线：

```text
安装不等于常驻 Runtime
默认 idle CPU ≈ 0
Heavy plugin lazy activate
Shared worker / sandbox pool
高频 UI/stream event 不广播
Context Provider 不全量调用
Resource content 按需读取
所有任务可 timeout / cancel / dispose
```

Extension Host 记录：

```text
activation time
execution time
CPU
memory
network
storage
errors
timeouts
model tokens / cost
```

超预算扩展可以自动 suspend。

---

# 18. 多端长期路线

```text
Web
Desktop
Mobile
```

共享：

```text
Domain Model
Context Model
Manifest
Graph
Extension Contracts（可用子集）
```

不同平台能力不同：

```text
Web
→ sandboxed web extension

Desktop
→ web + local/native trusted extension

Mobile
→ declarative / limited sandbox extension
```

不要为了统一插件能力，把所有平台限制在最小公分母。

---

# 19. 团队 / Enterprise 方向

当个人产品成熟后，可扩展团队能力：

```text
Shared Workspace
Role / Permission
Project sharing
Collaborative State
Review / Approval
Audit
Team Context Resources
Enterprise connectors
SSO / SCIM（需要时）
Policy / Data boundary
Self-hosting
```

这些能力同样应从真实商业需求驱动，而不是预先全部加入 Core。

---

# 20. 更远期：Rhiza Context Operating Layer

长期最值得探索的不是插件数量，而是 Context 统一层。

理想形态：

```text
Documents
Web
Mail
Calendar
Code
Databases
Knowledge Bases
Conversations
Artifacts
Agents
External Services
       ↓
Context Resource Layer
       ↓
Graph + State + Provenance
       ↓
Planner
       ↓
Any Model / Agent / Tool
```

Rhiza 不再只是“Chat UI”，而成为：

> **用户/团队知识与 AI Runtime 之间的可控制 Context 层。**

这个方向必须保持长期研究性质，不直接作为短期工程承诺。

---

# 21. Milestone 路线图

```text
M3.0  Platform Readiness Gate
  ↓
M3.1  Extension API Alpha
  ↓
M3.2  Permission + Sandbox Foundation
  ↓
M3.3  Compatibility & Lifecycle Platform
  ↓
M3.4  First-party Extension Dogfooding
  ↓
M3.5  Developer Preview / SDK Beta
  ↓
M3.6  Marketplace Preview
  ↓
M3.7  Cross-platform / Native / Enterprise Expansion
  ↓
M3.8  Ecosystem Scale & Context Operating Layer Research
```

---

# 22. M3.0 — Platform Readiness Gate

完整 Extension Platform 开发前必须满足：

- [ ] 核心产品已有稳定重复使用群；
- [ ] Internal Contracts 已至少经过两轮真实重构；
- [ ] 至少 5 个官方模块使用内部 Registry/Provider；
- [ ] 存在明确的第三方扩展需求；
- [ ] Core 团队能够承担 API 兼容责任；
- [ ] 已有日志/指标/错误追踪基础；
- [ ] 已有基础安全响应流程；
- [ ] 平台工程不会阻塞核心产品开发。

不满足则停留阶段二。

---

# 23. M3.1 — Extension API Alpha

## 目标

从稳定 Internal Contracts 抽出最小 public API。

首批只开放：

```text
Commands
Theme
Panel/View
Graph Layout
Context Provider（有限）
```

## 验收标准

- [ ] Extension API 与内部实现分包；
- [ ] 插件不能 import Rhiza internal package；
- [ ] API 明确标记 alpha，无稳定兼容承诺；
- [ ] Manifest schema 完成；
- [ ] 至少 5 个官方 extension 重写为 public API dogfood；
- [ ] 至少发现并修正一轮真实 API 设计问题后再进入下一步。

---

# 24. M3.2 — Permission + Sandbox Foundation

## 目标

确保第三方代码不等于 Core 权限。

## 验收标准

- [ ] Tier 0 declarative extension 无代码运行时；
- [ ] Tier 1 Worker / iframe sandbox 可用；
- [ ] 插件无权限不能读取 Project/Files/Network；
- [ ] Secret 无法直接暴露给插件；
- [ ] Runtime Broker 有 permission / quota；
- [ ] 插件崩溃不导致 Core 崩溃；
- [ ] timeout / cancellation / dispose 可测试；
- [ ] Desktop native extension 仍保持关闭或实验状态。

---

# 25. M3.3 — Compatibility & Lifecycle Platform

## 目标

解决版本、依赖、能力冲突和激活顺序。

## 验收标准

- [ ] Manifest validation；
- [ ] Extension API SemVer validation；
- [ ] 简单 dependency graph resolution；
- [ ] cycle detection；
- [ ] additive/composable/exclusive capability resolution；
- [ ] DISCOVER → VALIDATE → RESOLVE → REGISTER → ACTIVATE 生命周期；
- [ ] 不存在依赖 load-order 才能正常运行的官方插件；
- [ ] Workspace lockfile 可生成/恢复；
- [ ] Safe Mode 可在插件导致异常时启动；
- [ ] Rhiza update 前可运行 compatibility simulation。

---

# 26. M3.4 — First-party Extension Dogfooding

## 目标

先让官方团队成为插件平台最苛刻的用户。

至少覆盖：

```text
Theme
Graph Layout
Context Provider
Knowledge Extractor
Tool / Connector
View / Panel
```

## 验收标准

- [ ] 10 个左右官方 Extension 可独立启停；
- [ ] API 变更记录完整；
- [ ] 无需修改 Kernel 即可实现新官方 Context Provider；
- [ ] 插件性能 metrics 可追踪；
- [ ] 插件数据卸载/升级策略经过测试；
- [ ] Extension API 仍可进行 breaking change，并完成一次 migration 演练。

---

# 27. M3.5 — Developer Preview / SDK Beta

## 目标

让少量外部开发者验证开发体验。

交付：

```text
SDK
CLI / scaffolding
Type definitions
Docs
Test Harness
Example extensions
Local dev mode
Permission simulator
Compatibility checker
```

## 验收标准

- [ ] 5~20 名外部开发者完成扩展开发；
- [ ] 从初始化到本地加载首个 Extension 有清晰教程；
- [ ] SDK 错误信息可定位常见问题；
- [ ] 不要求开发者理解 Rhiza Core 内部实现；
- [ ] 收集 API 缺失/错误抽象反馈；
- [ ] beta 前完成第二轮 API 修订。

---

# 28. M3.6 — Marketplace Preview

## 启动前置条件

```text
Extension API 相对稳定
Sandbox 可用
Permission 可用
Compatibility 可用
Signing / Integrity 可用
Moderation workflow 已定义
```

## 验收标准

- [ ] 扩展包签名与哈希验证；
- [ ] Publisher 身份；
- [ ] 权限声明；
- [ ] License metadata；
- [ ] 安全扫描；
- [ ] Compatibility metadata；
- [ ] 版本回滚；
- [ ] 举报 / 下架 / emergency revoke；
- [ ] Marketplace 故障不影响本地已安装扩展运行。

---

# 29. M3.7 — Cross-platform / Native / Enterprise Expansion

## 目标

基于已成熟平台扩展 Desktop/Mobile/Enterprise 能力。

## 验收标准

- [ ] Manifest 可声明 platform targets；
- [ ] 不兼容平台插件不会被错误激活；
- [ ] Desktop native 权限有高风险确认；
- [ ] Mobile 使用受限能力集；
- [ ] Enterprise 可配置扩展 allowlist；
- [ ] Workspace policy 可限制 network/files/runtime；
- [ ] 团队共享 extension profile 可复现。

---

# 30. M3.8 — Ecosystem Scale & Context Operating Layer Research

这不是固定产品功能列表，而是长期 R&D 方向。

研究主题：

```text
Cross-project knowledge graph
Personal Context Layer
Team Context Layer
Federated / local-first resources
Long-running agents
Automated context maintenance
Provenance-aware synthesis
Context quality evaluation
Model-independent context protocol
Large-scale graph navigation
Context marketplace / domain packs
```

## 验收标准

这一 Milestone 不以“功能全部实现”为标准，而要求每个研究方向都必须经过：

```text
Problem evidence
Prototype
User validation
Cost/risk analysis
Architecture decision
```

没有用户价值证据的研究不得自动进入 Product Roadmap。

---

# 31. 长期治理原则

```text
1. Core 永远小于生态。
2. 插件只能通过稳定 API 获得能力。
3. 插件不能绕过 Domain invariant。
4. Context 与 State 保持可追溯。
5. Secret 永远由 Broker 持有。
6. Compatibility 在激活前解决。
7. Load order 不决定正确性。
8. Installed 不等于 Running。
9. 插件失败必须可隔离。
10. Marketplace 不能成为 Core 的单点依赖。
11. 平台扩张不能牺牲普通用户的默认体验。
12. 每一层复杂度都必须由真实生态需求证明必要性。
```

---

# 32. 三阶段总体关系

```text
PHASE 1
证明核心产品价值
Chat + Graph + Explicit Context
        ↓
PHASE 2
把核心价值扩展成完整工作台
Resource + Planner + State + Knowledge + Internal Modularity
        ↓
PHASE 3
从成熟产品抽出平台能力
Extension API + Sandbox + Compatibility + Marketplace + Ecosystem
```

最重要的是这个顺序不可颠倒。

---

# 33. 长期一句话愿景

> **Rhiza 的终局不是“另一个 AI Chat”，也不是“一个有很多插件的 Chat”；它希望成为一个可追溯、可组合、可扩展的 Context Operating Layer，让人、模型、知识资源和工具围绕同一个长期项目结构协同工作。**

这是远景，不是当前承诺。

**END — PHASE 3**
