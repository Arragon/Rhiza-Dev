# Project Architecture

## 1. Overview

RabbitHole 是基于产品设计书构建的全栈网页端 MVP。它验证“对话网络 + 显式上下文 + 当前知识状态”的核心产品命题，并通过动态 Provider Registry 连接多个 OpenAI-compatible 模型供应商。项目和模型目录以原子 JSON 文件持久化，API Key 使用本机 AES-256-GCM 密钥加密。

## 2. Tech Stack

- React + TypeScript：界面与本地交互状态
- Vite：开发服务器与生产构建
- Express：Workspace、Context 与 Chat API
- OpenAI-compatible Provider：第三方模型适配、超时和错误归一化
- JSON 原子存储：本地持久化消息、Context 状态与 Manifest
- Lucide React：统一图标系统
- Vitest + Testing Library：组件行为测试
- 原生 CSS：设计令牌、响应式布局、动画和轻量点阵效果

## 3. Directory Structure

- `src/App.tsx`：顶层 Workspace 状态、节点激活、Context 与面板控制
- `src/components/`：Chat、Graph、State、Sidebar、Context Inspector 等界面模块
- `src/data.ts`：MVP 演示数据
- `src/types.ts`：核心前端类型
- `src/api.ts`：浏览器 API 客户端与统一错误类型
- `server/app.ts`：HTTP 路由、输入校验与错误边界
- `server/ai-provider.ts`：第三方 AI 协议适配与 Prompt 组装
- `server/provider-service.ts`：多供应商注册、模型发现、选择与调用编排
- `server/provider-store.ts`：供应商和模型目录持久化
- `server/secret-vault.ts`：API Key AES-256-GCM 加密与解密
- `server/store.ts`：串行更新和临时文件原子替换
- `server/config.ts`：安全读取 Provider 环境配置
- `var/data/workspace.json`：运行时持久化文件，不提交 Git
- `var/data/providers.json`：加密供应商配置、模型收藏与置顶状态
- `src/test/`：测试环境初始化
- `app/static/css/tokens.css`：可替换的设计令牌层
- `app/static/css/app.css`：组件和响应式样式层
- `product-design.md`：从原始 Word 设计书提取的工作副本

## 4. Core Modules

- `App` 管理当前主视图、活动讨论节点、节点/边集合、上下文条目状态与窄屏面板状态。
- `ChatView` 按活动节点过滤多轮讨论，使用 Selection API 捕获回答划线内容，并在当前讨论旁打开不落盘的临时支线工作台；用户显式保留后才固化为正式节点。
- `Sidebar` 依据 `sourceNodeId` 构建可折叠节点树，提供活动路径、深度标识和深层路径聚焦。
- `ProviderSettings` 管理供应商连接和模型目录；`ModelSelector` 在调用前选择当前模型。
- `ContextPanel` 显示 Active、Recommended、Excluded Context 和预算。
- `GraphView` 从 Workspace 渲染真实讨论节点与语义边，支持 Pointer Events 拖拽并持久化坐标；点击节点会激活对应讨论流。
- `StateView` 区分当前有效事实、约束、决策与开放问题。

## 5. Frontend Architecture

界面采用桌面三栏结构：左侧项目导航、中间主工作区、右侧 Context Inspector。窄屏下 Inspector 转为抽屉，移动端将主导航转为底部栏。视觉系统分为两层：`tokens.css` 定义色彩、字体、间距倾向、阴影和圆角；`app.css` 只消费这些语义变量。未来换肤应优先替换令牌，必要时再调整组件样式，避免侵入业务组件。

## 6. Backend Architecture

Express 后端暴露以下边界：

- `GET /api/health`：服务与安全裁剪后的 Provider 状态
- `GET /api/workspace`：项目、消息、Context 和 Manifest 快照
- `PATCH /api/workspace/mode`：持久化 Context 控制模式
- `PATCH /api/workspace/context/:id`：持久化 Context 生命周期状态
- `POST /api/chat`：冻结 Active Context、调用 Provider、保存消息与 Manifest
- `POST /api/nodes`：从当前节点或消息锚点创建正式支线和 `derived-from` 关系
- `POST /api/temp-chat`：围绕选中锚点调用 AI；请求与回复不写入 Workspace
- `POST /api/nodes/:id/activate`：切换活动讨论节点
- `PATCH /api/nodes/:id/position`：持久化 Graph 节点坐标
- `POST /api/nodes/:id/merge`：选择性合并支线摘要、写入主线引用并生成 `merged-into` 关系
- `GET/POST/PUT /api/providers`：读取、新增和更新安全裁剪后的供应商配置
- `POST /api/providers/:id/discover`：从兼容 `/models` 接口同步模型
- `PATCH /api/models/:id`：持久化收藏与置顶状态
- `POST /api/models/:id/select`：切换当前模型

`ProviderService` 根据当前 Model Record 找到供应商，临时解密 API Key，再构造 `OpenAiCompatibleProvider` 完成调用。解密后的 Key 不进入 Workspace、日志或 HTTP 响应。模型目录按置顶、收藏和名称排序。

## 7. Data Flow

网页加载时从 `/api/workspace` 恢复持久状态。每条 Message 归属一个 Discussion Node；Sidebar、Chat 与 Graph 共用 `activeNodeId`。临时支线只保存在当前 React 会话，`/api/temp-chat` 会调用模型但不写盘；用户点击保留时，临时消息随 Node 与 `derived-from` Edge 原子写入。Sidebar 从节点的 `sourceNodeId` 计算树、活动路径和深度，不在存储中维护易失真的冗余 depth。合并时只把摘要引用写回来源主线并保留审计关系。

## 8. Testing Strategy

- `npm test`：验证前端 API 接线、Context 持久化、输入校验、Provider 请求格式、未配置错误与 Manifest 写入。
- `npm run build`：执行 TypeScript 严格检查、Vite 前端构建和 tsup 服务端构建。
- 浏览器人工验证：检查三栏布局、移动断点、滚动、抽屉和关键交互。

## 9. Development Conventions

- 组件使用明确的领域命名，避免把 Node 与 Message 混用。
- 视觉变量只能从 `tokens.css` 获取，新增一次性颜色前先扩展语义令牌。
- 图标统一使用 Lucide；品牌点阵为独立 `ParticleMark` 组件。
- 新行为必须覆盖正常交互路径，并保持无障碍名称与键盘焦点可见。

## 10. Known Constraints

- AI 回复已连接真实 Provider；Context Planner 推荐与冲突检测仍为演示数据。
- Graph 已支持节点拖拽与坐标持久化，但尚未实现缩放、框选、自动布局和超大图虚拟化。
- 当前使用本机 JSON 存储，不支持多用户并发、身份认证、权限和跨项目隔离。
- Provider 适配范围是 OpenAI-compatible Chat Completions；非兼容协议需要新增 Adapter。
- 模型自动发现要求供应商实现 OpenAI-compatible `/models`；不支持时可手动添加模型 ID。
- 临时支线不跨刷新恢复，这是当前“未保留即丢弃”的明确产品语义；正式支线与 Graph 布局已持久化，Project State 编辑仍未接入持久化 API。
