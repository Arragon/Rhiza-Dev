import express from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ProviderError } from './ai-provider';
import type { ContextMode, ContextStatus } from './domain';
import { providerPresets, type ProviderService } from './provider-service';
import type { WorkspaceStore } from './store';

const contextStatuses = new Set<ContextStatus>(['active', 'recommended', 'excluded']);
const contextModes = new Set<ContextMode>(['Auto', 'Assisted', 'Strict']);

export function createApp(store: WorkspaceStore, provider: ProviderService, serveFrontend = false) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  app.use((request, response, next) => {
    const requestId = randomUUID();
    response.setHeader('X-Request-Id', requestId);
    const startedAt = Date.now();
    response.on('finish', () => {
      console.info(`[api] ${request.method} ${request.path} ${response.statusCode} ${Date.now() - startedAt}ms request=${requestId}`);
    });
    next();
  });

  app.get('/api/health', async (_request, response, next) => {
    try { response.json({ ok: true, provider: await provider.activeStatus() }); } catch (error) { next(error); }
  });

  app.get('/api/workspace', async (_request, response, next) => {
    try { response.json({ workspace: await store.read(), provider: await provider.activeStatus(), providerCatalog: await provider.snapshot() }); } catch (error) { next(error); }
  });

  app.get('/api/providers', async (_request, response, next) => {
    try { response.json({ catalog: await provider.snapshot(), presets: providerPresets }); } catch (error) { next(error); }
  });

  app.post('/api/providers', async (request, response, next) => {
    try { response.status(201).json({ catalog: await provider.saveProvider(request.body) }); } catch (error) { next(error); }
  });

  app.put('/api/providers/:id', async (request, response, next) => {
    try { response.json({ catalog: await provider.saveProvider(request.body, request.params.id) }); } catch (error) { next(error); }
  });

  app.post('/api/providers/:id/discover', async (request, response, next) => {
    try { response.json({ catalog: await provider.discoverModels(request.params.id) }); } catch (error) { next(error); }
  });

  app.patch('/api/models/:id', async (request, response, next) => {
    try { response.json({ catalog: await provider.updateModel(request.params.id, request.body || {}) }); } catch (error) { next(error); }
  });

  app.post('/api/models/:id/select', async (request, response, next) => {
    try { response.json({ catalog: await provider.selectModel(request.params.id), provider: await provider.activeStatus() }); } catch (error) { next(error); }
  });

  app.patch('/api/workspace/mode', async (request, response, next) => {
    try {
      const mode = request.body?.mode as ContextMode;
      if (!contextModes.has(mode)) return response.status(400).json({ error: { code: 'INVALID_MODE', message: '无效的 Context 模式。' } });
      const workspace = await store.update(current => ({ ...current, mode }));
      response.json({ workspace });
    } catch (error) { next(error); }
  });

  app.patch('/api/workspace/context/:id', async (request, response, next) => {
    try {
      const status = request.body?.status as ContextStatus;
      if (!contextStatuses.has(status)) return response.status(400).json({ error: { code: 'INVALID_STATUS', message: '无效的 Context 状态。' } });
      let found = false;
      const workspace = await store.update(current => ({
        ...current,
        contextItems: current.contextItems.map(item => {
          if (item.id !== request.params.id) return item;
          found = true;
          return { ...item, status };
        }),
      }));
      if (!found) return response.status(404).json({ error: { code: 'CONTEXT_NOT_FOUND', message: 'Context 条目不存在。' } });
      response.json({ workspace });
    } catch (error) { next(error); }
  });

  app.post('/api/nodes', async (request, response, next) => {
    try {
      const title = typeof request.body?.title === 'string' ? request.body.title.trim() : '';
      const anchorText = typeof request.body?.anchorText === 'string' ? request.body.anchorText.trim().slice(0, 2000) : '';
      const sourceMessageId = typeof request.body?.sourceMessageId === 'string' ? request.body.sourceMessageId : undefined;
      const draftMessages = Array.isArray(request.body?.messages) ? request.body.messages.slice(0, 40) : [];
      if (!title || title.length > 120) return response.status(400).json({ error: { code: 'INVALID_NODE_TITLE', message: '支线标题不能为空且不能超过 120 字符。' } });
      if (draftMessages.some(message => !message || !['user', 'assistant'].includes(message.kind) || typeof message.text !== 'string' || !message.text.trim() || message.text.length > 20_000)) return response.status(400).json({ error: { code: 'INVALID_BRANCH_MESSAGES', message: '临时支线消息格式无效。' } });
      const workspace = await store.update(current => {
        const source = current.discussionNodes.find(node => node.id === current.activeNodeId);
        if (!source) throw new ProviderError('当前讨论节点不存在。', 404, 'NODE_NOT_FOUND');
        if (sourceMessageId && !current.messages.some(message => message.id === sourceMessageId && message.nodeId === source.id)) throw new ProviderError('支线来源消息不属于当前讨论。', 400, 'INVALID_BRANCH_SOURCE');
        const createdAt = new Date().toISOString();
        const id = randomUUID();
        const node = { id, title, summary: anchorText || `从「${source.title}」派生的正式支线。`, status: 'active' as const, kind: 'branch' as const, sourceNodeId: source.id, sourceMessageId, anchorText, x: Math.min(source.x + 220, 780), y: Math.min(source.y + 105, 360), createdAt, updatedAt: createdAt };
        const edge = { id: randomUUID(), source: source.id, target: id, relation: 'derived-from' as const, label: anchorText ? '从内容锚点派生' : '正式支线', createdAt };
        const preservedMessages = draftMessages.map(message => ({ id: randomUUID(), nodeId: id, kind: message.kind as 'user' | 'assistant', text: message.text.trim(), createdAt: typeof message.createdAt === 'string' ? message.createdAt : createdAt }));
        return { ...current, activeNodeId: id, nodeId: id, messages: [...current.messages, ...preservedMessages], discussionNodes: [...current.discussionNodes.map(item => item.id === source.id ? { ...item, status: 'active' as const } : item), node], discussionEdges: [...current.discussionEdges, edge] };
      });
      response.status(201).json({ workspace });
    } catch (error) { next(error); }
  });

  app.post('/api/temp-chat', async (request, response, next) => {
    try {
      const sourceNodeId = typeof request.body?.sourceNodeId === 'string' ? request.body.sourceNodeId : '';
      const anchorText = typeof request.body?.anchorText === 'string' ? request.body.anchorText.trim().slice(0, 4000) : '';
      const prompt = typeof request.body?.message === 'string' ? request.body.message.trim() : '';
      const draftHistory = Array.isArray(request.body?.history) ? request.body.history.slice(-20) : [];
      if (!sourceNodeId || !anchorText || !prompt || prompt.length > 20_000) return response.status(400).json({ error: { code: 'INVALID_TEMP_CHAT', message: '临时支线需要来源节点、内容锚点和有效问题。' } });
      if (draftHistory.some(message => !message || !['user', 'assistant'].includes(message.kind) || typeof message.text !== 'string' || message.text.length > 20_000)) return response.status(400).json({ error: { code: 'INVALID_TEMP_HISTORY', message: '临时对话历史格式无效。' } });
      const current = await store.read();
      if (!current.discussionNodes.some(node => node.id === sourceNodeId)) return response.status(404).json({ error: { code: 'NODE_NOT_FOUND', message: '来源讨论节点不存在。' } });
      const activeContext = current.contextItems.filter(item => item.status === 'active');
      const sourceHistory = current.messages.filter(message => message.nodeId === sourceNodeId).slice(-8);
      const temporaryNodeId = `temp:${sourceNodeId}`;
      const history = [...sourceHistory, ...draftHistory.map(message => ({ id: randomUUID(), nodeId: temporaryNodeId, kind: message.kind as 'user' | 'assistant', text: message.text, createdAt: new Date().toISOString() }))];
      const completion = await provider.completeActive({ prompt: `围绕下列选中内容回答临时支线问题。不要偏离锚点：\n\n「${anchorText}」\n\n问题：${prompt}`, history, contextItems: activeContext, mode: current.mode });
      const createdAt = new Date().toISOString();
      response.status(201).json({
        userMessage: { id: randomUUID(), nodeId: temporaryNodeId, kind: 'user', text: prompt, createdAt },
        assistantMessage: { id: randomUUID(), nodeId: temporaryNodeId, kind: 'assistant', text: completion.text, createdAt },
        model: completion.model,
      });
    } catch (error) { next(error); }
  });

  app.post('/api/nodes/:id/activate', async (request, response, next) => {
    try {
      const workspace = await store.update(current => {
        if (!current.discussionNodes.some(node => node.id === request.params.id)) throw new ProviderError('讨论节点不存在。', 404, 'NODE_NOT_FOUND');
        return { ...current, activeNodeId: request.params.id, nodeId: request.params.id };
      });
      response.json({ workspace });
    } catch (error) { next(error); }
  });

  app.patch('/api/nodes/:id/position', async (request, response, next) => {
    try {
      const x = Number(request.body?.x); const y = Number(request.body?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 5000 || y > 5000) return response.status(400).json({ error: { code: 'INVALID_POSITION', message: '节点坐标无效。' } });
      let found = false;
      const workspace = await store.update(current => ({ ...current, discussionNodes: current.discussionNodes.map(node => {
        if (node.id !== request.params.id) return node;
        found = true;
        return { ...node, x: Math.round(x), y: Math.round(y), updatedAt: new Date().toISOString() };
      }) }));
      if (!found) return response.status(404).json({ error: { code: 'NODE_NOT_FOUND', message: '讨论节点不存在。' } });
      response.json({ workspace });
    } catch (error) { next(error); }
  });

  app.post('/api/nodes/:id/merge', async (request, response, next) => {
    try {
      const workspace = await store.update(current => {
        const source = current.discussionNodes.find(node => node.id === request.params.id);
        if (!source || source.kind !== 'branch') throw new ProviderError('只有正式支线可以合并。', 400, 'INVALID_MERGE_SOURCE');
        if (source.status === 'resolved') throw new ProviderError('该支线已经合并。', 409, 'BRANCH_ALREADY_MERGED');
        const targetId = typeof request.body?.targetNodeId === 'string' ? request.body.targetNodeId : source.sourceNodeId;
        const target = current.discussionNodes.find(node => node.id === targetId);
        if (!target) throw new ProviderError('合并目标不存在。', 404, 'MERGE_TARGET_NOT_FOUND');
        const lastAnswer = [...current.messages].reverse().find(message => message.nodeId === source.id && message.kind === 'assistant')?.text;
        const summary = typeof request.body?.summary === 'string' && request.body.summary.trim() ? request.body.summary.trim().slice(0, 5000) : lastAnswer || source.summary;
        const createdAt = new Date().toISOString();
        const mergeMessage = { id: randomUUID(), nodeId: target.id, kind: 'assistant' as const, text: `已从支线「${source.title}」合并引用：\n\n${summary}`, createdAt };
        const edge = { id: randomUUID(), source: source.id, target: target.id, relation: 'merged-into' as const, label: '选择性合并', createdAt };
        return { ...current, activeNodeId: target.id, nodeId: target.id, messages: [...current.messages, mergeMessage], discussionNodes: current.discussionNodes.map(node => node.id === source.id ? { ...node, status: 'resolved' as const, updatedAt: createdAt } : node), discussionEdges: [...current.discussionEdges, edge] };
      });
      response.json({ workspace });
    } catch (error) { next(error); }
  });

  app.post('/api/chat', async (request, response, next) => {
    try {
      const prompt = typeof request.body?.message === 'string' ? request.body.message.trim() : '';
      if (!prompt || prompt.length > 20_000) return response.status(400).json({ error: { code: 'INVALID_MESSAGE', message: '消息不能为空且不能超过 20,000 字符。' } });
      const current = await store.read();
      const activeContext = current.contextItems.filter(item => item.status === 'active');
      const activeNodeId = current.activeNodeId;
      const completion = await provider.completeActive({ prompt, history: current.messages.filter(message => message.nodeId === activeNodeId), contextItems: activeContext, mode: current.mode });
      const createdAt = new Date().toISOString();
      const manifestId = randomUUID();
      const userMessage = { id: randomUUID(), nodeId: activeNodeId, kind: 'user' as const, text: prompt, createdAt };
      const assistantMessage = { id: randomUUID(), nodeId: activeNodeId, kind: 'assistant' as const, text: completion.text, createdAt, manifestId };
      const manifest = {
        id: manifestId,
        createdAt,
        mode: current.mode,
        model: completion.model,
        contextItemIds: activeContext.map(item => item.id),
        estimatedTokens: activeContext.reduce((sum, item) => sum + item.tokens, 0),
      };
      await store.update(latest => ({ ...latest, messages: [...latest.messages, userMessage, assistantMessage], manifests: [...latest.manifests, manifest] }));
      response.status(201).json({ userMessage, assistantMessage, manifest });
    } catch (error) { next(error); }
  });

  if (serveFrontend) {
    const distPath = resolve('dist');
    if (existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*path', (_request, response) => response.sendFile(resolve(distPath, 'index.html')));
    }
  }

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof ProviderError) return response.status(error.status).json({ error: { code: error.code, message: error.message } });
    console.error('[api] unhandled request error', error instanceof Error ? error.message : error);
    response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '服务器处理请求时发生错误。' } });
  });

  return app;
}
