# 根系 / Rhiza MVP

根系（Rhiza）是一个面向复杂、多轮 AI 工作流的 Context-native 工作空间 MVP。它把 Project、Conversation Graph、Context Manifest 与 Project State 作为产品领域对象，并通过独立的 Provider 边界连接 OpenAI-compatible 第三方模型服务。

> 当前仓库是用于验证 Rhiza 产品交互的轻量 React/Express 实现。运行时选择性复用锁定 LibreChat v0.8.7 对应的数据模型与文件策略，不复制其产品领域。迁移关系及缺口见 [`docs/librechat-migration.md`](docs/librechat-migration.md)。

## 本地运行

```bash
npm install
Copy-Item .env.example .env
npm run dev
```

开发环境网页地址为 `http://127.0.0.1:4173`，后端健康检查为 `http://127.0.0.1:8787/api/health`。

### 在网页中配置第三方 AI

打开左上角“模型与 API 设置”，选择 OpenAI、OpenRouter、DeepSeek、SiliconFlow、Ollama 或自定义供应商，然后填写 Base URL、API Key 和至少一个模型 ID。保存后可以从 `/models` 同步目录、切换当前模型、收藏和置顶模型。

API Key 使用本机生成的 AES-256-GCM 密钥加密后写入 `var/data/providers.json`，加密密钥保存在 `var/data/.provider-key`；两者均不会提交 Git，也不会通过 API 回显。

### 环境变量初始化（可选）

任何提供 `/chat/completions` 兼容接口的服务均可接入：

```env
AI_BASE_URL=https://your-provider.example/v1
AI_API_KEY=your-secret-key
AI_MODEL=your-model-name
AI_PROVIDER_NAME=Your Provider
```

本地 Ollama 等无鉴权服务可使用：

```env
AI_BASE_URL=http://127.0.0.1:11434/v1
AI_API_KEY=
AI_ALLOW_NO_KEY=true
AI_MODEL=qwen3:8b
```

首次启动且模型目录为空时，后端会用 `.env` 初始化一个供应商。之后可直接在网页中管理供应商和模型。

### LibreChat 能力复用

模型仍通过上面的当前 API 配置执行，不需要额外部署 LibreChat。项目固定使用 `librechat-data-provider@0.8.509`，复用 LibreChat 的 Model Spec 校验、endpoint 归一化和文件 MIME/大小策略；Agent Prompt 则沿用其角色化消息顺序，并保留 Rhiza 的 Context Manifest 语义。完整 Agent/MCP 和文件上传处理会在后续基础设施迁移中继续接入。

### 生产式本地运行

```bash
npm run build
npm start
```

默认打开 `http://127.0.0.1:8787`，由同一个进程提供网页与 API。

## 验证

```bash
npm test
npm run build
```

## MVP 能力

- 默认聚焦的节点级讨论流与真实第三方 AI 流式回复
- Assisted / Auto / Strict 上下文模式
- 上下文预算、角色、推荐原因、加入和排除
- Conversation Graph 与冲突状态提示
- 可持久化拖拽的 Conversation Graph，节点点击与讨论流双向联动
- 从任意 AI 回答创建正式支线、独立讨论，并将支线结论选择性合并回主线
- 划线或选择整段回答后，在当前讨论旁打开临时 AI 对话；只有点击“保留”才进入节点树和图谱
- 可折叠的层级讨论节点树、活动路径导航、深层缩进压缩与路径聚焦
- 关系图谱支持画布缩放/平移、节点拖拽，以及节点和语义关系的创建/删除
- AI 输出支持 GFM Markdown、表格、任务列表、代码块、LaTeX/KaTeX 数学公式和 Mermaid 流程图
- Project State 事实、约束、决策和开放问题
- 响应式桌面、窄屏与移动端布局
- 集中式设计令牌，便于后续替换视觉风格
- 对话、上下文模式、Context 状态和 Manifest 的本地持久化
- Provider 超时、未配置、上游错误和非法响应的明确反馈
- 多供应商配置、模型发现、动态模型选择、收藏和置顶
- 稳定 `AIRuntime` / `RuntimeEvent` 边界；对话请求在执行前冻结 Project、Node、Model Profile 与 Context Manifest
- POST SSE 对话通道；浏览器增量渲染回答，只有完整结束后才原子持久化消息与 Manifest
