# RabbitHole MVP

RabbitHole 是一个面向复杂、多轮 AI 工作流的上下文工作空间 MVP。它包含持久化后端、可审计 Context Manifest、多供应商模型目录，以及适配 OpenAI-compatible 第三方模型服务的安全服务端代理。

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

- 默认聚焦的节点级讨论流与真实第三方 AI 回复
- Assisted / Auto / Strict 上下文模式
- 上下文预算、角色、推荐原因、加入和排除
- Discussion Graph 与冲突状态提示
- 可持久化拖拽的 Discussion Graph，节点点击与讨论流双向联动
- 从任意 AI 回答创建正式支线、独立讨论，并将支线结论选择性合并回主线
- 划线或选择整段回答后，在当前讨论旁打开临时 AI 对话；只有点击“保留”才进入节点树和图谱
- 可折叠的层级讨论节点树、活动路径导航、深层缩进压缩与路径聚焦
- Project State 事实、约束、决策和开放问题
- 响应式桌面、窄屏与移动端布局
- 集中式设计令牌，便于后续替换视觉风格
- 对话、上下文模式、Context 状态和 Manifest 的本地持久化
- Provider 超时、未配置、上游错误和非法响应的明确反馈
- 多供应商配置、模型发现、动态模型选择、收藏和置顶
