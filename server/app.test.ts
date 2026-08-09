// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { ProviderService } from './provider-service';
import { ProviderStore } from './provider-store';
import { SecretVault } from './secret-vault';
import { WorkspaceStore } from './store';

const temporaryDirectories: string[] = [];
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))));

async function testApp() {
  const directory = await mkdtemp(join(tmpdir(), 'rabbithole-'));
  temporaryDirectories.push(directory);
  const store = new WorkspaceStore(join(directory, 'workspace.json'));
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '后端生成的回答' } }] }), { status: 200 })) as unknown as typeof fetch;
  const provider = new ProviderService(new ProviderStore(join(directory, 'providers.json')), new SecretVault(join(directory, '.provider-key')), { baseUrl: 'https://example.test/v1', apiKey: 'test-key', model: 'test-model', providerName: 'Test', chatPath: '/chat/completions', timeoutMs: 1000, temperature: 0.4, extraHeaders: {}, allowNoKey: false }, fetcher);
  return { app: createApp(store, provider), filePath: join(directory, 'workspace.json'), providerPath: join(directory, 'providers.json') };
}

describe('RabbitHole API', () => {
  it('persists context status updates', async () => {
    const { app, filePath } = await testApp();
    await request(app).patch('/api/workspace/context/c3').send({ status: 'active' }).expect(200);
    const persisted = JSON.parse(await readFile(filePath, 'utf8'));
    expect(persisted.contextItems.find((item: { id: string }) => item.id === 'c3').status).toBe('active');
  });

  it('calls the provider and stores messages with a manifest', async () => {
    const { app } = await testApp();
    const response = await request(app).post('/api/chat').send({ message: '生成可执行建议' }).expect(201);
    expect(response.body.assistantMessage.text).toBe('后端生成的回答');
    expect(response.body.manifest.contextItemIds).toEqual(['c1', 'c2']);
    const workspace = await request(app).get('/api/workspace').expect(200);
    expect(workspace.body.workspace.messages).toHaveLength(4);
    expect(workspace.body.workspace.manifests).toHaveLength(1);
  });

  it('validates client input', async () => {
    const { app } = await testApp();
    await request(app).post('/api/chat').send({ message: '   ' }).expect(400);
    await request(app).patch('/api/workspace/mode').send({ mode: 'Unknown' }).expect(400);
  });

  it('stores API keys encrypted and never returns them', async () => {
    const { app, providerPath } = await testApp();
    const response = await request(app).post('/api/providers').send({ preset: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', apiKey: 'secret-plain-key', allowNoKey: false, modelId: 'deepseek-chat' }).expect(201);
    expect(JSON.stringify(response.body)).not.toContain('secret-plain-key');
    expect(await readFile(providerPath, 'utf8')).not.toContain('secret-plain-key');
    expect(response.body.catalog.providers.some((provider: { name: string; hasApiKey: boolean }) => provider.name === 'DeepSeek' && provider.hasApiKey)).toBe(true);
  });

  it('persists model selection, favorite and pin state', async () => {
    const { app } = await testApp();
    const catalog = await request(app).get('/api/providers').expect(200);
    const modelId = catalog.body.catalog.models[0].id;
    await request(app).patch(`/api/models/${modelId}`).send({ favorite: true, pinned: true }).expect(200);
    const selected = await request(app).post(`/api/models/${modelId}/select`).expect(200);
    expect(selected.body.catalog.activeModelId).toBe(modelId);
    expect(selected.body.catalog.models[0]).toMatchObject({ favorite: true, pinned: true });
  });

  it('creates, moves and merges a formal discussion branch', async () => {
    const { app, filePath } = await testApp();
    const created = await request(app).post('/api/nodes').send({ title: '检索策略支线', sourceMessageId: 'm2', anchorText: '验证分层检索策略', messages: [{ kind: 'user', text: '临时问题', createdAt: '2026-08-09T12:00:20.000Z' }, { kind: 'assistant', text: '临时结论', createdAt: '2026-08-09T12:00:21.000Z' }] }).expect(201);
    const branch = created.body.workspace.discussionNodes.find((node: { kind: string }) => node.kind === 'branch');
    expect(branch).toMatchObject({ title: '检索策略支线', sourceNodeId: 'information-architecture', status: 'active' });
    expect(created.body.workspace.discussionEdges[0]).toMatchObject({ source: 'information-architecture', target: branch.id, relation: 'derived-from' });
    expect(created.body.workspace.messages.filter((message: { nodeId: string }) => message.nodeId === branch.id).map((message: { text: string }) => message.text)).toEqual(['临时问题', '临时结论']);

    await request(app).patch(`/api/nodes/${branch.id}/position`).send({ x: 612, y: 286 }).expect(200);
    const merged = await request(app).post(`/api/nodes/${branch.id}/merge`).send({ summary: '采用分层检索并保留来源锚点。' }).expect(200);
    expect(merged.body.workspace.activeNodeId).toBe('information-architecture');
    expect(merged.body.workspace.discussionNodes.find((node: { id: string }) => node.id === branch.id)).toMatchObject({ x: 612, y: 286, status: 'resolved' });
    expect(merged.body.workspace.discussionEdges.some((edge: { relation: string }) => edge.relation === 'merged-into')).toBe(true);
    expect(JSON.parse(await readFile(filePath, 'utf8')).discussionNodes).toHaveLength(2);
  });

  it('creates and deletes graph nodes and semantic edges', async () => {
    const { app } = await testApp();
    const createdNode = await request(app).post('/api/graph/nodes').send({ title: '检索实验', summary: '验证关系图谱编辑能力', x: 620, y: 280 }).expect(201);
    const node = createdNode.body.workspace.discussionNodes.find((item: { title: string }) => item.title === '检索实验');
    expect(node).toMatchObject({ status: 'draft', kind: 'branch', x: 620, y: 280 });
    const createdEdge = await request(app).post('/api/graph/edges').send({ source: 'information-architecture', target: node.id, relation: 'references', label: '实验关联' }).expect(201);
    const edge = createdEdge.body.workspace.discussionEdges[0];
    expect(edge).toMatchObject({ source: 'information-architecture', target: node.id, relation: 'references', label: '实验关联' });
    await request(app).delete(`/api/graph/edges/${edge.id}`).expect(200);
    await request(app).delete(`/api/graph/nodes/${node.id}`).expect(200);
    const workspace = await request(app).get('/api/workspace').expect(200);
    expect(workspace.body.workspace.discussionNodes).toHaveLength(1);
    expect(workspace.body.workspace.discussionEdges).toHaveLength(0);
  });

  it('runs temporary branch chat without persisting workspace state', async () => {
    const { app, filePath } = await testApp();
    await request(app).get('/api/workspace').expect(200);
    const before = await readFile(filePath, 'utf8');
    const response = await request(app).post('/api/temp-chat').send({ sourceNodeId: 'information-architecture', anchorText: '渐进式上下文', message: '为什么适合新用户？', history: [] }).expect(201);
    expect(response.body.assistantMessage).toMatchObject({ kind: 'assistant', text: '后端生成的回答' });
    expect(response.body.assistantMessage.nodeId).toBe('temp:information-architecture');
    expect(await readFile(filePath, 'utf8')).toBe(before);
  });
});
