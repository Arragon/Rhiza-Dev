# Rhiza 三步走开发战略与架构重构规划 v2.3

> **Superseded(2026-08-22)**:本文档已被 Rhiza Architecture & Roadmap Baseline V4.0 取代,不再定义当前架构或开发计划,仅作战略背景与 Historical Evidence 保留。现行基线:`docs/Rhiza_技术架构设计书_V4.0_20260822.md` 与 `docs/Rhiza_开发路线图_V4.0_20260822.md`。

> 文档状态：战略基线 / Architecture Baseline（已废止）  
> 日期：2026-08-15  
> 适用范围：当前 Phase 1（已开发至 M6）及后续长期路线  
> 核心目标：以长期可演进架构为优先，允许对 M0–M6 进行必要重构；同时把运行效率、高频 Trace 吞吐、Headless Core、多平台 Host 适配和 Workspace 可移植性作为第一等架构约束。

---

## 0. 战略结论

Rhiza 的长期产品定义不再是“复杂对话管理工具”，而是：

**Rhiza 是面向复杂 Human–AI Work 的 Control Plane + Observability Plane。**

对话仍然是最重要的交互入口之一，但不再是系统的最高层抽象。Rhiza 最终管理的是一个长期存在的 Workspace，其中包含 Goal、Task、Conversation、Knowledge、Artifact、Decision、Context、Execution、Effect、Dependency、Risk、Extension 与 Human Action。

长期产品结构应当从：

```text
Workspace
  └─ Conversation
      └─ Branch / Graph
          └─ Context
```

演化为：

```text
Workspace
  ├─ Goal
  ├─ Task / Workstream
  ├─ Conversation
  ├─ Knowledge
  ├─ Artifact
  ├─ Decision
  ├─ Context
  ├─ Execution
  ├─ Effect / Impact
  ├─ Dependency / Risk
  ├─ Extension
  └─ Human / Agent
          │
          └─ projected into Work Graph
```

Rhiza 不应成为 Code Harness，也不应重新实现 OpenClaw、Hermes、Claude Code、Codex 等执行工具。Rhiza 的职责是理解复杂任务、组织上下文、定义工作、委派执行、接收执行轨迹、解释影响、管理权限、保存事实并让用户理解和控制工作。

长期竞争力不在某一个功能，而在于 Rhiza 对“复杂 AI 工作”的统一数据模型、运行时协议和交互模型。

当用户同时运行多个 CLI / Agent，甚至让不同 Executor 工作于一个或多个 Project 时，Rhiza 的职责不是替代这些工具内部的 agent loop，而是提供上层协调能力：任务拆解、并行 Workstream、依赖、分配、资源作用域、状态汇总、冲突检测、Handoff、审批以及跨 Agent 影响解释。

```text
Execution Intelligence
选谁来做？用哪个模型 / Endpoint？如何控制成本与质量？

Coordination Intelligence
哪些工作可以并行？谁依赖谁？哪里冲突？何时交接？何时需要人介入？
```

同时，Rhiza 不应把模型视为静态品牌标签。对于用户真正使用的 AI 基础设施，Rhiza 应长期学习：

```text
ModelSpec
+ ProviderEndpoint
+ Task Condition
+ Runtime Observation
+ User Outcome
        ↓
Personal AI Capability Map
        ↓
Adaptive Router / Pareto Selection
```

因此 Rhiza 不只是管理“AI 做了什么”，还应逐渐学习“用户手里的哪条 AI 服务路径最适合做什么”。

---

## 本次 v2.3 增补范围

v2.3 不增加新的产品功能，而是对 v2.2 做一次 **Physical Architecture Optimization**。目标是确保 Rhiza 在未来接入高频 Agent Trace、多 Agent 并行、Desktop 本机 CLI、跨平台运行和大规模 Workspace 后，仍然保持轻量、低延迟、可迁移。

本版正式加入六条长期物理架构原则：

```text
1. Domain Event ≠ Execution Trace ≠ Transient Stream
2. Transactional State 与高频 Trace 使用不同物理路径
3. Projection / Semantic Analysis 默认增量、异步、可重建
4. Rhiza Core 必须 Headless；OS 能力只通过 Host Runtime Adapter
5. Workspace 的产品级迁移格式是版本化逻辑 Bundle，而不是数据库 dump
6. Resource identity 不得绑定 Windows/macOS/Linux 文件路径
```

v2.2 已有的 Complex Work Model、Work Graph、Context Runtime、Multi-Agent Coordination、Execution Observability、Adaptive Model Routing 与 Self-extending Workspace 全部保留。v2.3 的作用，是让这些能力在物理实现上不会把 Rhiza Core 做成越来越重、越来越难迁移的单体。
---

# 1. 核心产品原则

## 1.1 Graph is the universal representation of complex work

Graph 不再被定义为 Conversation Graph 功能，而应逐步成为 Rhiza 对复杂工作的通用表示层。

同一个 Workspace 的底层事实可以投影为：

```text
Conversation View
Task View
Knowledge View
Execution View
Impact View
Decision View
```

这些 View 不应拥有彼此独立的数据真相，而是同一 Workspace Model 的不同 Projection。

Conversation Graph 是第一个 Projection，而不是最终模型。

## 1.2 Event is fact; Graph is interpretation

Rhiza 必须保留不可变的历史事实。

```text
Workspace Event Journal
        │
        ├─ Conversation Projection
        ├─ Task Projection
        ├─ Knowledge Projection
        ├─ Execution Projection
        ├─ Impact Projection
        └─ UI
```

不要求第一天实现纯粹 Event Sourcing、完整 CQRS 或所有状态都可由事件重建，但核心域必须遵守三个不可退让原则：

1. 关键历史不可 destructive overwrite。
2. provenance 不可丢失。
3. current state 不可成为唯一事实来源。

Branch、Edit & Resend、Regenerate、Context Manifest、Execution Run、Extension install/update、Agent action 等关键行为必须留下可追溯记录。

## 1.3 Rhiza owns task state; executors own execution strategy

未来外部 Agent / CLI 可以拥有自己的 session、scratch memory、内部 planner 和 tool loop，但 Workspace 的长期任务状态由 Rhiza 解释。

```text
Rhiza
Goal / Task / Scope / Context / Policy
                │
          Scoped Task Packet
                ↓
          Execution Provider
                │
        Event / Artifact / Effect
                ↓
              Rhiza
```

外部 Agent 不应被允许绕过 Rhiza Domain 任意修改 Workspace。

## 1.4 Agent is a composition, not a privileged class

长期不创建：

```text
ResearchAgent extends BaseAgent
CodingAgent extends BaseAgent
WritingAgent extends BaseAgent
```

而使用：

```text
AgentPreset =
  Model
+ Loop
+ Tools
+ Context Contributors
+ Memory
+ Policy
+ Skills
+ UI Surfaces
```

Agent 是 Capability Graph 的一种 composition。

## 1.5 Self-extending Workspace, not self-modifying core

Rhiza 可以在长期允许 Workspace 根据工作模式生长能力，但 Kernel 自身不能被 Agent 修改。

能力生长顺序固定为：

```text
Reuse
  ↓
Configure
  ↓
Compose
  ↓
Declare
  ↓
Code
```

Agent 可以提议、设计和委托 Extension 开发，但不能修改 Kernel、Permission、Event Semantics、Sandbox Boundary、Extension Validation Rules。

## 1.6 Code generation is an external development service

Rhiza 不做 Code Harness。

Rhiza 可以：

```text
Capability Gap
    ↓
Extension Proposal
    ↓
Extension Specification
    ↓
External Dev Provider
    ↓
Claude Code / Codex / other CLI
    ↓
Implementation Package
    ↓
Rhiza Validation
    ↓
Install
```

Rhiza 的核心价值在“定义应该存在什么”和“验收它是否可以安全存在”，而不是“如何写代码”。

## 1.7 Route the observed service path, not the nominal model

Rhiza 的评分与路由对象不能只是 `GPT X`、`Claude Y`、`DeepSeek Z` 这样的模型名。

真正的执行对象应被区分为：

```text
ModelSpec
理论/声明模型身份
        ↓
ProviderEndpoint
用户实际配置的 API / route / region / service path
        ↓
ObservedCapabilityProfile
真实工作中的观测能力
        ↓
Task-conditioned Route Score
```

两个声明为同一模型的 Endpoint 可以拥有完全不同的能力、延迟、稳定性与成本特征，因此不得共享一个用户能力分。

Runtime 内部的评分必须是条件函数，而不是单一总分：

```text
Score(
  endpoint,
  model_claim,
  task_type,
  context_size,
  toolset,
  workspace,
  time_window,
  user
)
```

UI 可以提供简化的综合分，但 Router 内部必须保留能力向量、样本数与置信度。

Rhiza 可以判断某个 Endpoint 的实际表现异常或退化，但不能仅凭行为特征断言供应商偷偷替换成了某个具体模型。

路由的长期原则是：

```text
User-configured AI Pool
        ↓
Task Classification
        ↓
Observed Capability Prediction
        ↓
Constraint Filtering
        ↓
Pareto Frontier
        ↓
Route Decision
        ↓
Execution
        ↓
Outcome Observation
        ↺
```

真实工作本身逐渐成为用户私有的 workload benchmark。

---

## 1.8 Multi-Agent is task coordination, not a fixed agent topology

Rhiza 的 Multi-Agent 抽象不应建立在“Supervisor → Worker”这一种具体实现上。

长期稳定的协议对象应当是：

```text
TaskPlan
Workstream
Dependency
Assignment
Executor
ExecutionLease
RunGroup
Handoff
Checkpoint
```

而以下协作拓扑都属于可替换策略：

```text
Supervisor pattern
Planner / Executor split
Peer-to-peer collaboration
Role pipeline
Swarm
Map-reduce
Debate / review
CLI process manager
External agent framework
Agent-internal subagents
```

Rhiza 只理解 Executor 的边界、状态、产物、影响与依赖，不需要控制其内部每一步 reasoning。

三个基本原则：

```text
Plan is versioned
Assignment is scoped
Effects are reconciled
```

计划调整必须留下 revision；每个 Executor 只获得完成当前 Assignment 所需的 Context / Resource / Permission；各 Agent 的结果先作为 Event / Artifact / Effect 回流，再由 Rhiza 更新 Workspace truth。

## 1.9 Control plane stays thin; high-volume data stays off the hot path

Rhiza 的产品能力可以越来越丰富，但主交互热路径必须长期保持短。

禁止把以下工作放在用户等待模型首 token 的同步路径：

```text
full graph rebuild
semantic clustering
impact extraction
trace summarization
capability profile recomputation
large-workspace full scan
search index rebuild
cold storage compaction
```

典型 LLM 热路径应尽量接近：

```text
UI
 ↓
Application Command
 ↓
small transactional write
 ├ current state
 ├ domain event
 └ ExecutionRun
 ↓
cached / incremental Context planning
 ↓
materialized Routing profile
 ↓
Execution Provider
```

Graph clustering、Impact extraction、Execution semantic compression、Capability Profile 更新等默认异步完成。

性能原则不是“少保存历史”，而是：

```text
facts remain durable
high-frequency details use the right storage
derived understanding stays rebuildable
```

# 2. 长期目标架构

## 2.1 总体结构

```text
┌────────────────────────────────────────────────────────────────────┐
│                          Client Surfaces                           │
│                 Web / Desktop / Future Clients                    │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                         Rhiza Protocol / IPC
                                 │
┌────────────────────────────────▼───────────────────────────────────┐
│                        Headless Rhiza Core                         │
│                                                                    │
│ Workspace / Task / Context / Work Graph / Coordination / Routing  │
└───────────────┬─────────────────┬─────────────────┬────────────────┘
                │                 │                 │
        Control / State      Projection Plane   Execution Plane
                │                 │                 │
     ┌──────────▼────────┐        │        ┌────────▼─────────┐
     │ Transactional     │        │        │ Execution Router │
     │ State Store       │        │        └────────┬─────────┘
     └──────────┬────────┘        │                 │
                │                 │      Human / LLM / CLI / Agent / Tool
     ┌──────────▼────────┐        │                 │
     │ Domain Event      │        │        ┌────────▼─────────┐
     │ Journal           │        │        │ Trace Ingestion  │
     └──────────┬────────┘        │        │ + Backpressure   │
                │                 │        └────────┬─────────┘
                └────────────┬────┘                 │
                             │             ┌────────▼─────────┐
                    Projection Workers     │ Execution Trace  │
                             │             │ Store            │
                             │             └────────┬─────────┘
                    Work Graph / Search             │
                    Materialized Views      Semantic Workers
                             │                      │
                             └──────────────┬───────┘
                                            │
                                 Impact / Cluster / Summary

               Live UI uses a separate Transient Stream:
               token / stdout / progress / heartbeat

                    ─────────────────────────────

                     Rhiza Host Protocol
                              │
                ┌─────────────┼─────────────┐
                │             │             │
             Windows        macOS         Linux
             Adapter        Adapter       Adapter
                │             │             │
          PTY / Process / FS / Credential / Sandbox / CLI
```

这个结构明确区分三类职责：

```text
Control Plane
Rhiza 如何理解、安排和控制复杂工作

State / Projection Plane
Rhiza 如何保存事实并生成用户可读状态

Telemetry / Trace Plane
Rhiza 如何吸收高频执行细节，而不拖慢 Control Plane
```

Rhiza Core 必须保持 Headless。Desktop/Web 只是 Client Surface；本机 OS 能力属于 Host Adapter，不属于 Domain。

## 2.2 Kernel 的边界

Kernel 应保持极薄，只稳定以下协议面：

```text
Identity / Scope
Event Contract
Capability Contract
Permission / Policy
Lifecycle
Storage / Resource Contract
Context Contract
Execution Contract
Executor / Assignment Contract
Lease / Handoff Contract
Model Endpoint / Routing Contract
Host Runtime Contract
Portable Workspace Contract
Extension Contract
```

以下能力全部允许替换或扩展：

```text
LLM
Planner
Retriever
Memory implementation
Agent loop
Tool
MCP
Browser
CLI
Sandbox
Embedding
Search
UI view
Extension
Execution provider
```

Kernel 不承载具体产品业务逻辑。

Kernel 不应直接依赖 Electron/Tauri、Node child_process、Windows ConPTY、POSIX signal、macOS Keychain、Windows Credential Manager、Linux Secret Service 或绝对 filesystem path。这些能力必须经 Infrastructure / Host Adapter / Store Port 注入。

## 2.3 Workspace 核心对象

建议长期统一 ID 与 provenance 体系，并逐步形成以下对象：

```text
Workspace
Goal
Task
TaskPlan
Workstream
Assignment
ExecutorProfile
RunGroup
Handoff
Checkpoint
Conversation
Message / Segment
Resource
Artifact
Knowledge
Decision
ContextSpec
ContextManifest
ExecutionRun
ExecutionEvent
ModelSpec
ProviderEndpoint
RoutingDecision
CapabilityObservation
Effect
Dependency
Conflict
Risk
Extension
Actor
```

所有对象至少应具备：

```text
id
workspace_id
created_at
created_by / actor
version or revision
provenance
scope
status where applicable
```

## 2.4 Work Graph

Graph 应建模“关系”，而不是把每种业务写死成独立 Graph。

Node 可以引用 Workspace Object：

```text
GraphNode
  object_ref
  object_type
  projection_metadata
```

Edge 采用可扩展 relation type：

```text
parent_of
branch_from
depends_on
derived_from
supports
contradicts
produced_by
modified_by
caused_by
affects
references
contains
assigned_to
blocked_by
supersedes
```

Phase 1 只需要实现 Conversation 所需 relation，但 schema 不应限制为 conversation-only。

## 2.5 Context System

长期 Context Pipeline：

```text
Resource
   ↓
Context Contributor
   ↓
Context Candidate
   ↓
Context Planner
   ↓
Context Spec / Graph
   ↓
Context Compiler
   ↓
Immutable Context Manifest
   ↓
Model / Agent
```

Manifest 必须支持：

```text
resource_ref
resource_version
content_hash
selector / range
reason
priority
token estimate
planner version
compiler version
execution_run_id
```

这样 Replay 才具有意义。

## 2.6 Execution Model

未来所有模型调用、Tool Run、CLI Run、Agent Run 都应逐渐统一到 Execution 抽象。

```text
ExecutionRun
  id
  provider
  executor_ref
  assignment_ref
  run_group_ref
  parent_run_ref
  provider_endpoint_ref
  model_spec_ref
  routing_decision_ref
  actor
  task_ref
  workspace_scope
  goal
  input_refs
  context_manifest_ref
  permission_scope
  status
  started_at
  finished_at
```

ExecutionProvider 长期协议：

```text
detect()
capabilities()

execute(TaskSpec)
resume(run_id)
pause(run_id)
cancel(run_id)

get_status(run_id)
get_events(run_id)
get_artifacts(run_id)
```

Phase 1 不实现完整 Provider API，但模型调用必须先成为 `ExecutionRun`，避免未来再次迁移。

## 2.7 Execution Observability

外部执行工具原生 trace 进入 Adapter 后统一为 Rhiza Execution Event：

```text
ExecutionEvent
  run_id
  actor
  timestamp
  event_type
  intent
  operation
  input_refs
  output_refs
  resource_reads
  resource_writes
  artifact_refs
  caused_by
  parent_event
  permission_scope
  status
```

原始事件不可被 AI summary 取代。

在此基础上生成：

```text
Semantic Node
Cluster
Intent
Decision
Dependency
Effect
Risk
Summary
```

形成两个关键 Projection：

```text
Execution Graph
它是怎么做的？

Impact Graph
它改变了什么？
```

## 2.8 Extension Runtime

长期 Extension 不只是 Tool，而是一个受治理的 Workspace Module。

Extension Manifest 至少包括：

```text
id
version
target_rhiza_api
scope

provides:
  capabilities
  tools
  context_contributors
  event_handlers
  ui_surfaces

requires:
  capabilities
  permissions

storage:
  namespace
  schema_version

subscriptions:
  event_types
```

Extension 默认使用 Rhiza Storage API 和 namespace，不允许自由决定数据存储位置。

UI 优先使用声明式 Extension UI：

```text
Sidebar View
Panel
Detail View
Table
Form
Graph
Command
Context Action
Resource Renderer
```

只有后期才开放 sandboxed custom view。


## 2.9 Adaptive Model Intelligence & Routing

Model routing 属于 Execution Runtime 上层的智能决策服务，而不是 Kernel 特权逻辑。

核心对象：

```text
ModelSpec
  id
  vendor
  claimed_model
  nominal_capabilities
  context_window
  modalities

ProviderEndpoint
  id
  provider
  route
  region
  service_tier
  declared_model_ref
  pricing_ref
  enabled
```

每次执行必须留下不可变 `RoutingDecision`：

```text
RoutingDecision
  id
  task_type
  endpoint_candidates
  selected_endpoint
  selected_model
  constraints
  predicted_scores
  confidence
  reason
  router_version
  fallback_plan
```

执行后写入 `CapabilityObservation`：

```text
CapabilityObservation
  execution_run_id
  endpoint_ref
  model_spec_ref
  task_type
  context_size
  toolset
  timestamp

  quality_signal
  task_success
  user_feedback
  structured_output_success
  tool_call_success

  ttft
  total_latency
  token_throughput
  retry_count
  error_class
  estimated_cost
```

长期聚合为：

```text
ObservedCapabilityProfile

reasoning
coding
long_context
instruction_following
tool_use
structured_output
latency
availability
cost_efficiency

+ sample_count
+ confidence
+ time_window
+ workload_slice
```

新 Endpoint 不应因缺乏用户数据而被直接判定为低质量。长期可使用分层先验：

```text
Public / Vendor Knowledge
        ↓
Model Prior
        ↓
Provider / Endpoint Prior
        ↓
User Work Observations
        ↓
Personal Posterior
```

Router 的目标不是寻找一个“全局最佳模型”，而是在用户约束下寻找任务条件化 Pareto frontier，例如质量、成本、延迟、可靠性、长上下文能力、工具能力之间的非支配选择。

`Route Fingerprint` 用于观测同一 Endpoint 的长期运行特征与异常漂移：

```text
latency distribution
TTFT
throughput
error distribution
retry rate
tool-call consistency
context degradation
cost
response metadata
```

它可以支持“Observed route degradation detected”，但不得被产品解释为对隐藏模型身份的确定识别。

用户必须始终可以选择：

```text
Manual
Pinned
Policy
Adaptive
```

Adaptive 模式必须可解释、可关闭、可覆盖。

---

## 2.10 Multi-Agent Work Coordination

多 Agent 的核心不是“同时启动多个进程”，而是把复杂任务拆成可追踪、可并行、可重新计划的工作单元，并把多个独立 Executor 的结果重新合并成用户可理解的 Workspace 状态。

### TaskPlan

`TaskPlan` 是版本化对象，至少记录 task、revision、planner、objective、workstreams、dependencies、checkpoints、budget 与 status。任何 Human / Planner / Agent 修改计划都产生新 revision，不覆盖旧计划。

### Workstream DAG

Dependency 至少支持：

```text
depends_on
blocked_by
can_parallelize_with
requires_artifact
requires_decision
conflicts_with
```

### Executor Registry

```text
ExecutorProfile
  id
  kind: human | direct_llm | cli | external_agent | tool
  provider_ref
  capabilities
  workspace_bindings
  concurrency_limit
  cost_policy
  availability
  permission_ceiling
```

同一个 CLI Provider 可以注册多个 Executor instance，例如不同 session、不同 repo / worktree 或不同 Workspace 绑定。

### Assignment

```text
Assignment
  id
  workstream_ref
  executor_ref
  context_spec_ref
  resource_scope
  permission_scope
  expected_outputs
  acceptance_criteria
  priority
  budget
  deadline
  status
```

Workstream 与 Executor 通过 Assignment 解耦，因此重新分配 Agent 不改变 Task identity。

### Scoped Task Packet

每个 Executor 默认只获得当前 Goal、Workstream、Relevant Context Manifest、Allowed Resources、Expected Outputs、Constraints、Acceptance Criteria、Upstream Artifacts 和 Known Risks。禁止默认把整个 Workspace 灌给每个 Agent。

### RunGroup

`RunGroup` 关联同一次 TaskPlan revision 下的多个 Assignment / ExecutionRun，并汇总 aggregate status、cost 与时间。每个 Agent 仍产生独立 ExecutionRun；RunGroup 只是协调投影，不取代底层 trace。

### Handoff

Agent 之间的交接是一等对象：

```text
Handoff
  from_assignment
  to_assignment
  summary
  artifact_refs
  decision_refs
  unresolved_questions
  assumptions
  risks
  context_refs
```

Handoff 必须有 provenance。

### Execution Lease / Resource Conflict

Rhiza 只抽象 `resource scope / write lease / effect / conflict / reconciliation status`。具体 Provider 可以用 branch、worktree、sandbox、draft version、transaction 或 namespace 实现物理隔离。

多个 Executor 对同一受管 Resource 产生重叠写影响时，生成 Potential Conflict，进入 Reconcile / Review / Re-run；Rhiza 不重新实现 Git merge 或数据库事务。

### Coordination Modes

```text
Manual       用户创建 / 分配 / 启动
Assisted     Rhiza 建议拆解、依赖和 Executor，用户确认
Orchestrated Rhiza 在 Lease / Policy / Budget 内自动调度
External     外部 Agent 自管 subagent，Rhiza 接收聚合或 nested trace
```

### Multi-Agent Observability

Work Graph 提供 Task Graph、Run Graph、Execution Graph、Impact Graph 与 Conflict View。UI 支持按 Workspace、Task、Executor、时间和影响范围聚类，并允许从 Task cluster 下钻到 Agent Run，再下钻到 raw ExecutionEvent。

### Cross-Workspace Coordination

Phase 2 先保证同一 Workspace 内多 Executor；Phase 3 再引入 `Mission / CoordinationSession` 引用多个 Workspace。每个 Workspace 的数据与权限仍独立，Mission 只保存引用、依赖与授权后的 Context Packet。

## 2.11 Physical Data Architecture

Rhiza 必须把“事件”拆成不同物理语义，而不是建立一个无限膨胀的总事件表。

### Transactional State

保存用户当前操作所需的强一致状态，例如 Workspace、Task、Assignment、Conversation current projection、Resource metadata、Permission / Lease 和 Extension installation state。特点是低到中等写入量、强事务、低延迟查询。

### Domain Event Journal

只保存需要长期追溯的业务事实，例如：

```text
task.created
branch.created
assignment.started
assignment.completed
decision.created
artifact.registered
effect.confirmed
conflict.detected
extension.installed
```

它是 append-only、schema-versioned、带 causation/correlation，并与 Domain transaction 对齐。

### Execution Trace Store

保存高频执行轨迹：

```text
tool call
file read
command
retry
native agent event
subagent event
provider trace
```

它与 Domain Event Journal 分离，并允许 batch ingest、compression、按 run/time 分区、retention policy 和 hot/warm/cold 分层。

一个 Agent Run 可以产生 10,000 条 Trace，但只产生十几条真正有业务意义的 Domain Event。

### Transient Stream

以下数据默认只是实时流：

```text
token chunk
stdout chunk
progress tick
heartbeat
typing / live status
```

它们服务于实时 UI，不自动等价于永久事实。必要时由 Aggregator 转化为 Trace、Metric、Domain Event 或 Artifact。

### Ingestion / Backpressure

```text
native events
  ↓
adapter buffer
  ↓
bounded queue + batch
  ↓
Trace Store
  ↓
semantic worker
```

必须有 bounded buffer、batch size / flush interval、backpressure signal、对非关键 telemetry 的显式 sample/drop 策略，以及 critical event bypass。事实型 Domain Event 不得因背压丢失。

---

## 2.12 Projection / Cache / Query Architecture

Projection 默认增量维护。Conversation tree、Task DAG、Execution status、Graph adjacency、Search index、Resource version index 不应每次请求从头生成。

以下语义能力默认异步：

```text
semantic clustering
impact extraction
risk extraction
execution compression
knowledge linking
capability profile update
route fingerprint update
large graph layout optimization
```

它们必须可以从 durable facts 重建。

Context Planner 不应每轮全量扫描 Workspace，应缓存或预计算 Resource token count、content hash、embedding/search index、graph neighborhood、recent-use score、resource summary 和 task-local candidate。

Adaptive Router 请求时只读取 materialized `ObservedCapabilityProfile`；历史 `CapabilityObservation` 在后台聚合，不在每次路由时扫描全部 ExecutionRun。

Graph 查询采用：

```text
node neighborhood
cluster summary
viewport-based fetch
depth-limited traversal
filter by object / relation / time
progressive disclosure
```

禁止 Web/Desktop 默认下载整个 Workspace Graph。

---

## 2.13 Headless Core & Host Runtime Architecture

`@rhiza/domain`、`@rhiza/application`、Context / Graph / Coordination / Routing 核心必须能在没有 Desktop UI、没有真实本机 CLI、没有 OS-specific API 的环境中运行。

目标运行形态：

```text
Web + Server Core
Desktop + Local Core
Self-host Core
Future daemon / service
```

Core 通过 `Rhiza Host Protocol` 请求本机能力：

```text
process.detect
process.spawn
process.signal
pty.open
filesystem.pick
filesystem.watch
credential.get
credential.set
sandbox.create
sandbox.destroy
cli.discover
host.capabilities
```

Host Adapter 显式声明：

```text
supports_pty
supports_process_suspend
supports_posix_signal
supports_native_sandbox
supports_keychain
supports_file_watch
```

Windows/macOS/Linux 差异只能存在于 Host Adapter。Domain / Application / Executor contract 不允许通过 `process.platform` 等方式直接分叉。

CLI discovery 是 Host 能力。Host 返回规范化 CLI descriptor，再注册到 Executor Registry。

---

## 2.14 Storage Portability & Portable Workspace Bundle

Rhiza 不追求“所有数据库 SQL 相同”，而追求 Domain 与用户数据可移植。

```text
Domain / Application
        ↓
Store Ports
        ↓
PostgreSQL implementation
embedded / SQLite implementation
future storage implementation
```

数据库 backend 可以各自优化，但数据库表结构不是产品级迁移协议。

正式定义版本化 Portable Workspace Bundle，例如：

```text
workspace.rhiza/
  manifest.json
  objects/
  domain-events.ndjson
  resources/
  provenance/
  extension-manifests/
  blobs/
    <content-hash>
```

Bundle 用于 backup、restore、desktop↔server、self-host migration、archive 和长期可读性。数据库 dump 只作为运维备份。

Resource identity 必须平台无关，例如：

```text
rhiza://workspace/<workspace-id>/resource/<resource-id>
```

`C:\...`、`/Users/...`、`/home/...` 只能作为 location/origin metadata。

Context Manifest 引用 Resource ID + version/hash，不引用绝对 OS path。文本 hash 需要明确 raw-byte 或 canonical-content 策略及 canonicalization version，避免 CRLF/LF 等平台差异造成逻辑身份漂移。

---

## 2.15 Extension Portability Classes

Extension Manifest 必须声明 portability class：

```text
Portable Extension
  declarative / protocol only
  no host dependency

Sandboxed Extension
  requires supported sandbox runtime

Host Extension
  depends on local CLI / filesystem / native capability
```

同时声明：

```text
supported_platforms
required_host_capabilities
required_runtime
```

声明式 UI、Context Contributor、Event Rule、namespaced storage 应尽量保持 Portable。依赖 bash/native binary 的 Extension 不得被标记为全平台。

# 3. 三步走战略总览

```text
第一阶段
Foundation of Complex Work
复杂对话 → 可追溯 Work Graph + Context Runtime

        ↓

第二阶段
Complex Task Workspace
复杂工作 → Goal / Task / Workstream / Multi-Executor / Knowledge / Execution / Multi-view Graph

        ↓

第三阶段
AI Work Control Plane
多 Agent / CLI / Extension → Dynamic Coordination + Delegation + Observability + Self-extending Workspace
```

---

# 4. 第一阶段：Foundation of Complex Work

## 阶段目标

第一阶段不追求成为通用 Agent 平台。

目标是用真正可长期演进的架构完成当前已经验证方向：

```text
Chat
Branch
Graph
Explicit Context
Replay / Provenance
Workspace
```

同时确保这些能力已经建立在未来 Task、Execution、Extension 可复用的底座上。

建议将当前 Phase 1 重写为 M0–M8。

---

## M0 — Architecture Reset & Domain Boundary

### 目标

建立 Rhiza 自己的稳定 Domain Boundary，解除 UI、LibreChat、具体 LLM Runtime 与 Rhiza 核心模型之间的硬耦合。

### 核心交付

```text
@rhiza/domain
@rhiza/application
@rhiza/infrastructure
@rhiza/runtime-adapters
@rhiza/web
```

明确依赖方向：

```text
UI
 ↓
Application
 ↓
Domain

Infrastructure → implements Domain ports
Runtime Adapter → implements execution/runtime ports
```

禁止：

```text
UI → database
UI → LibreChat model
Domain → React
Domain → concrete LLM SDK
```

### 验收标准

1. Domain package 不依赖 LibreChat、React、具体 LLM SDK。
2. UI 的所有写操作必须经 Application Service / Command Boundary。
3. Rhiza Domain 使用自己的 ID，不直接使用 LibreChat conversation/message ID 作为主键。
4. 至少建立以下 ADR：
   - Workspace Domain Boundary
   - Event Strategy
   - Graph Model
   - Context Manifest
   - Runtime Adapter
   - Scope / Permission direction
5. CI 中存在 package dependency test，违反边界即失败。
6. 当前 M6 核心功能可在新边界下继续运行。

---

## M1 — Workspace Event Journal + Identity / Scope v0

### 目标

建立以后所有 Replay、Branch、Execution Trace、Extension Lifecycle 的历史基础。

### 核心设计

新增 append-only `workspace_events`。

建议最小字段：

```text
event_id
workspace_id
sequence
event_type
actor_type
actor_id
object_type
object_id
payload
causation_id
correlation_id
created_at
schema_version
```

Scope v0：

```text
user
workspace
conversation
run
```

暂不做复杂 Policy Engine。

### Phase 1 必须进入 Event Journal 的行为

```text
workspace.created
conversation.created
message.created
message.revised
branch.created
edge.created
runtime.started
runtime.completed
context.manifest.created
context.selection.changed
```

### 验收标准

1. 关键业务写操作不存在 silent destructive overwrite。
2. 同一 Workspace 的 sequence 可稳定排序。
3. 写入支持 idempotency。
4. Event 与 current-state 更新在事务上不会产生长期不一致；建议采用事务内 event write，或 outbox。
5. 现有历史数据可 backfill 为最小事件序列。
6. 至少 Conversation / Branch 核心状态可通过 Event + Snapshot/Projection 验证一致性。
7. 可以查询“某个回复由哪个 Context Manifest、哪个 Runtime Run 产生”。

---

## M2 — Universal Work Graph v0 + Conversation Projection

### 目标

把现有 Conversation Graph 从“专用聊天结构”改造成 Work Graph 的第一个 Projection。

### 核心设计

保留当前 Project / Node / Segment / Anchor / Edge 中有价值的语义，但重新区分：

```text
Domain Object
Graph Projection
UI Layout
```

Graph 不保存唯一业务真相。

### Graph v0

```text
GraphNode
  graph_node_id
  workspace_id
  object_ref
  object_type
  projection_type

GraphEdge
  edge_id
  workspace_id
  source_ref
  target_ref
  relation_type
  metadata
```

Phase 1 relation：

```text
contains
parent_of
branch_from
references
supersedes
```

### 验收标准

1. Conversation Branch 可完全通过 Work Graph projection 表示。
2. Graph schema 不包含“只能是 message/conversation”的硬约束。
3. Graph layout metadata 与 domain relation 分离。
4. 删除 UI node 不会直接删除 domain object。
5. 同一个 Conversation 可支持 Tree View 与 Graph View 两种 projection。
6. 未来添加 Task / Artifact node 不需要改 Graph 基础表结构。
7. 1,000 个节点级别的测试 Workspace 中，查询、展开、聚类不会出现结构性性能问题；必须建立可重复 benchmark。

---

## M3 — Conversation Runtime + ExecutionRun v0

### 目标

当前所有 LLM 调用先统一成为 ExecutionRun，避免 Phase 2 引入 Agent / CLI 时再次迁移核心调用链。

### 核心流程

```text
User action
  ↓
Application Command
  ↓
Context preparation
  ↓
ExecutionRun created
  ↓
RuntimeAdapter
  ↓
LLM
  ↓
Execution events/result
  ↓
Message / Artifact
```

### RuntimeAdapter

继续保持 Anti-Corruption Layer：

```text
Rhiza
  ↓
RuntimeAdapter
  ↓
LibreChat / OpenAI / Anthropic / others
```

Domain 不感知 LibreChat conversation model。

### 验收标准

1. 每一次模型生成都有独立 `execution_run_id`。
2. Regenerate 必须产生新 Run。
3. Run 保存 `provider_endpoint_ref`、`model_spec_ref` 与 runtime configuration snapshot 或引用。
4. 即使两个 Endpoint 声称提供同一模型，也必须能够在历史记录中明确区分。
5. Run 关联 input object refs 和 Context Manifest。
6. Run 结果与产生的 message/artifact 建立 provenance。
7. 至少采集 TTFT、总延迟、token usage、错误类型、retry、provider metadata 等可得运行遥测。
8. 用户反馈或明确任务结果能够与 Run 关联，作为未来 Capability Observation 的数据来源。
9. 更换一个 RuntimeAdapter 不需要修改 Domain Entity。
10. 外部 Runtime 失败、取消、超时均有明确状态和事件。

---

## M4 — Context Runtime v1

### 目标

把当前 Explicit Context 从 UI 功能提升成可复用的 Context Runtime。

### 核心对象

```text
Resource
ContextSelection
ContextCandidate
ContextPlan
ContextManifest
```

Phase 1 可简化 Contributor，但接口必须存在。

### 流程

```text
Workspace Resources
  + Explicit Selection
  + Branch Context
       ↓
Context Contributors
       ↓
Candidates
       ↓
Basic Planner
       ↓
Context Compiler
       ↓
Immutable Manifest
       ↓
ExecutionRun
```

### 验收标准

1. Manifest 永久不可变。
2. Manifest 记录 source version/content hash。
3. Manifest 记录选择原因与优先级。
4. Planner 和 Compiler 有版本标识。
5. Replay 可以使用历史 Manifest，而不是重新执行当前 Planner。
6. Regenerate 默认产生新 Manifest；用户可选择 replay old manifest。
7. 数据库不只保存最终拼接 prompt。
8. UI 可以解释“这一轮为什么带入这些上下文”。

---

## M5 — Branch / Revision / Replay / Provenance

### 目标

建立 Rhiza 区别于普通 Chat UI 的可靠历史模型。

### 必须统一的行为语义

```text
Edit & Resend
≠ 修改旧消息

Regenerate
≠ 覆盖旧回复

Branch
≠ copy conversation

Replay
≠ 用当前状态重新问一次
```

### 推荐语义

`Edit & Resend` 创建 revision + 新 branch/run。

`Regenerate` 创建新 ExecutionRun + 新结果。

`Branch` 创建 relation，不复制不可追踪历史。

`Replay` 使用历史 input refs + 历史 Context Manifest + 可选 runtime snapshot。

### 验收标准

1. 历史回答永远可访问。
2. 用户可以追踪任何 Node 的来源。
3. 一个回复至少可追溯：
   - parent / branch source
   - user input revision
   - context manifest
   - execution run
   - model/provider
4. 任意 regenerate 不覆盖旧输出。
5. Replay 可明确标记“完全 replay / 部分 replay / current model replay”。
6. Graph 中 branch、revision、regenerate 不产生歧义。
7. 所有 provenance 查询具有稳定 API。

---

## M6 — Productization + Architecture Compatibility

### 目标

把上述重构后的能力重新打磨到当前 M6 已达到的产品可用程度，并建立 Phase 2 所需 telemetry。

### 产品重点

```text
Chat usability
Branch usability
Graph navigation
Explicit Context usability
Performance
Error recovery
Data integrity
Migration reliability
```

### Architecture Compatibility Audit

必须验证未来无需重写即可加入：

```text
Task object
Artifact object
ExecutionProvider
ExecutorProfile / Assignment / RunGroup
Adaptive Model Router
Extension runtime
Execution event stream
Impact projection
```

不要求实现，但必须通过 architectural spike / contract test 证明 schema 与 boundary 可承载。

### 验收标准

1. M0–M5 所有架构验收通过。
2. 现有 M6 用户路径无功能倒退。
3. Legacy write path 全部关闭，或明确处于短期兼容名单。
4. 所有关键行为具有 telemetry。
5. Graph、Context、Runtime、Event 的 p50/p95 latency 有基线。
6. 数据迁移可在 staging 数据上重复执行。
7. 发生迁移失败时可 rollback。
8. 完成一次“Task + external ExecutionRun + Artifact”纸面/测试实现 spike，证明无需更改 Kernel 数据边界。
9. 完成一次“Adaptive Router”纸面/测试实现 spike：两个声称相同模型的 Endpoint 必须拥有独立 telemetry、score 与 route decision。
10. 完成一次“Multi-Agent Coordination”纸面/测试实现 spike：一个 Task 拆成至少 3 个 Workstream，由两个不同 Executor 并行执行并产生独立 Run。
11. 完成一次“Workspace extension manifest”纸面/测试 spike，证明不需要修改 Conversation 核心模型。

---

## M7 — Closed Beta: Product Hypothesis Validation

### 目标

验证的不是“架构是否漂亮”，而是以下用户假设：

1. 用户是否真的需要把复杂对话展开为 Graph。
2. 用户是否会主动控制 Context。
3. 用户是否能通过 Branch / Graph 更好地处理复杂问题。
4. 用户是否开始自然地把 Rhiza 当成复杂工作的“总览和组织地点”。

### 验收标准

必须收集行为数据与定性反馈，不以注册量作为主要指标。

至少观察：

```text
branch usage
graph revisit
context selection usage
replay usage
long project retention
cross-session continuation
user-created structure
```

Go / No-Go 必须基于真实复杂任务样本。

---

## M8 — Phase 1 Consolidation

### 目标

只修 M7 暴露的结构性问题，并冻结 Phase 1 核心协议版本。

### 验收标准

1. Event v1 稳定。
2. Work Graph v1 稳定。
3. Context Manifest v1 稳定。
4. ExecutionRun v1 稳定。
5. Workspace API v1 内部稳定。
6. Phase 2 不允许通过“直接改 Phase 1 表”增加功能，必须走稳定 Application/Protocol seam。

---

# 5. 第二阶段：Complex Task Workspace

## 阶段目标

从“复杂对话管理”升级成“复杂任务 Workspace”。

关键新增：

```text
Goal
Task
Workstream
Dependency
Assignment
Executor
RunGroup
Handoff
Decision
Knowledge
Artifact
Execution
Multi-view Graph
Adaptive Model Routing
Agent / CLI federation
Multi-Agent Coordination
Internal Extension Runtime
```

这一阶段仍不开放任意代码插件市场。

---

## M2.0 — Architecture Convergence & Telemetry

### 目标

基于 Phase 1 真实代码和 M7/M8 数据，确认 Rhiza Kernel v1 的真实边界。

### 验收标准

1. 输出 Kernel ADR v1。
2. 固化 Scope / Capability / Event / Context / Execution internal contract。
3. 对 Phase 1 暴露的跨模块耦合全部分类。
4. 不存在新增功能绕过 contract。
5. 建立 workspace-scale benchmark。

---

## M2.1 — Universal Resource / Artifact / Knowledge

### 目标

把 Context 的来源从 message 扩展为通用 Resource。

### 支持对象

```text
document
file
note
web capture
paper metadata
artifact
structured entity
external reference
```

### 验收标准

1. Resource 有 version + hash + provenance。
2. Artifact 可被 Conversation、Task、Execution 引用。
3. Context Contributor 不关心 Resource 的具体存储实现。
4. Resource permission 与 Workspace scope 一致。
5. Resource 删除、更新、版本变化有事件。

---

## M2.2 — Goal / Task / Workstream / Dependency

### 目标

让用户管理“要完成什么”，而不仅是“聊过什么”。

### 核心模型

```text
Goal
  └─ Task
      └─ TaskPlan
          └─ Workstream
              ├─ Dependency
              ├─ Assignment
              ├─ ExecutionRun
              ├─ Conversation
              └─ Artifact
```

### 验收标准

1. Task 可以关联 Conversation，而不是依赖 Conversation 存在。
2. Task 可以由 Human 或 Agent 执行。
3. Dependency 可表达 blocked_by / depends_on。
4. Task 状态变化进入 Event Journal。
5. TaskPlan 必须版本化，重新规划不覆盖旧 revision。
6. Workstream 可以声明可并行或依赖关系。
7. Graph 可投影 Task View。
8. Conversation 可从 Task 开启，并自动获得 scoped context。

---

## M2.3 — Context Planner v2 + Workspace Context Start

### 目标

解决长对话/复杂 Workspace 的注意力问题。

### 新能力

新对话开始前支持：

```text
User description / keyword
      ↓
Context Planner
      ↓
Suggested Context Set
      ↓
User review / Auto mode
      ↓
Conversation
```

增加：

```text
Workspace memory
Task context
Decision context
Resource context
Graph-neighbor context
```

### 验收标准

1. 用户可在开始 Conversation 前审视上下文。
2. Auto mode 可解释选择理由。
3. Planner 有 token budget 与 conflict strategy。
4. Planner 不默认把全部 Workspace Memory 注入模型。
5. Context choice 可被记录、比较和 replay。
6. 用户可固定 / 排除某类 Context Contributor。

---

## M2.4 — Multi-view Work Graph

### 目标

同一 Workspace 支持多种工作理解方式。

### View

```text
Conversation
Task
Knowledge
Decision
Execution
Impact (基础)
```

### 验收标准

1. View 使用同一底层 object/edge。
2. 用户可从一个 View 定位同一对象在另一 View 中的位置。
3. Cluster 结果不覆盖 raw relation。
4. 搜索可跨对象类型。
5. Graph 可以折叠高密度区域。

---

## M2.5 — Adaptive Model Routing v1

### 目标

让用户配置一个 AI Pool，并让 Rhiza 在不牺牲可解释性与用户控制权的前提下，根据任务属性和真实运行数据选择合适的 Endpoint。

第一版优先解决：

```text
task type
context size
required modality
tool requirement
quality preference
cost budget
latency preference
provider availability
```

不在 v1 中追求复杂在线学习。

### 核心对象

```text
ModelSpec
ProviderEndpoint
RoutingPolicy
RoutingDecision
CapabilityObservation
ObservedCapabilityProfile
```

### Router v1

```text
Task
  ↓
Task Classifier
  ↓
Hard Constraints
  ↓
Candidate Endpoints
  ↓
Nominal Capability
+ Observed Runtime Metrics
+ User Policy
  ↓
Pareto Candidate Set
  ↓
Route Decision
  ↓
ExecutionRun
```

支持用户模式：

```text
Manual
Pinned per workspace/task type
Policy-based
Adaptive v1
```

### 验收标准

1. 同一模型的不同 Endpoint 拥有独立 identity、telemetry 和 score。
2. 每次自动路由都生成不可变 `RoutingDecision`。
3. 用户可以看到“为什么选择这个 Endpoint”。
4. 用户可以 pin 某模型/Endpoint，也可以禁用自动路由。
5. 低样本 Endpoint 必须显示低置信度，不可产生伪精确评分。
6. 至少区分 reasoning / coding / long_context / tool_use / structured_output / latency / availability / cost_efficiency。
7. Router 可以同时考虑质量、成本、延迟与可靠性，而非只优化一个总分。
8. 自动 fallback 必须留下事件和原因。
9. 评分数据只使用用户授权的数据与 Rhiza 可观察到的运行结果。
10. 不允许根据行为指纹断言隐藏模型的具体身份。

---

## M2.6 — Execution Federation v1

### 目标

把“执行”从 LLM call 扩展到 Tool / CLI / External Agent 的统一入口。

### 第一批 Provider

```text
LLM provider
MCP/tool provider
local CLI provider (有限)
external agent provider (实验性)
```

### 验收标准

1. Provider 可以声明 capabilities。
2. Provider 只能获得 scoped Task Packet。
3. Provider 不能直接访问未授权 Workspace 数据。
4. Run state 统一。
5. Artifact / result 能回流 Rhiza。
6. Provider 故障不会破坏 Workspace state。
7. Provider adapter 可独立安装/替换。
8. LLM Provider 与 Agent Provider 共享 Execution Contract，但只有 LLM 路径进入 Model Router。
9. Provider 声明是否支持 pause / resume / cancel / event streaming / workspace binding。
10. 同一个 Provider 可注册多个 ExecutorProfile，例如多个 CLI session 或不同项目绑定。

---

## M2.7 — Multi-Agent Task Coordination v1

### 目标

在同一 Workspace 内支持多个 Human / CLI / Agent 并行承担不同 Workstream，并让 Rhiza 成为统一任务状态与协调来源。

第一版重点解决：多个 CLI 同时运行时，用户能知道谁在做什么、哪些任务阻塞、哪些结果需要交接、哪里出现并行修改冲突，以及下一步该把什么交给谁。

### 核心对象

```text
TaskPlan
Workstream
ExecutorProfile
Assignment
RunGroup
Handoff
ExecutionLease
Checkpoint
Conflict
```

### 调度流程

```text
Task → TaskPlan → Workstream DAG → Executor Matching
     → Assignment → Scoped Task Packet → Parallel ExecutionRun
     → Artifact / Effect / Handoff → Reconcile → Next Plan Revision
```

### Executor Matching v1

支持 Manual assignment、Capability filter、Availability filter、Workspace binding、Concurrency limit、Cost / budget constraint 与 User preference。

Adaptive Model Router 与 Multi-Agent Coordinator 必须保持分层：Coordinator 选择 Executor / Workstream；Model Router 只负责 LLM Endpoint。

### 验收标准

1. 一个 Task 至少可同时存在 3 个 Workstream。
2. 至少两个不同 Executor 可并行运行。
3. 每个 Workstream 有独立 Assignment、Context、Permission、Expected Output 与验收标准。
4. Executor 可以重新分配而不修改 Task identity。
5. Assignment 取消或失败不会覆盖其他 Workstream 状态。
6. RunGroup 可汇总多 Run 的状态、成本、时间和结果。
7. Handoff 可携带 artifact / decision / unresolved question / risk，并有 provenance。
8. 能检测两个并行 Run 对同一受管 Resource 的潜在写冲突。
9. 用户可以 pause / cancel 单个 Assignment，而不停止整个 Task。
10. 支持 Manual / Assisted；Orchestrated 留到 Phase 3。
11. Task Graph 能按 Executor 形成 swimlane / cluster。
12. Raw ExecutionRun 仍是事实源，Multi-Agent summary 不得替代底层事件。

## M2.8 — Execution Observability v1

### 目标

解决“Agent 做得太快太多，用户跟不上”的问题。

### Pipeline

```text
Native Trace
  ↓
Trace Adapter
  ↓
Normalized Execution Events
  ↓
Semantic Compression
  ↓
Execution Graph
  ↓
Effect extraction
  ↓
Impact View
```

### 验收标准

1. 原始 trace 永久保留。
2. AI summary 只是 projection。
3. 用户可从 cluster 下钻到原始 event。
4. 至少支持 intent / operation / effect 三层解释。
5. 能识别失败尝试与重试。
6. 能标记资源读写与 artifact 变化。
7. 用户可从 semantic node 回到证据。
8. LLM Execution 能从 Run 下钻到对应 RoutingDecision 与 Endpoint telemetry。
9. 同一 RunGroup 可按 Executor 形成 swimlane，并显示等待、阻塞、handoff、冲突和 checkpoint。
10. 用户可从 Task-level cluster 下钻到具体 Agent Run，再下钻到 raw event。

---

## M2.9 — Internal Extension Runtime v1

### 目标

把 first-party 功能从核心业务代码逐渐迁移为模块化 Extension。

### 能力

```text
Capability registration
Context contributor
Event subscriber
Namespaced storage
UI surface
Lifecycle
```

### 验收标准

1. 至少两个 first-party module 使用 Extension Runtime。
2. Extension enable/disable 作用于 Workspace scope。
3. 卸载不会污染其他 Extension 数据。
4. Extension permission 可查看。
5. Extension lifecycle 可回滚。
6. Kernel 不感知具体 Extension 业务。

---

## M2.10 — Rhiza Protocol / SDK v1 + Desktop Integration

### 目标

正式形成可供外部 Provider 和未来 Extension 使用的稳定内部/开发者协议。

### 内容

```text
Execution Provider API
Executor Registry API
Assignment / RunGroup / Handoff API
Model Endpoint API
Routing Decision / Telemetry API
Extension Manifest
Storage API
Context Contributor API
Event API
UI Surface API
Permission API
```

Desktop 开始支持自动识别本机 CLI，但只做 detection 与 provider registration，不做自开发。

### 验收标准

1. SDK 有版本策略。
2. CLI detection 不依赖具体 provider 业务逻辑。
3. 至少两个不同 CLI provider adapter 可运行。
4. 至少两个不同 LLM Endpoint adapter 能在统一 Model Endpoint contract 下被 Router 使用。
5. API breaking change 有 migration policy。
6. Provider 无法通过 SDK 绕过 Scope / Permission。
7. 第三方 adapter 无权直接修改 ObservedCapabilityProfile，只能提交原始 observation。
8. 第三方 Agent / CLI adapter 无权直接修改 TaskPlan 或 Assignment truth，只能提交状态事件、建议与结果。
9. ExecutorProfile capability 与 workspace binding 可被用户检查和覆盖。

---

## M2.11 — Complex Work Beta

### 目标

验证 Rhiza 是否已经从“Graph Chat”升级为 Complex Task Workspace，同时验证用户是否愿意把多个模型/Endpoint 交给 Rhiza 统一调度。

### 重点验证

```text
Task → Conversation
Task → Agent/Tool
Task → Multiple Executors
Workstream → Assignment / Handoff
Artifact → Context
Execution → Graph
Impact / Conflict → Decision
Task → Adaptive Model Route
```

### Go 条件

真实用户能够在一个连续数周的复杂项目里同时使用 Conversation、Task、Artifact、Context 与至少一种 external execution，而没有退回“把所有东西塞进聊天记录”的行为模式。

对于启用多模型池的用户，还应观察：自动路由是否减少手动换模型、是否保持可解释性，以及用户是否持续保留 Adaptive 模式而非长期关闭。

对于启用多个 CLI / Agent 的用户，还应观察：Rhiza 是否显著减少切终端确认状态、重复询问进度、人工整理依赖与交接、遗漏并行修改冲突等管理成本。

---

# 6. 第三阶段：AI Work Control Plane

## 阶段目标

形成开放、可治理、可观测的 Human–AI Work Control Plane。

关键能力：

```text
External Agent Federation
Multi-Agent Orchestration
Cross-Workspace Coordination
Execution Lease
Permission / Approval
Personal AI Capability Map
Adaptive / Pareto Routing
Route Fingerprint
Semantic Trace
Impact Graph
Extension Development Protocol
Self-extending Workspace
Automation
Plugin ecosystem
```

---

## M3.0 — Public Extension Contract v1

### 目标

把 Internal Extension Runtime 升级为受支持的外部开发接口。

### 验收标准

1. Extension manifest 稳定。
2. Permission model 稳定。
3. Extension storage isolation 稳定。
4. UI extension surface 稳定。
5. 有兼容性测试套件。
6. Extension package 可签名/校验来源。

---

## M3.1 — Extension Development Specification

### 目标

建立 Rhiza 与任何 Coding CLI 之间的标准“开发描述协议”。

### Extension Spec 至少包含

```text
Purpose
Domain Model
Required APIs
Capability Contract
Event Contract
Context Behavior
UI Design
Storage Schema
Permissions
Migration Rules
Acceptance Criteria
Test Scenarios
Target SDK Version
```

### 验收标准

1. Spec 可被人类独立阅读。
2. 同一 Spec 可交给两个不同 coding CLI。
3. CLI 实现差异不影响 Rhiza 验收方式。
4. Spec 可版本化。
5. Spec 与实现 package 可双向追踪。

---

## M3.2 — Dev Provider & CLI Delegation

### 目标

Rhiza 可以发现用户本机开发工具，并将 Extension Project 委托给用户选择的 CLI。

### Provider 示例

```text
Codex CLI
Claude Code
Gemini CLI
Aider
OpenCode
future tools
```

### 验收标准

1. 自动检测存在但不自动授权执行。
2. 用户选择默认 Dev Provider。
3. Rhiza 创建隔离 Extension Project。
4. CLI 只获得 Spec + SDK + project workspace。
5. CLI 完成后返回 package / report。
6. Rhiza 不依赖 CLI 私有 agent loop。

---

## M3.3 — Extension Validation / Install / Upgrade / Rollback

### 目标

开发工具不能给自己发毕业证。

### Validation Pipeline

```text
Schema validation
Contract test
Permission audit
Static checks
Sandbox test
Acceptance scenarios
UI smoke test
Migration test
User approval
Install
```

### 验收标准

1. Validation failure 不可安装。
2. Permission diff 必须展示给用户。
3. Upgrade 支持 migration。
4. Rollback 不丢 Workspace 数据。
5. Uninstall 可 keep / export / delete extension data。
6. Extension crash 不可拖垮 Workspace Runtime。

---

## M3.4 — External Agent Federation v1

### 目标

正式接入 OpenClaw / Hermes 类主动代理或未来类似系统，但不绑定具体产品。

### 核心

```text
ExecutionProvider
TaskSpec
Scoped Context
Execution Lease
Event Stream
Artifact Return
```

### 验收标准

1. Agent 只能执行明确授权 Task。
2. Agent 获得有限 scope。
3. Agent 内部 memory 不自动成为 Workspace truth。
4. Agent 的重要结论作为 candidate knowledge/effect 回流。
5. 用户可 pause / cancel / revoke lease。
6. Agent execution 可完整进入 Observability Pipeline。
7. 外部 Agent 如果内部管理 subagent，Rhiza 不强制接管其内部调度；支持 aggregated trace 与 optional nested trace。
8. 同一个 Agent Provider 可注册多个并行 Executor instance，并受到 concurrency / budget policy 约束。

---

## M3.5 — Delegation / Lease / Approval Policy

### 目标

让 Rhiza 决定自主性的边界，Agent 决定边界内怎么完成任务。

### Execution Lease

```text
goal
task
assignment
run_group
scope
allowed resources
allowed actions
forbidden actions
budget
deadline
approval checkpoints
trigger
expiration
```

### 验收标准

1. Lease 可撤销。
2. 高风险动作必须 checkpoint。
3. Agent 无权扩大自身 permission。
4. Lease expiration 后执行必须停止或重新授权。
5. 所有 approval 留下 Event。

---

## M3.6 — Multi-Agent Orchestration v2

### 目标

从 Phase 2 的 Manual / Assisted 多 Executor 管理升级为受 Policy、Lease 与 Budget 约束的动态协调，并支持跨 Workspace 的复杂 Mission。

Rhiza 不要求固定 Supervisor Agent；Coordination Strategy 可以是 Human-directed、Planner-directed、Supervisor-agent、Peer collaboration、Role pipeline、Map-reduce、Debate / review 或 External swarm passthrough。

策略只能操作标准协议，如 propose/revise plan、match executor、create assignment、request handoff/checkpoint、pause assignment、reconcile effects，不能绕过 Permission / Lease / Event Journal。

### Dynamic Replanning

Workstream failed、New dependency、Artifact changed、Agent blocker、Budget exceeded、Deadline risk、Conflict、Human decision 或 Executor unavailable 都可产生新的 TaskPlan revision。旧计划保留。

### Cross-Workspace Mission

```text
Mission
  id
  objective
  workspace_refs[]
  task_refs[]
  dependencies[]
  checkpoints[]
  policy
```

Mission 不复制 Workspace 数据，只建立引用和授权后的 Context Packet。

### Resource Isolation & Reconciliation

Provider 根据资源类型使用 branch/worktree/sandbox、version/draft、transaction/namespace 或 immutable artifact。Rhiza 只抽象 `resource scope / write lease / effect / conflict / reconciliation status`。

### Budget & Capacity

Coordinator 理解 executor concurrency、token/cost/time budget、deadline、rate limit 与 workspace priority，避免“所有 Agent 一起跑”成为默认策略。

### Human Control

必须允许 pause all、pause one workstream、reassign、change priority、reject plan revision、require checkpoint、take over manually 与 terminate mission。

### 验收标准

1. 同一 Task 可自动调度至少 3 个并行 Executor。
2. 新依赖出现后生成新 TaskPlan revision，历史计划仍可查看。
3. Executor failure 可触发可解释 reassign / retry，不丢失已完成产物。
4. Write conflict 可阻止自动合并，并进入 Human / Reconciliation checkpoint。
5. 至少支持一种代码隔离 Provider 和一种非代码资源隔离 Provider。
6. Coordinator 可在 cost / time / concurrency budget 下选择并行度。
7. 用户能看到为什么 Workstream 被分配给某 Executor。
8. 多 Agent 计划、状态、handoff、effect 和 conflict 全部进入 Work Graph。
9. 一个 Mission 可协调至少两个 Workspace，同时不突破各 Workspace 权限边界。
10. 外部 Agent 的 subagent 可保持 opaque，也可在 adapter 支持时展开。
11. 用户可随时从 Orchestrated 降级为 Assisted / Manual。
12. Coordinator Strategy 可替换，不修改 Task / Assignment / Run 核心模型。

## M3.7 — Personal Capability Model & Route Intelligence v2

### 目标

让 Rhiza 从“规则 + 聚合指标路由”升级为长期学习用户真实 AI 基础设施的个体化能力模型。

最终评分不是静态数字，而是：

```text
Score(
  endpoint,
  model_claim,
  task_type,
  context_size,
  time_window,
  toolset,
  workspace,
  user
)
```

### 核心能力

```text
Hierarchical prior / posterior
Task-conditioned scoring
Confidence calibration
Sample weighting
Time-window modeling
Route Fingerprint
Drift / degradation detection
User preference learning
Pareto frontier
Exploration vs exploitation guardrail
```

能力向量至少支持：

```text
reasoning
coding
long_context
instruction_following
tool_use
structured_output
latency
availability
cost_efficiency
```

每个维度必须带：

```text
score
confidence
sample_count
observation_window
workload_slice
```

### Route Fingerprint

长期观测：

```text
TTFT
latency distribution
token throughput
error classes
retry rate
context degradation indicators
tool-call consistency
cost
provider metadata
```

当特征发生显著漂移时，可以：

```text
lower route weight
require confirmation
fallback to alternative
show degradation warning
```

但产品表达只能是“Endpoint 实际表现异常/退化”，不得声称确定识别了供应商的隐藏模型替换。

### 验收标准

1. 新 Endpoint 可以从低置信度 prior 开始，而不是从零分开始。
2. 随用户真实任务样本增加，posterior 能逐步覆盖 prior。
3. 同一 Endpoint 在不同任务类型上可形成明显不同评分。
4. 同一 Endpoint 在不同 context size / toolset / time window 下可产生不同预测。
5. 所有 UI 分数展示置信度或样本状态。
6. Router 可以生成个人 Pareto frontier，而不是只有单一排行榜。
7. Endpoint 明显退化时能够降低路由权重并解释原因。
8. 用户可查看历史路由变化与评分变化。
9. 用户可以关闭个性化学习、清除本地能力历史或恢复静态 Policy 模式。
10. 模型能力历史属于用户私有 operational data，不应默认成为跨用户共享训练数据。

---

## M3.8 — Advanced Execution Graph + Impact Graph

### 目标

把高密度 Agent trace 压缩成用户可理解的复杂工作结构。

### 关键能力

```text
Hierarchical clustering
Intent extraction
Attempt grouping
Failure / retry grouping
Decision extraction
Dependency extraction
Effect extraction
Risk extraction
Evidence linking
```

### 验收标准

1. 100+ tool event 可压缩为可扫描 semantic graph。
2. 用户可以逐层展开到 raw trace。
3. Impact Node 必须有 evidence。
4. “AI 推断的影响”和“确定发生的修改”明确区分。
5. 多 Agent Run 可聚合到同一 Task Graph。
6. 用户能回答：
   - Agent 做了什么？
   - 为什么？
   - 改变了什么？
   - 有什么风险？
   - 哪里需要我介入？

---

## M3.9 — Self-extending Workspace

### 目标

Rhiza 根据用户工作场景与历史行为发现 Capability Gap，并提出 Extension Proposal。

### 流程

```text
Repeated Workflow
   ↓
Pattern Detection
   ↓
Capability Gap
   ↓
Reuse?
Configure?
Compose?
Declare?
Code?
   ↓
Extension Proposal
   ↓
User approval
   ↓
Extension Spec
   ↓
Dev Provider
   ↓
Validation
   ↓
Workspace install
```

### 验收标准

1. Rhiza 不因一次偶发需求自动创建 Extension。
2. Proposal 必须解释识别出的重复模式。
3. 用户可拒绝并永久忽略某类建议。
4. 优先复用已有 Capability。
5. Code generation 必须是最后一级。
6. Extension 默认 workspace-local。
7. 自动生成 Extension 不能改变 Kernel Policy。

---

## M3.10 — Automation & Long-running Work

### 目标

支持持续复杂任务，而不把 Rhiza 变成另一个自治 Agent。

### 能力

```text
scheduled task
condition watch
agent handoff
recurring research
status checkpoint
human approval
```

### 验收标准

1. Automation 绑定 Task。
2. 每次 run 都进入 Execution/Impact system。
3. 用户可看到未来触发条件。
4. 用户可停止、暂停、修改。
5. Automation 不拥有额外隐式权限。
6. 每次自动执行使用的模型/Endpoint 与路由原因可审计。

---

## M3.11 — Extension Registry / Trust Ecosystem

### 目标

构建第三方能力生态，但把 Trust / Permission / Compatibility 放在增长之前。

### 验收标准

1. Registry 支持 SDK compatibility。
2. 权限声明透明。
3. Extension 可被 workspace-local pin version。
4. 支持 signed package / provenance。
5. 支持安全撤回恶意或破损版本。
6. Marketplace 不成为 Kernel 的强依赖。

---

# 7. M0–M6 现有实现的重新设计建议

## 7.1 总结判断

既然当前目标已明确为长期架构优先，建议现在进行一次**有边界的结构性重构**。

不是推倒产品重写，也不是把未来 Phase 3 全部提前实现。

应该现在重做的是未来越晚迁移成本越高的“语义基础”：

```text
Domain boundary
Identity
Event history
Graph ontology
Context provenance
ExecutionRun
Executor / Assignment seam
Model / Endpoint identity
Execution telemetry
Scope seam
```

应该现在明确预留、但不实现完整平台的是：

```text
Capability Registry
Permission Engine
Adaptive Router
Observed Capability Profile
Executor Registry
Multi-Agent Coordinator
Extension Runtime
External Agent Federation
Execution Observability
Self-extension
```

不应该现在做：

```text
Public plugin marketplace
arbitrary plugin code
full sandbox platform
complete CQRS infrastructure
distributed event bus
multi-agent orchestration engine
Rhiza-native code harness
```

---

## 7.2 为什么现在值得重构

如果继续以 Conversation 为最高层模型，未来至少会发生四次高成本迁移：

第一，加入 Task 时，需要把 Conversation-owned objects 提升为 Workspace-owned objects。

第二，加入 external Agent 时，需要把 LLM-specific call 重新抽象为 ExecutionRun。

第三，加入 Execution Graph 时，需要把旧 Graph 从 conversation-specific schema 改成 universal graph。

第四，加入 Extension Runtime 时，需要补 Scope、Permission、Capability 与 namespaced storage。

这些迁移都涉及主键、外键、历史数据和 UI，越晚成本越高。

现在 M6 虽然已经有真实实现，但尚未形成大规模用户历史数据与第三方生态，是进行语义基础调整的最佳窗口之一。

---

# 7A. v2.3 对 M0–M6 的物理架构增补

本节是对前述 M0–M6 验收标准的追加约束；若与旧标准冲突，以本节为准。

## M0 增补 — Headless Core / Host seam

新增要求：

```text
@rhiza/host-protocol
HostRuntimePort
FakeHostAdapter
```

验收：

1. Domain/Application 不依赖 Electron/Tauri、PTY、child_process、OS credential API。
2. Core test suite 可完全 headless 运行。
3. 使用 fake Windows/macOS/Linux capability descriptor 能执行同一业务用例。
4. Desktop-specific code 仅存在于 Client/Host Adapter。

## M1 增补 — Domain Event ≠ Trace

验收：

1. `workspace_events` 只接受 Domain Event。
2. token chunk、stdout chunk、file-read trace 不进入 Domain Event Journal。
3. Domain Event 与 current state 仍保持事务一致。
4. Trace/Stream schema 从第一天拥有独立 contract，即使 Phase 1 暂时共用同一数据库实例。

## M2 增补 — Incremental Graph

验收：

1. Graph API 支持 neighborhood / depth-limited 查询。
2. UI 使用 progressive disclosure。
3. Projection corruption 可通过 durable facts 重建。
4. Graph layout / semantic cluster 不阻塞 Domain write。
5. 增加 10k Node / 50k Edge benchmark。

## M3 增补 — TraceSink / StreamSink

ExecutionRun 增加：

```text
executor_ref
assignment_ref
run_group_ref
parent_run_ref
```

同时建立：

```text
ExecutionTraceSink
TransientStreamSink
```

验收：

1. Trace ingestion API 支持 batch。
2. Live token/stdout 不要求逐 chunk 永久持久化。
3. Run lifecycle Domain Event 与 raw trace 分开写入。
4. 模拟 10,000 条 trace 时，不产生 10,000 个 Domain Event 主事务。

## M4 增补 — Materialized Context

验收：

1. Resource token count/hash 等元信息可复用。
2. 常规 Planner 请求不扫描整个 Workspace。
3. Cache invalidation 由 Resource version/hash 驱动。
4. Context Manifest 仍是不可变的执行证据。

## M5 增补 — Portable Provenance

验收：

1. Provenance 引用 canonical Resource ID。
2. Replay 不依赖原机器绝对文件路径。
3. Bundle import 后历史 Manifest / Run / Node relation 仍可解析。

## M6 增补 — Physical Architecture Compatibility Audit

除已有 Task、Router、Multi-Agent、Extension spike 外，再增加：

```text
Trace Flood Spike
10,000 raw trace / run

Host Adapter Spike
fake Windows/macOS/Linux

Portable Bundle Spike
export → clean store → import

Large Graph Spike
10k nodes / 50k edges / neighborhood fetch
```

验收：

1. 高频 Trace 压测期间 Chat/Task/Graph 基础查询不发生数量级延迟恶化。
2. Domain Event 数量与业务语义动作相关，而不是与 raw trace 数量线性相关。
3. Core 可以在无 Desktop UI 环境启动和测试。
4. Portable Bundle round-trip 后 logical identity / provenance / graph/context refs 保持一致。
5. Resource identity 不依赖 path separator 或数据库 row id。

# 8. M0–M6 详细迁移步骤

## Step A — Freeze & Characterize

1. 给当前 M6 打不可变 tag。
2. 生成数据库 schema snapshot。
3. 为以下用户路径建立 characterization tests：
   - create project
   - chat
   - branch
   - edit & resend
   - regenerate
   - context select
   - graph navigate
4. 记录当前主要 API contract。
5. 收集代表性真实 Workspace fixture。
6. 重构期间禁止无关功能开发。

### Exit

任何重构版本必须通过当前功能行为基线。

---

## Step B — Introduce New Domain IDs & Scope

1. 为 Workspace / Object / Run 引入 Rhiza-owned ID。
2. 旧 LibreChat ID 变为 external_ref。
3. 给所有核心对象补 workspace_id。
4. 引入 actor_ref。
5. 引入最小 scope enum。
6. 写 backfill migration。
7. 在 compatibility layer 中保持旧 API 可运行。

### Exit

业务逻辑不再依赖 LibreChat ID 作为 identity。

---

## Step C — Add Event Journal in Shadow Mode

1. 建立 `workspace_events`。
2. 为现有 write paths 增加 event emission。
3. 先 dual-write，不切 read path。
4. 对比 current state 与 event history。
5. 修复缺失 provenance。
6. 回填历史 event。
7. 建立 event schema version。

### Exit

连续真实操作中不再出现“状态变化但没有 event”的关键路径。

---

## Step D — Refactor Runtime into ExecutionRun

1. 创建 ExecutionRun model，并预留 `assignment_ref`、`run_group_ref`、`parent_run_ref`。
2. 建立最小 `ExecutorProfile` identity；当前 direct LLM 先作为一种 Executor。
3. 建立 `ModelSpec` 与 `ProviderEndpoint` identity；旧 provider/model string 进入 external metadata。
3. 包裹现有 RuntimeAdapter。
4. 每次模型调用先创建 Run。
5. Run 保存实际 Endpoint、声明模型与 runtime snapshot。
6. Context Manifest 关联 Run。
7. 输出 message 关联 Run。
8. Regenerate 改为创建新 Run。
9. 增加 run.started / completed / failed / cancelled event。
10. 采集可得的 TTFT、总延迟、token usage、error/retry、provider metadata 与成本数据。
11. 用户显式评价、验收结果、工具成功率等结果信号可关联 Run，但当前不实现评分器。

### Exit

所有 AI 生成均可被 run_id 唯一追踪。

---

## Step E — Rebuild Graph as Projection

1. 保留旧 Graph UI。
2. 新建 universal GraphNode / GraphEdge。
3. 写 adapter 从现有 Conversation 数据生成 projection。
4. UI 在 feature flag 下读取新 Graph。
5. 进行 old/new graph diff。
6. 修复 branch semantics。
7. 切换主 read path。
8. 旧 graph table 进入 deprecated。

### Exit

UI 行为一致，但 schema 已可容纳 Task / Artifact / Execution。

---

## Step F — Refactor Context Pipeline

1. 抽 ResourceRef。
2. 抽 ContextCandidate。
3. 现有 explicit selection 变为 contributor。
4. 建 Basic Planner interface。
5. 建 Compiler。
6. 强制 Immutable Manifest。
7. Manifest 保存 source version/hash。
8. Replay 使用历史 Manifest。
9. UI 提供“为什么带入”解释。

### Exit

Prompt compilation 不再与 UI selection 绑定。

---

## Step G — Close Legacy Writes

1. 在日志中记录所有 legacy write。
2. 建 CI/Runtime assertion。
3. 一个模块一个模块迁移。
4. staging 零 legacy write 后切 production。
5. 保留一个版本 rollback migration。
6. 清理无 provenance legacy path。

### Exit

Domain 写操作全部通过 Application + Event boundary。

---

## Step H — Architecture Compatibility Spikes

在重新宣布 M6 完成之前，必须实现五个非生产 spike：

### Spike 1：Task

创建：

```text
Task
depends_on
Conversation
Artifact
```

验证无需更改 Work Graph 核心 schema。

### Spike 2：External Agent Run

模拟一个 Agent：

```text
TaskSpec
→ 20 ExecutionEvents
→ Artifact
→ Effect
```

验证无需改变 ExecutionRun 核心 identity 和 event model。

### Spike 3：Extension

写一个 mock Extension manifest：

```text
context contributor
event subscriber
namespaced storage
ui panel
```

验证 Scope、Resource、Event 的边界足够。

### Spike 4：Adaptive Model Router

模拟用户配置：

```text
Model A / Official Endpoint
Model A / Third-party Endpoint
Model B / Endpoint
```

为每个 Endpoint 写入独立 Execution telemetry，并模拟：

```text
Task Classification
→ Candidate Filtering
→ RoutingDecision
→ ExecutionRun
→ CapabilityObservation
```

验证：

1. 同名模型不共享 Endpoint score。
2. RoutingDecision 不需要修改 ExecutionRun 核心 schema。
3. 未来增加 capability dimension 不需要修改 Kernel Event 语义。
4. Router 可以完全关闭并回退到 manual/pinned 模式。

### Spike 5：Multi-Agent Coordination

模拟 `Task → Workstream A / B 并行 → Workstream C 等待 A+B`，其中 A 由 CLI Executor 执行、B 由 External Agent 执行。A/B 各自拥有独立 Context Manifest 与 ExecutionRun，共享 RunGroup，并分别向 C 产生 Handoff；同时模拟二者对同一 Resource 的潜在 Effect conflict。

验证：

1. 不修改 Event / Graph / ExecutionRun 核心语义即可增加 Assignment / RunGroup。
2. 两个 Executor 的 raw trace 可独立保存并在 Task View 聚合。
3. Handoff 只传 scoped artifact/context，而不是复制整个 Workspace。
4. Resource conflict 可通过 Effect / Conflict 表达，而非硬编码到 CLI。
5. 用户取消 B 不破坏 A 的历史与 C 的依赖解释。

### Exit

五个 spike 都只能“增加模块”，不能要求修改 Kernel schema 的核心语义。

---

## Step I — Separate Event / Trace / Stream

1. 给现有 event-like 数据标注：domain fact / execution trace / transient stream / telemetry metric。
2. Domain Event 保留在 transactional journal。
3. 新建 TraceSink contract；Phase 1 可先使用同一数据库中的独立表，但逻辑、事务和 retention 必须分离。
4. 新建 TransientStream contract。
5. token/stdout/progress 不再默认进入 workspace_events。
6. Adapter ingestion 改为 batch API。
7. 建立 backpressure / max buffer / flush policy。
8. 建立 retention policy metadata。

### Exit

用 10,000 条模拟 Trace 压测，Domain Event 数量保持与业务动作相关；Workspace 交互查询延迟不随 raw trace 数量等比例增长。

---

## Step J — Headless Core / Host Adapter Extraction

1. 搜索所有 OS-specific import/API：child_process、PTY、filesystem watcher、credential store、process signal、PATH discovery。
2. 抽出 `HostRuntimePort`。
3. Desktop 实现当前平台 Adapter。
4. 增加 FakeHostAdapter。
5. Domain/Application test 全部运行在 FakeHostAdapter 或无 Host 环境。
6. CLI discovery 只输出规范化 descriptor。
7. ExecutionProvider 只消费 descriptor/Host capability。

### Exit

Core test suite 不需要桌面壳或真实 OS CLI；同一业务用例可在 fake Windows/macOS/Linux capability matrix 下运行。

---

## Step K — Portable Resource / Workspace Format

1. 给 Resource 建立平台无关 canonical identity。
2. 绝对路径降级成 origin/location metadata。
3. 明确 content hash / canonicalization version。
4. 设计 `workspace.rhiza` v0 manifest。
5. 实现 objects/events/resources/blob 最小 export。
6. 实现 clean-store import。
7. 建立 schema/version migration hook。
8. 在 PostgreSQL fixture 与 embedded-store fixture 间做 round-trip test。

### Exit

Workspace export/import 后，Resource ID、provenance、ContextManifest 引用、Task/Graph relation 不因 OS path 或数据库 backend 改变。

# 9. 数据与协议版本策略

从这次重构开始，所有长期协议必须版本化：

```text
Event Schema Version
Context Manifest Version
Graph Relation Version
Execution Contract Version
Executor / Assignment Contract Version
RunGroup / Handoff Contract Version
Model Endpoint Contract Version
Routing Decision Schema Version
Capability Observation Schema Version
Trace Schema Version
Host Runtime Contract Version
Portable Workspace Bundle Version
Resource Canonicalization Version
Extension Manifest Version
```

禁止依赖“数据库当前长什么样”作为协议。

Migration 必须是系统能力，而不是临时脚本习惯。

---

# 10. 架构红线

以下行为应当在 CI / Code Review 中直接禁止。

```text
React component directly updates core table
Domain imports LibreChat model
Runtime provider writes Workspace table
Extension writes another extension namespace
Agent expands its own permission
Regenerate overwrites prior answer
Edit overwrites historical source
Context manifest mutates after execution
Graph layout treated as domain truth
AI semantic summary replaces raw execution trace
nominal model name used as the only execution identity
different ProviderEndpoints silently share one capability score
adaptive routing occurs without a persisted RoutingDecision
route degradation is presented as certain hidden-model identification
multi-agent coordinator directly mutates executor-owned runtime state
agents receive the entire Workspace context by default
agent handoff exists only as untracked natural-language messages
parallel executors write overlapping managed resources without lease/conflict tracking
multi-agent summary replaces individual raw ExecutionRun history
a Supervisor Agent becomes a privileged Kernel component
raw Agent trace is written into Domain Event transaction one-by-one
token/stdout chunks are treated as durable domain facts by default
semantic clustering blocks message/task transactional writes
request-time routing scans the full historical run table
Context Planner scans the entire Workspace on every turn
Desktop/OS APIs are imported into Domain/Application
Resource identity is an absolute filesystem path
database dump is the only supported Workspace migration format
Host-specific extension is advertised as portable without capability declaration
```

---

# 11. 有意延后的复杂度

长期架构优先不等于提前实现所有平台能力。

以下内容必须推迟到有真实需求：

```text
Distributed event streaming
Kafka-like infrastructure
Full CQRS for every domain
Arbitrary executable plugins
Custom extension React bundle
Multi-tenant enterprise policy engine
Extension marketplace
Native coding harness
Synthetic model-identification system
Global cross-user model ranking
Autonomous multi-agent scheduler
Cross-device real-time sync conflict engine
```

当前只保证协议 seam 与数据模型不阻塞未来实现。

---

# 12. 阶段 Gate

## Phase 1 → Phase 2

必须满足：

```text
Conversation Graph 已证明有真实价值
Context Control 已证明有真实价值
Event / Graph / Context / Execution contract v1 稳定
ModelSpec / ProviderEndpoint identity 已稳定
ExecutionRun 已预留 Executor / Assignment / RunGroup seam
核心 LLM Run 已积累可用 execution telemetry
核心历史可追溯
Workspace 可承载非 Conversation object
```

## Phase 2 → Phase 3

必须满足：

```text
真实用户使用 Goal / Task / Artifact
至少一种 External Execution 被持续使用
Execution Graph 能提升用户理解
同一 Workspace 的多 Executor 协作已产生真实用户价值
Assignment / Handoff / Conflict 模型经过真实压力
Adaptive Model Routing v1 对多模型用户产生正向价值
RoutingDecision / CapabilityObservation 数据质量可用
Internal Extension Runtime 已稳定
Scope / Permission 已经过真实压力
```

## Phase 3 扩大生态之前

必须满足：

```text
Extension validation 足够强
Rollback 成熟
Permission 可理解
Agent lease 可控制
Impact explanation 有证据链
```

否则不应追求 Marketplace 数量。

---

# 13. 产品北极星

Rhiza 不应该以“Agent 完成了多少任务”作为唯一价值。

更合适的长期北极星问题是：

**用户能否在 AI 工作速度不断提高的情况下，仍然理解、组织、监督并持续推进复杂工作？**

产品每一层分别回答：

```text
Conversation / Branch
我在思考什么？

Context
AI 此刻应该知道什么？

Knowledge / Artifact / Decision
我们已经形成了什么？

Task / Dependency
接下来应该推进什么？

Workstream / Assignment
哪些工作可以并行，应该交给谁？

Execution
谁在做？

Execution Graph
它怎么做的？

Impact Graph
它改变了什么？

Multi-Agent Coordination
多个 Executor 之间如何依赖、交接、冲突和重新分配？

Permission / Lease
它被允许做到什么程度？

Model Router
当前任务应该调用哪条 AI 服务路径，为什么？

AI Capability Map
我手里的这些 Endpoint 实际上分别擅长什么？

Extension
Workspace 还需要长出什么能力？
```

---

# 14. 最终形态

Rhiza 的最终形态不是一个更复杂的 Chat UI，也不是一个全能 Agent。

它更接近：

```text
                RHIZA
     Complex Human–AI Work Runtime

           Control Plane
                +
        Observability Plane
                +
        Context / Memory Layer
                +
      Model Intelligence Layer
                +
      Work Coordination Layer
                +
           Work Graph

                │
      ┌─────────┼──────────┐
      │         │          │
    Human      LLM       Agent
      │          │          │
     CLI    Adaptive Router MCP
      │          │          │
 Multi-Agent Coordinator  Tool
      │          │          │
  Extension  Automation  Future Executor
```

执行工具越强、越快、越自主，Rhiza 的价值越大，因为 Rhiza 不与执行层竞争，而负责让复杂执行保持可理解、可管理、可追溯、可控制。

---

# 15. 当前立即行动顺序

建议从现在开始按以下顺序执行：

```text
1. Freeze 当前 M6
2. 完成 M0 Architecture Reset
3. M1 Event Journal / Identity / Scope
4. M3 ExecutionRun + ModelSpec / ProviderEndpoint + telemetry 抽象
5. M2 Universal Work Graph
6. M4 Context Runtime
7. M5 Replay / Provenance
8. 重做 M6 Productization，并完成 Adaptive Router + Multi-Agent Coordination compatibility spike
9. M7 Closed Beta
10. 根据真实数据进入 Phase 2；多模型用户进入 Adaptive Routing v1，多 CLI / Agent 用户进入 Multi-Agent Coordination v1
```

其中 M2 与 M3 的编号是产品 milestone 编号，不代表代码施工必须严格串行；施工上应优先完成 Identity/Event，再完成 ExecutionRun 和 Graph projection，以降低数据迁移次数。

---

# 15A. 性能与跨平台全局验收基线

这些指标不是最终 SLA，而是 Architecture Gate。

## 主路径

不包含外部 LLM/Agent 等待时，Application command、Domain transaction、Projection lookup、Context metadata lookup、Routing profile lookup 必须分别建立 p50/p95/p99 telemetry。

新增功能如果让基础 command/query 出现数量级退化，视为架构回归。

## Trace Flood

测试：

```text
1 ExecutionRun
10,000 raw trace
stdout/progress burst
semantic worker enabled
```

验收：

```text
Domain Event count ≪ raw trace count
trace ingestion uses batch
main state writes remain responsive
live UI can sample/coalesce
semantic projection may lag without blocking execution
```

## Large Workspace

至少使用：

```text
10k objects
50k graph edges
1k resources
100+ execution runs
```

测试 Graph neighborhood query、Task View、Context candidate lookup、Search 与 Workspace open。禁止通过一次返回全图来“通过”测试。

## Multi-Agent Load

多个并行 Executor 时，Coordinator 消费聚合状态；Trace Store 处理 raw detail；Projection worker 有 bounded concurrency。Agent 数增加不应导致每次 Task transition 扫描全部 trace。

## Platform Matrix

Contract/fake adapter 至少覆盖：

```text
Windows-like
macOS-like
Linux-like
Headless server
```

真实发布平台再增加 integration test。

## Portable Bundle Round-trip

必须验证：

```text
export
→ clean environment
→ import
→ compare identity / provenance / graph / context refs
```

数据库 row id、absolute path、OS separator 不得成为成功导入的前提。

## Extension Portability

每个 Extension 安装前都必须能回答：

```text
Can run here?
Why / why not?
Which Host capability is missing?
Will Workspace data remain portable?
```

# 16. 决策摘要

本战略明确做出以下长期决策：

**第一，Rhiza 的最高层抽象是 Workspace / Complex Work，而不是 Conversation。**

**第二，Graph 是复杂工作的通用 Projection，而不是聊天专属数据结构。**

**第三，关键历史以 append-only Event Journal 保留，current state 只是工作状态或 projection。**

**第四，所有模型和未来 Agent 调用统一走 ExecutionRun 语义。**

**第五，Context 是独立 Runtime，Manifest 不可变且必须可解释、可 replay。**

**第六，Rhiza 不做 Code Harness，Coding CLI 是外部 Dev Provider。**

**第七，Rhiza 不复制主动 Agent，OpenClaw/Hermes 类系统是 Execution Provider。**

**第八，Workspace 可以自扩展，但 Kernel 不能自修改。**

**第九，Rhiza 拥有长期 Task State 与 Permission 边界，Executor 只拥有 scoped execution strategy。**

**第十，自适应模型路由的评分对象是 `ModelSpec × ProviderEndpoint × Task Condition`，而不是模型品牌名。**

**第十一，Rhiza 从 Phase 1 开始记录 Endpoint 真实运行遥测，但 Phase 2 才启用 Adaptive Router，Phase 3 才形成 Personal AI Capability Map 与长期 Route Intelligence。**

**第十二，所有自动路由必须可解释、可审计、可覆盖；Route Fingerprint 可以判断异常退化，但不能冒充隐藏模型身份鉴定。**

**第十三，多 Agent 的稳定抽象是 `TaskPlan + Workstream + Assignment + Executor + Lease + RunGroup + Handoff`，不是 Supervisor Agent 或某个特定框架。**

**第十四，Rhiza 只拥有协调与事实状态；CLI / External Agent 拥有自身执行策略。外部 Agent 的内部 subagent 可以保持 opaque。**

**第十五，多 Agent 默认采用 scoped context、scoped permission 与可审计 handoff；并行写影响必须进入 Effect / Conflict / Reconciliation 体系。**

**第十六，Multi-Agent Coordinator 与 Adaptive Model Router 是不同层级：前者选择 Executor / Workstream，后者在 LLM 路径中选择 ModelSpec × ProviderEndpoint。**

**第十七，长期产品壁垒是统一的 Complex Work Model + Work Graph + Context + Multi-Agent Coordination + Execution Observability + Personal AI Capability Map，而不是单个 AI Feature。**


**第十八，Domain Event、Execution Trace、Transient Stream 是三种不同语义的数据，不得因为形式相似而共享同一事务与保留策略。**

**第十九，Rhiza Core 必须 Headless。Windows/macOS/Linux 的 CLI、PTY、Process、Filesystem、Credential、Sandbox 差异全部属于 Host Runtime Adapter。**

**第二十，Projection、Semantic Analysis、Capability Profile 等派生状态默认异步/增量计算，并且必须可以从 durable facts 重建；不得阻塞用户主交互热路径。**

**第二十一，Workspace 的正式迁移格式是版本化 Portable Workspace Bundle，而不是 PostgreSQL/SQLite dump；Resource identity 必须独立于 OS path。**

**第二十二，Extension 必须明确 Portable / Sandboxed / Host-specific portability class，跨平台能力不能依赖隐式假设。**

这套路线允许今天对 M0–M6 做一次有代价的结构性重构，以换取未来 Task、Agent、Plugin、CLI、Observability、Automation、Adaptive Routing、Multi-Agent Coordination 到来时只增加模块而不再重写根模型。
