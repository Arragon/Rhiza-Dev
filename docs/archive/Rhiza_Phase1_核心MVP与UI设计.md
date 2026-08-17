# Rhiza 三步走规划 · 阶段一

> 文档名称：核心功能与可用 MVP / UI 设计
> 
> 阶段定位：先证明 Rhiza 是一个值得日常使用的 AI 对话产品，而不是“有 Graph 的技术 Demo”
> 
> 核心原则：**Core First / Product First / Chat + Graph First**
> 
> 设计依据：`ContextGraph_技术设计书_v4.0.md`、`Rhiza v4.0 技术设计评审`，以及后续“最小核心、清晰边界、延迟平台化”的路线修正。

---

# 0. 阶段一的唯一目标

阶段一不是实现 v4.0 的缩小版，也不是提前搭建未来平台。

阶段一只回答一个问题：

> **当用户需要处理复杂、多轮、可分支、需要显式上下文管理的 AI 工作时，Rhiza 是否比 LibreChat / ChatGPT 式线性对话明显更好用？**

如果这个问题不能得到肯定答案，那么插件系统、Marketplace、Sandbox、Capability Router 等长期能力都没有当前开发价值。

因此，阶段一必须同时做到两件事：

1. **对话能力足够完整**：用户不能因为“基本聊天体验不如 LibreChat”而放弃 Rhiza。
2. **Graph 能力足够成熟**：用户必须真实感受到“树状/网络状对话 + 显式 Context”带来的工作流优势，而不是只看到一个漂亮的关系图。

阶段一完成后，Rhiza 应当能够作为一个小范围真实用户的日常主力 AI 工具使用。

---

# 1. MVP 产品定义

阶段一 MVP 定义为：

```text
成熟 AI Chat 基础体验
+
Project / Node / Segment 对话结构
+
Anchor / Edge 分支机制
+
可实际工作的 Conversation Graph
+
显式 Context Inspector
+
最小可用 Context Planner
+
Immutable Context Manifest
+
基础文件上下文
```

它不是：

```text
LibreChat
+ 一个 Graph 页面
```

而应形成完整闭环：

```text
用户提出问题
↓
在一个 Node 中进行高质量普通对话
↓
发现值得展开的子问题
↓
从消息或选中文本创建分支
↓
Graph 出现新 Node / Edge
↓
用户在多个分支间切换、比较、继续工作
↓
Context Inspector 明确控制当前模型能看到什么
↓
需要时把旧 Node / 文件 / Segment Pin 进当前 Context
↓
每次模型调用冻结为 Context Manifest
↓
用户可以继续、重试、重新生成并理解“为什么这次回答不同”
```

这条闭环本身就是阶段一的产品价值验证对象。

---

# 2. 阶段一不做什么

以下能力明确不进入阶段一交付目标：

```text
第三方插件 SDK
Plugin Manifest
Dependency Resolver
Sandbox Runtime
Extension Marketplace
插件权限系统
插件兼容性矩阵
Plugin Lockfile
Native Plugin
复杂 Capability Router
多插件 Cost Attribution
企业级 Extension Observability
完整知识图谱平台
复杂 Agent Marketplace
移动端完整客户端
```

允许保留接口位置，但不得因为这些未来能力增加当前主流程复杂度。

原则：

> **Design seams, not platforms.**

---

# 3. 阶段一核心产品能力

## 3.1 对话能力：必须达到“可替代普通 AI Chat”的水平

阶段一不得把聊天视为上游附属模块。Discussion View 必须成为完整产品界面。

必须具备：

```text
Provider / Model 选择
模型参数控制
Streaming
Stop Generation
Retry
Regenerate
Edit & Resend
消息复制
Markdown
代码块
表格
引用块
附件显示
文件上传
图片输入（上游安全能力允许时）
Tool Call 基础显示
Reasoning / Progress 状态显示（模型支持时）
Token / Context 使用信息
错误恢复
断线/刷新后消息恢复
长消息稳定渲染
长对话虚拟化/分页
```

“基础聊天体验不输 LibreChat”是硬门槛，而不是优化项。

### Regenerate 与 Replay

阶段一保留严格语义：

```text
Regenerate
= 当前状态重新规划 Context
= 生成新 Context Manifest
= 新 Runtime Run

Replay
= 使用历史 Manifest 对等重放
```

Replay UI 可以后置到 MVP 后半，但数据结构从第一天支持。

---

# 4. Graph 必须是生产功能，而不是可视化附件

## 4.1 基础语义

阶段一 Graph 至少支持：

```text
Project
  └── Node
       └── Segment

Node ← Edge → Node

Anchor
= Message / Text Selection / Segment / Node 上的精确来源锚点
```

第一阶段 Edge 类型控制在少量、易理解的集合：

```text
DERIVED_FROM
REFERENCES
RELATED_TO
MERGED_INTO
```

其他高级语义留到阶段二。

## 4.2 用户必须完成的 Graph 操作

用户必须能够：

- 从整条用户/AI 消息创建分支；
- 从消息内选中文本创建分支；
- 从当前 Node 创建独立子 Node；
- 在 Graph 上点击 Node 立即切换 Discussion View；
- 查看某 Node 的来源 Anchor；
- 返回父节点/来源节点；
- 修改 Node 标题；
- 删除、归档或隐藏 Node；
- 手工创建 `RELATED_TO` 关系；
- 在 Graph 与 Chat 之间保持稳定的当前 Node 同步；
- 刷新页面后恢复同一 Project / Node / Graph 状态。

## 4.3 Graph 交互体验

Graph View 最低要求：

```text
Pan / Zoom
Fit View
Focus Current Node
Minimap 或 Overview
Node Search
Current Node Highlight
Ancestor / Descendant Highlight
Edge Hover 信息
Node Preview
Keyboard Navigation 基础支持
```

Graph 不得出现以下 MVP 失败形态：

```text
节点一多就重叠到无法使用
每次打开布局完全随机
点击 Graph 与 Chat 状态不同步
分支来源无法追溯
只能看，不能操作
```

## 4.4 Graph 规模目标

阶段一重点优化真实复杂对话，而不是百万节点图。

验收基准：

```text
100 Node Project：日常操作必须流畅
300 Node Project：仍然可导航、搜索、聚焦
500 Node Project：允许降级，但不能失去基本可用性
```

阶段一不追求一次性把所有节点同时“漂亮展示”；允许通过 focus/subgraph/filter 控制显示集合。

---

# 5. Explicit Context：Rhiza 的第二个核心差异

## 5.1 Context Inspector

阶段一必须提供用户可理解的 Context Inspector。

建议结构：

```text
Context Inspector
├── Current Node
├── Pinned
├── Auto Retrieved
├── Files
├── Excluded
└── Budget
```

每个 Context Item 显示：

```text
来源
类型
是否 Active
加入原因
Token / 估算长度
可移除/Pin/Exclude
```

必须让用户回答两个问题：

> 这一次模型看到了什么？

> 为什么它会看到这些内容？

## 5.2 阶段一 Context Resource 范围

只支持能够直接验证核心产品的几类资源：

```text
Current Node
Other Node
Segment
Uploaded File
Web Page（若实现成本可控）
```

Project State 在阶段一只实现轻量版本，完整状态系统进入阶段二。

## 5.3 最小 Context Planner

不要在阶段一追求理想化智能 Planner。

输入：

```text
Current Node History
Explicit Context
Pinned Context
File Chunks
Basic Project State
```

候选检索：

```text
FTS / BM25-like lexical relevance
+
Embedding similarity
+
简单 Graph distance
```

评分可从显式可解释公式开始：

```text
score =
semantic_weight * semantic_similarity
+ lexical_weight * lexical_score
+ recency_weight * recency
+ graph_weight * graph_proximity
```

不要让 LLM 自动路由、自动冲突检测成为 P0 依赖。

## 5.4 Token Budget

阶段一必须定义确定性的超限策略：

```text
Explicit / Pinned 优先
↓
Current Node Recent Context
↓
Auto Retrieved
↓
长资源 Relevant Chunks
↓
必要时 Summary / Truncation
```

如果用户显式 Pin 的内容仍然超过模型上限，UI 必须明确提示，而不是静默丢弃。

---

# 6. Context Manifest

每一次实际模型调用必须生成不可变 Manifest。

阶段一至少记录：

```typescript
interface ContextManifest {
  id: string;
  projectId: string;
  nodeId: string;
  createdAt: string;
  modelProfileId: string;
  items: ContextManifestItem[];
  promptHash: string;
  contextTokenEstimate: number;
}
```

Manifest Item 至少包含：

```text
resource reference
source version / content hash
selector / range
reason
priority
```

这不是为了“平台架构完整”，而是为了验证 Rhiza 最核心的可解释、可复现 Context 体验。

---

# 7. 阶段一 UI 信息架构

## 7.1 Desktop/Web 主布局

阶段一只把 Web 作为第一主客户端。

建议布局：

```text
┌─────────────────────────────────────────────────────────────┐
│ Top Bar: Workspace / Project / Search / Model / Settings   │
├───────────────┬───────────────────────────┬─────────────────┤
│ Project       │ Discussion View           │ Context         │
│ Navigator     │                           │ Inspector       │
│               │ Node Header               │                 │
│ Projects      │ Message List              │ Current         │
│ Nodes         │                           │ Pinned          │
│ Recent        │ Composer                  │ Retrieved       │
│               │                           │ Files           │
├───────────────┴───────────────────────────┴─────────────────┤
│ Graph Drawer / Graph Full View                             │
└─────────────────────────────────────────────────────────────┘
```

Graph 建议拥有两种形态：

```text
Quick Graph
= 当前 Node 周边局部图

Full Graph
= Project 全局结构视图
```

这样避免用户每次进入 Graph 都面对大图。

## 7.2 Node Header

必须显示：

```text
Node Title
Parent / Source
Node Type
Current Model
Context Indicator
Open in Graph
Branch / Link
```

## 7.3 从文本创建分支

这是阶段一最重要的 UX 之一。

推荐：用户选中文本后浮出快捷操作：

```text
Ask in branch
Create node
Add to context
Copy
```

点击 `Ask in branch`：

```text
Selected Text
↓
Create Anchor
↓
Create Child Node
↓
Create DERIVED_FROM Edge
↓
Open Child Node
↓
Selected Text 自动进入首轮 Explicit Context
```

整个过程不应超过 1 次菜单选择 + 1 次发送。

## 7.4 Context UI 与 Model UI 分离

始终保持：

```text
Model Selector
= 用什么模型回答？

Context Inspector
= 模型能看到什么？
```

不能混成一个“高级设置”抽屉。

---

# 8. 阶段一技术边界

保留 v3/v4 中已经证明必要的结构：

```text
Vertical Reuse
Horizontal Replacement
Adapter Boundary
Own the Domain
PostgreSQL Source of Truth
Explicit Context
Immutable Manifest
Runtime Replaceability
```

LibreChat 继续作为：

```text
Provider
Streaming
Tool Calling
MCP 基础
Model Capability
Chat Primitives
Markdown / Code
File UI
```

Rhiza 自己拥有：

```text
Project
Node
Segment
Event
Anchor
Edge
Graph
Context Manifest
Context Selection
Basic Planner
```

不允许重新把这些东西塞回 LibreChat Conversation 模型。

---

# 9. 阶段一最小扩展基础

阶段一不开放插件，但必须留下三类未来扩展接口。

## 9.1 ContextResourceProvider

```typescript
interface ContextResourceProvider {
  canHandle(ref: ContextResourceRef): boolean;
  resolve(ref: ContextResourceRef, selector?: ResourceSelector): Promise<ContextSlice[]>;
}
```

P0 官方实现：

```text
NodeContextProvider
FileContextProvider
WebContextProvider（可选）
```

## 9.2 GraphLayout

```typescript
interface GraphLayout {
  id: string;
  layout(input: GraphSnapshot): Promise<GraphLayoutResult>;
}
```

P0 只有一个默认实现，不做 Plugin Registry 公共 API。

## 9.3 RuntimeAdapter

继续保持 Runtime 与 Rhiza Domain 的 Anti-Corruption Layer。

这三处接口的意义是“未来可替换”，而不是现在搭平台。

---

# 10. Milestone 路线图

```text
M0  Clean Base & Engineering Baseline
 ↓
M1  Chat Parity Foundation
 ↓
M2  Rhiza Domain & Persistence
 ↓
M3  Branching + Graph Core
 ↓
M4  Explicit Context + Manifest
 ↓
M5  Context Planner MVP + Files
 ↓
M6  Product UX Hardening
 ↓
M7  MVP Validation Gate
```

---

# 11. M0 — Clean Base & Engineering Baseline

## 开发目标

建立一个能够持续迭代的 Rhiza clean base。

交付：

```text
固定 LibreChat baseline
License cleanup
Runtime Adapter skeleton
UI Adapter skeleton
PostgreSQL migration baseline
Basic CI
Unit / Integration / E2E test skeleton
Error logging
Feature flag 基础
```

## 验收标准

- [ ] Rhiza 可以独立 build / run；
- [ ] 上游 LibreChat 更新不会直接修改 Rhiza Domain；
- [ ] Product Domain 不 import LibreChat Conversation / Mongo domain；
- [ ] PostgreSQL 可以创建和迁移基础 schema；
- [ ] 最基本 provider request + streaming E2E 测试通过；
- [ ] CI 能覆盖 lint / typecheck / unit / basic E2E；
- [ ] 第三方许可证扫描结果可重复生成。

完成门槛：**开发基础稳定，不再通过修改上游 Conversation 模型快速堆功能。**

---

# 12. M1 — Chat Parity Foundation

## 开发目标

把 Rhiza Discussion View 做到“用户愿意聊天”。

交付：

```text
Message Renderer
Composer
Streaming
Stop
Retry / Regenerate
Edit & Resend
Model Selector
Generation Controls
Markdown / Code
Attachment / File Picker
Basic Tool UI
Usage UI
Error Recovery
```

## 验收标准

- [ ] 连续进行 100 轮普通对话无消息丢失；
- [ ] Streaming 中 Stop、刷新、重新进入页面不会破坏消息状态；
- [ ] Edit & Resend 会创建正确的新事件版本，而不是覆盖不可追踪历史；
- [ ] Markdown、代码块、表格、长文本可稳定显示；
- [ ] 文件上传、附件显示和模型调用形成完整闭环；
- [ ] 至少 3 种 Provider/Profile 可通过同一 Runtime Contract 工作；
- [ ] 失败请求有明确 Retry，而不是卡死；
- [ ] 日常基础聊天任务不需要回到 LibreChat 才能完成。

用户验收：让测试者只使用 Rhiza 完成普通聊天任务，基础体验不能成为主要抱怨来源。

---

# 13. M2 — Rhiza Domain & Persistence

## 开发目标

建立真正属于 Rhiza 的 Project / Node / Segment / Event 领域模型。

交付：

```text
Workspace minimal
Project
Node
Segment
Event
Version / Provenance
Project Navigator
Node Navigator
Persistence
Recovery
```

## 验收标准

- [ ] 一个 Project 可拥有多个 Node；
- [ ] Node 内 Event 按稳定顺序恢复；
- [ ] Segment 能作为检索和 Context 粒度存在；
- [ ] 刷新浏览器后 Project / Node / Message 状态一致；
- [ ] 删除/归档有明确语义；
- [ ] 所有领域 ID 与上游 conversation ID 解耦；
- [ ] Domain 操作有基本 transaction / audit 信息；
- [ ] 1000+ Event Project 不出现明显数据库结构瓶颈。

---

# 14. M3 — Branching + Graph Core

## 开发目标

第一次真正验证 Rhiza 的差异化价值。

交付：

```text
Anchor
Edge
Branch from Message
Branch from Text Selection
Graph View
Quick Graph
Full Graph
Node navigation
Manual RELATED_TO
Node Search
Focus / Fit / Highlight
```

## 验收标准

- [ ] 用户可从消息整段创建新分支；
- [ ] 用户可从选中文本创建精确 Anchor 分支；
- [ ] 新 Node 与来源 Node 的 Edge 自动生成；
- [ ] 点击 Graph Node 能稳定切换当前 Discussion Node；
- [ ] 从 Chat 能一键定位 Graph 当前节点；
- [ ] 100 Node 图无明显交互障碍；
- [ ] 300 Node 图仍可通过搜索/focus 正常导航；
- [ ] 分支来源可追溯到原始消息/文本；
- [ ] 刷新后 Graph 结构和布局状态可恢复；
- [ ] 用户测试中，80% 以上测试者无需口头指导即可完成“从一段回答创建支线并返回主线”。

产品验收：至少有一类复杂任务中，测试者明确认为分支工作流优于复制到新 Chat。

---

# 15. M4 — Explicit Context + Immutable Manifest

## 开发目标

让用户第一次真正控制“模型能看到什么”。

交付：

```text
Context Inspector
Pinned Context
Excluded Context
Current Node Context
Other Node / Segment Context
Context Token Estimate
Context Manifest
Regenerate Manifest semantics
```

## 验收标准

- [ ] 每一次模型调用都可追溯到唯一 Manifest；
- [ ] 用户能够看到 Active Context 清单；
- [ ] 用户可 Pin / Remove / Exclude Node 或 Segment；
- [ ] Context Inspector 能显示来源和加入原因；
- [ ] Regenerate 默认创建新的 Manifest；
- [ ] 历史回答能显示对应 Manifest 摘要；
- [ ] Context 超预算时不会静默丢弃显式 Pin 内容；
- [ ] 同一 Prompt 使用不同 Context 时，用户能够从 UI 理解差异来源。

---

# 16. M5 — Context Planner MVP + Files

## 开发目标

实现“够用、可解释、可 benchmark”的第一代 Planner。

交付：

```text
File ingestion
Chunk provenance
FTS retrieval
Embedding retrieval
Hybrid ranking
Simple graph proximity
Token budget
Relevant chunk projection
Basic cached summary
```

## 验收标准

- [ ] Node / Segment / File 均可进入 Candidate；
- [ ] Hybrid retrieval 有可重复测试集；
- [ ] 用户显式 Context 的优先级高于自动检索；
- [ ] 自动检索结果显示 `why selected`；
- [ ] 10 / 100 / 300 Node Project 有基准测试；
- [ ] 100 Node Project 的 Planner 本地处理 P95 目标 < 2 秒（不含模型生成时间）；
- [ ] 10MB 级文本/PDF 资源不会整文件常驻内存；
- [ ] 长资源通过 chunk / summary 投影进入 Context；
- [ ] Planner 错误或无结果时可降级为 Explicit + Current Node，不阻断聊天。

---

# 17. M6 — Product UX Hardening

## 开发目标

把“功能存在”变成“产品可用”。

重点：

```text
Chat polish
Graph polish
Context Inspector polish
Keyboard workflow
Loading / Empty / Error states
Performance
Recovery
Accessibility baseline
Onboarding
```

## 验收标准

- [ ] 新用户首次进入产品能理解 Project / Node / Graph / Context 四个核心概念；
- [ ] 常用操作有 keyboard shortcut；
- [ ] 主要操作不依赖隐藏式右键菜单；
- [ ] Graph 与 Discussion 状态不存在已知同步错乱；
- [ ] 页面刷新、网络重连、模型报错均能恢复；
- [ ] 100 Node 项目连续使用 1 小时无明显内存持续增长；
- [ ] 核心页面有 Loading / Empty / Error / Offline 状态；
- [ ] 主要桌面分辨率下布局可用；
- [ ] 至少完成一轮真实用户可用性测试并修复 P0/P1 UX 问题。

---

# 18. M7 — MVP Validation Gate

这是阶段一真正的结束条件。

不是“代码完成”，而是“产品假设得到初步验证”。

## 用户规模建议

至少：

```text
10+ 真实测试用户
5+ 用户连续使用 ≥ 2 周
至少覆盖 3 类复杂任务
```

任务建议：

```text
研究/资料整理
复杂产品/技术方案讨论
长周期代码/设计决策
```

## 产品验收标准

- [ ] 测试用户能够把 Rhiza 用作日常 AI Chat，而不是只体验 Graph；
- [ ] 至少 50% 的重复使用者在复杂任务中主动使用 Branch / Graph；
- [ ] 至少 50% 的重复使用者主动使用 Pinned/Explicit Context；
- [ ] 至少 5 名用户明确出现“如果没有 Graph/Context，我会更难完成这个任务”的实例；
- [ ] 基础 Chat 能力不是流失主因；
- [ ] Graph 可用性不是流失主因；
- [ ] Planner P95 和错误率达到内部目标；
- [ ] 至少形成 20 个真实复杂 Project 数据样本用于阶段二优化；
- [ ] 能清晰回答：Rhiza 相比 LibreChat 的核心价值是什么，以及用户在哪种工作负载下真正需要它。

## 阶段一 Go / No-Go

只有满足以下三个条件，进入阶段二：

```text
1. Chat 足够好，用户不会因为基础体验逃回普通 Chat；
2. Graph / Branch 在真实复杂任务中产生可观察价值；
3. Explicit Context / Planner 至少解决一个普通 Chat 明显困难的问题。
```

若不满足，优先重新设计产品核心，而不是增加功能。

---

# 19. 阶段一质量红线

```text
1. 不以插件平台名义增加任何关键路径复杂度。
2. 不允许 Rhiza Domain 反向依赖 LibreChat Conversation。
3. Graph 必须可操作、可导航、可恢复，不做纯展示图。
4. Chat 基础体验不得成为产品短板。
5. Context 必须可见、可控制、可追溯。
6. Planner 必须可降级，不能成为单点故障。
7. 所有关键用户数据必须可恢复。
8. 不为了未来百万节点场景牺牲当前 10~300 Node 的体验。
9. 不为了抽象而抽象。
10. 所有复杂度必须直接服务核心假设验证。
```

---

# 20. 阶段一最终交付定义

阶段一成功后的 Rhiza 应当可以用一句话描述：

> **一个具备成熟普通 AI 对话体验，同时允许用户把复杂讨论自然拆成可导航 Graph，并显式控制每次模型调用 Context 的可用产品。**

这时 Rhiza 才真正拥有继续发展的资格。

**END — PHASE 1**
