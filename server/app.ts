import express from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ProviderError } from './ai-provider';
import { collectRuntimeResult, RuntimeExecutionError, type AIRuntime, type ModelInfo, type RuntimeRequest, type RuntimeResult } from './ai-runtime';
import type { ContextManifest, ContextMode, ContextStatus, StoredMessage } from './domain';
import { providerPresets, type ProviderService } from './provider-service';
import { ProviderRuntime } from './provider-runtime';
import type { WorkspaceStore } from './store';

const contextStatuses = new Set<ContextStatus>(['active', 'recommended', 'excluded']);
const contextModes = new Set<ContextMode>(['Auto', 'Assisted', 'Strict']);
const edgeRelations = new Set(['derived-from', 'references', 'merged-into']);

export function createApp(store: WorkspaceStore, provider: ProviderService, serveFrontend = false, runtime: AIRuntime = new ProviderRuntime(provider)) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  const activeRuntimeModel = async (): Promise<ModelInfo> => {
    const model = (await runtime.listModels()).find(item => item.active);
    if (!model) throw new ProviderError('请先在模型设置中选择一个模型。', 503, 'MODEL_NOT_SELECTED');
    return model;
  };

  const activeRuntimeStatus = async () => {
    if (runtime.kind !== 'librechat') return provider.activeStatus();
    const model = await activeRuntimeModel();
    return { configured: true, name: model.provider, model: model.displayName, baseUrl: '' };
  };

  const prepareChatRun = async (prompt: string): Promise<{ manifest: ContextManifest; request: RuntimeRequest; createdAt: string }> => {
    const current = await store.read();
    const activeContext = current.contextItems.filter(item => item.status === 'active');
    const activeNodeId = current.activeNodeId;
    if (!current.discussionNodes.some(node => node.id === activeNodeId)) throw new ProviderError('当前讨论节点不存在。', 404, 'NODE_NOT_FOUND');
    const createdAt = new Date().toISOString();
    const manifestId = randomUUID();
    const requestId = randomUUID();
    const model = await activeRuntimeModel();
    const manifest: ContextManifest = {
      id: manifestId,
      projectId: current.projectId,
      nodeId: activeNodeId,
      requestId,
      createdAt,
      mode: current.mode,
      model: model.model,
      provider: model.provider,
      runtime: runtime.kind || 'provider-adapter',
      contextItemIds: activeContext.map(item => item.id),
      excludedItemIds: current.contextItems.filter(item => item.status === 'excluded').map(item => item.id),
      contextItems: activeContext.map(item => ({ sourceType: 'context-item', sourceId: item.id, role: item.role, selectionMode: item.selectionMode || 'CURRENT', tokenCount: item.tokens, contentVersion: 1 })),
      estimatedTokens: activeContext.reduce((sum, item) => sum + item.tokens, 0),
    };
    return {
      manifest,
      createdAt,
      request: {
        requestId, manifestId, projectId: current.projectId, nodeId: activeNodeId, modelId: model.id,
        prompt, history: current.messages.filter(message => message.nodeId === activeNodeId), contextItems: activeContext, mode: current.mode,
      },
    };
  };

  const commitChatRun = async (run: { manifest: ContextManifest; request: RuntimeRequest; createdAt: string }, completion: RuntimeResult) => {
    const userMessage: StoredMessage = { id: randomUUID(), nodeId: run.request.nodeId, kind: 'user', text: run.request.prompt, createdAt: run.createdAt };
    const assistantMessage: StoredMessage = { id: randomUUID(), nodeId: run.request.nodeId, kind: 'assistant', text: completion.text, createdAt: run.createdAt, manifestId: run.manifest.id };
    await store.update(latest => {
      if (latest.manifests.some(manifest => manifest.requestId === run.request.requestId)) return latest;
      if (!latest.discussionNodes.some(node => node.id === run.request.nodeId)) throw new ProviderError('生成期间讨论节点已被删除，结果未写入。', 409, 'NODE_REMOVED_DURING_RUN');
      return { ...latest, messages: [...latest.messages, userMessage, assistantMessage], manifests: [...latest.manifests, run.manifest] };
    });
    return { userMessage, assistantMessage, manifest: run.manifest };
  };

  const writeSse = (response: express.Response, event: string, payload: unknown) => {
    response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

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
    try { response.json({ ok: true, provider: await activeRuntimeStatus(), runtime: runtime.kind || 'provider-adapter' }); } catch (error) { next(error); }
  });

  app.get('/api/workspace', async (_request, response, next) => {
    try { response.json({ workspace: await store.read(), provider: await activeRuntimeStatus(), providerCatalog: await provider.snapshot() }); } catch (error) { next(error); }
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
    try { response.json({ catalog: await provider.selectModel(request.params.id), provider: await activeRuntimeStatus() }); } catch (error) { next(error); }
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
          return { ...item, status, ...(item.status === 'recommended' && status === 'active' ? { selectionMode: 'AI_RECOMMENDED_ACCEPTED' as const } : {}) };
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

  app.post('/api/graph/nodes', async (request, response, next) => {
    try {
      const title = typeof request.body?.title === 'string' ? request.body.title.trim() : '';
      const summary = typeof request.body?.summary === 'string' ? request.body.summary.trim().slice(0, 500) : '';
      const x = Number(request.body?.x ?? 180);
      const y = Number(request.body?.y ?? 140);
      if (!title || title.length > 120) return response.status(400).json({ error: { code: 'INVALID_NODE_TITLE', message: '节点标题不能为空且不能超过 120 字符。' } });
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 5000 || y > 5000) return response.status(400).json({ error: { code: 'INVALID_POSITION', message: '节点坐标无效。' } });
      const workspace = await store.update(current => {
        const createdAt = new Date().toISOString();
        const node = { id: randomUUID(), title, summary: summary || '尚未补充讨论摘要。', status: 'draft' as const, kind: 'branch' as const, x: Math.round(x), y: Math.round(y), createdAt, updatedAt: createdAt };
        return { ...current, discussionNodes: [...current.discussionNodes, node] };
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
      const model = await activeRuntimeModel();
      const completion = await collectRuntimeResult(runtime, {
        requestId: randomUUID(), manifestId: `temporary:${randomUUID()}`, projectId: current.projectId,
        nodeId: temporaryNodeId, modelId: model.id,
        prompt: `围绕下列选中内容回答临时支线问题。不要偏离锚点：\n\n「${anchorText}」\n\n问题：${prompt}`,
        history, contextItems: activeContext, mode: current.mode,
      });
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

  app.delete('/api/graph/nodes/:id', async (request, response, next) => {
    try {
      const workspace = await store.update(current => {
        const node = current.discussionNodes.find(item => item.id === request.params.id);
        if (!node) throw new ProviderError('讨论节点不存在。', 404, 'NODE_NOT_FOUND');
        if (current.discussionNodes.length <= 1) throw new ProviderError('至少需要保留一个讨论节点。', 409, 'CANNOT_DELETE_LAST_NODE');
        if (current.discussionNodes.some(item => item.sourceNodeId === node.id)) throw new ProviderError('该节点仍有子支线，请先删除子支线。', 409, 'NODE_HAS_CHILDREN');
        const remainingNodes = current.discussionNodes.filter(item => item.id !== node.id);
        const fallback = remainingNodes.find(item => item.id === node.sourceNodeId) || remainingNodes[0];
        const removedManifestIds = new Set(current.messages.filter(message => message.nodeId === node.id && message.manifestId).map(message => message.manifestId));
        const messages = current.messages.filter(message => message.nodeId !== node.id);
        return {
          ...current,
          activeNodeId: current.activeNodeId === node.id ? fallback.id : current.activeNodeId,
          nodeId: current.nodeId === node.id ? fallback.id : current.nodeId,
          messages,
          manifests: current.manifests.filter(manifest => !removedManifestIds.has(manifest.id)),
          discussionNodes: remainingNodes,
          discussionEdges: current.discussionEdges.filter(edge => edge.source !== node.id && edge.target !== node.id),
        };
      });
      response.json({ workspace });
    } catch (error) { next(error); }
  });

  app.post('/api/graph/edges', async (request, response, next) => {
    try {
      const source = typeof request.body?.source === 'string' ? request.body.source : '';
      const target = typeof request.body?.target === 'string' ? request.body.target : '';
      const relation = typeof request.body?.relation === 'string' ? request.body.relation : 'references';
      const label = typeof request.body?.label === 'string' ? request.body.label.trim().slice(0, 120) : '';
      if (!source || !target || source === target || !edgeRelations.has(relation)) return response.status(400).json({ error: { code: 'INVALID_EDGE', message: '关系必须连接两个不同的节点，并使用有效关系类型。' } });
      if (!label) return response.status(400).json({ error: { code: 'INVALID_EDGE_LABEL', message: '关系标签不能为空。' } });
      const workspace = await store.update(current => {
        if (!current.discussionNodes.some(node => node.id === source) || !current.discussionNodes.some(node => node.id === target)) throw new ProviderError('关系节点不存在。', 404, 'NODE_NOT_FOUND');
        if (current.discussionEdges.some(edge => edge.source === source && edge.target === target && edge.relation === relation)) throw new ProviderError('相同关系已经存在。', 409, 'EDGE_ALREADY_EXISTS');
        const createdAt = new Date().toISOString();
        const edge = { id: randomUUID(), source, target, relation: relation as 'derived-from' | 'references' | 'merged-into', label, createdAt };
        return { ...current, discussionEdges: [...current.discussionEdges, edge] };
      });
      response.status(201).json({ workspace });
    } catch (error) { next(error); }
  });

  app.delete('/api/graph/edges/:id', async (request, response, next) => {
    try {
      let found = false;
      const workspace = await store.update(current => ({ ...current, discussionEdges: current.discussionEdges.filter(edge => {
        if (edge.id !== request.params.id) return true;
        found = true;
        return false;
      }) }));
      if (!found) return response.status(404).json({ error: { code: 'EDGE_NOT_FOUND', message: '关系不存在。' } });
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

  app.post('/api/chat/stream', async (request, response, next) => {
    try {
      const prompt = typeof request.body?.message === 'string' ? request.body.message.trim() : '';
      if (!prompt || prompt.length > 20_000) return response.status(400).json({ error: { code: 'INVALID_MESSAGE', message: '消息不能为空且不能超过 20,000 字符。' } });
      const run = await prepareChatRun(prompt);
      response.status(200);
      response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      response.setHeader('Cache-Control', 'no-cache, no-transform');
      response.setHeader('Connection', 'keep-alive');
      response.setHeader('X-Accel-Buffering', 'no');
      response.flushHeaders();

      for await (const event of runtime.generate(run.request)) {
        writeSse(response, 'runtime', event);
        if (event.type === 'RUN_ERROR') { response.end(); return; }
        if (event.type === 'RUN_END') {
          const committed = await commitChatRun(run, { text: event.text, model: event.model, provider: event.provider });
          writeSse(response, 'commit', { type: 'COMMIT', ...committed });
          response.end();
          return;
        }
      }
      writeSse(response, 'runtime', { type: 'RUN_ERROR', requestId: run.request.requestId, code: 'INCOMPLETE_RUNTIME_STREAM', message: 'AI Runtime 未返回结束事件。', status: 502 });
      response.end();
    } catch (error) {
      if (!response.headersSent) return next(error);
      const runtimeError = error instanceof ProviderError || error instanceof RuntimeExecutionError
        ? error
        : new RuntimeExecutionError(error instanceof Error ? error.message : 'AI Runtime 流式执行失败。');
      writeSse(response, 'runtime', { type: 'RUN_ERROR', requestId: response.getHeader('X-Request-Id'), code: runtimeError.code, message: runtimeError.message, status: runtimeError.status });
      response.end();
    }
  });

  app.post('/api/chat', async (request, response, next) => {
    try {
      const prompt = typeof request.body?.message === 'string' ? request.body.message.trim() : '';
      if (!prompt || prompt.length > 20_000) return response.status(400).json({ error: { code: 'INVALID_MESSAGE', message: '消息不能为空且不能超过 20,000 字符。' } });
      const run = await prepareChatRun(prompt);
      const completion = await collectRuntimeResult(runtime, run.request);
      response.status(201).json(await commitChatRun(run, completion));
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
    if (error instanceof ProviderError || error instanceof RuntimeExecutionError) return response.status(error.status).json({ error: { code: error.code, message: error.message } });
    console.error('[api] unhandled request error', error instanceof Error ? error.message : error);
    response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '服务器处理请求时发生错误。' } });
  });

  return app;
}
