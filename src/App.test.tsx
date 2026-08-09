import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';
import { initialContext } from './data';

const mocks = vi.hoisted(() => ({
  getWorkspace: vi.fn(),
  setMode: vi.fn(),
  setContextStatus: vi.fn(),
  sendMessage: vi.fn(),
  streamMessage: vi.fn(),
  getProviders: vi.fn(),
  saveProvider: vi.fn(),
  discoverModels: vi.fn(),
  updateModel: vi.fn(),
  selectModel: vi.fn(),
  createBranch: vi.fn(), activateNode: vi.fn(), moveNode: vi.fn(), mergeNode: vi.fn(),
  sendTemporaryMessage: vi.fn(),
}));

vi.mock('./api', () => ({ api: mocks }));

const workspace = {
  projectId: 'rhiza-product-research', nodeId: 'information-architecture', mode: 'Assisted' as const,
  contextItems: initialContext,
  messages: [
    { id: 'm1', nodeId: 'information-architecture', kind: 'user' as const, text: '原始问题', createdAt: '2026-08-09T12:00:00.000Z' },
    { id: 'm2', nodeId: 'information-architecture', kind: 'assistant' as const, text: '原始回答', createdAt: '2026-08-09T12:00:01.000Z' },
  ],
  discussionNodes: [{ id: 'information-architecture', title: '信息架构方向', summary: '首屏结构探索', status: 'active' as const, kind: 'main' as const, x: 350, y: 150, createdAt: '', updatedAt: '' }],
  discussionEdges: [], activeNodeId: 'information-architecture',
  manifests: [], updatedAt: '2026-08-09T12:00:01.000Z',
};
const providerCatalog = {
  providers: [{ id: 'p1', preset: 'custom', name: 'Test Provider', baseUrl: 'https://example.test/v1', chatPath: '/chat/completions', allowNoKey: false, hasApiKey: true, configured: true, createdAt: '', updatedAt: '' }],
  models: [{ id: 'model-1', providerId: 'p1', modelId: 'test-model', displayName: 'test-model', favorite: false, pinned: false, createdAt: '' }],
  activeModelId: 'model-1',
};
const presets = { openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', allowNoKey: false } };

beforeEach(() => {
  mocks.getWorkspace.mockResolvedValue({ workspace, provider: { configured: true, name: 'Test Provider', model: 'test-model', baseUrl: 'https://example.test/v1' }, providerCatalog });
  mocks.getProviders.mockResolvedValue({ catalog: providerCatalog, presets });
  mocks.saveProvider.mockResolvedValue({ catalog: providerCatalog });
  mocks.discoverModels.mockResolvedValue({ catalog: providerCatalog });
  mocks.updateModel.mockResolvedValue({ catalog: { ...providerCatalog, models: [{ ...providerCatalog.models[0], favorite: true }] } });
  mocks.selectModel.mockResolvedValue({ catalog: providerCatalog, provider: { configured: true, name: 'Test Provider', model: 'test-model', baseUrl: 'https://example.test/v1' } });
  mocks.activateNode.mockResolvedValue({ workspace });
  mocks.moveNode.mockResolvedValue({ workspace });
  mocks.mergeNode.mockResolvedValue({ workspace });
  mocks.createBranch.mockResolvedValue({ workspace: { ...workspace, discussionNodes: [...workspace.discussionNodes, { id: 'branch-1', title: '可用性支线', summary: '原始回答', status: 'active' as const, kind: 'branch' as const, sourceNodeId: 'information-architecture', sourceMessageId: 'm2', anchorText: '原始回答', x: 560, y: 260, createdAt: '', updatedAt: '' }], discussionEdges: [{ id: 'edge-1', source: 'information-architecture', target: 'branch-1', relation: 'derived-from' as const, label: '衍生支线', createdAt: '' }], activeNodeId: 'branch-1' } });
  mocks.sendTemporaryMessage.mockResolvedValue({ userMessage: { id: 'tm1', nodeId: 'temp:information-architecture', kind: 'user', text: '为什么？', createdAt: '2026-08-09T12:02:00.000Z' }, assistantMessage: { id: 'tm2', nodeId: 'temp:information-architecture', kind: 'assistant', text: '临时支线回答', createdAt: '2026-08-09T12:02:01.000Z' }, model: 'test-model' });
  mocks.setMode.mockResolvedValue({ workspace });
  mocks.setContextStatus.mockImplementation(async (id: string, status: string) => ({ workspace: { ...workspace, contextItems: workspace.contextItems.map(item => item.id === id ? { ...item, status } : item) } }));
  mocks.sendMessage.mockResolvedValue({
    userMessage: { id: 'm3', nodeId: 'information-architecture', kind: 'user', text: '验证这个结构', createdAt: '2026-08-09T12:01:00.000Z' },
    assistantMessage: { id: 'm4', nodeId: 'information-architecture', kind: 'assistant', text: '真实 Provider 回答', createdAt: '2026-08-09T12:01:01.000Z', manifestId: 'manifest-1' },
    manifest: { id: 'manifest-1' },
  });
  mocks.streamMessage.mockImplementation(async (_message: string, onEvent: (event: unknown) => void) => {
    onEvent({ type: 'CONTENT_DELTA', requestId: 'request-1', delta: '真实 Provider ' });
    onEvent({ type: 'CONTENT_DELTA', requestId: 'request-1', delta: '回答' });
    return {
      userMessage: { id: 'm3', nodeId: 'information-architecture', kind: 'user', text: '验证这个结构', createdAt: '2026-08-09T12:01:00.000Z' },
      assistantMessage: { id: 'm4', nodeId: 'information-architecture', kind: 'assistant', text: '真实 Provider 回答', createdAt: '2026-08-09T12:01:01.000Z', manifestId: 'manifest-1' },
      manifest: { id: 'manifest-1' },
    };
  });
});

describe('Rhiza MVP', () => {
  it('opens with the focused discussion experience', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: /信息架构方向/ })).toBeInTheDocument();
    expect(screen.getByText('本轮上下文')).toBeInTheDocument();
    expect(screen.getByText('根系')).toBeInTheDocument();
    expect(screen.getByText('Rhiza')).toBeInTheDocument();
    expect(screen.getByText('Recommended · 待确认')).toBeInTheDocument();
    expect(screen.getByText('推荐项不会自动进入模型输入。')).toBeInTheDocument();
  });

  it('moves recommended context into active context', async () => {
    render(<App />);
    expect(screen.getByText('2 项上下文')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '加入' }));
    expect(screen.getByText('3 项上下文')).toBeInTheDocument();
    await waitFor(() => expect(mocks.setContextStatus).toHaveBeenCalledWith('c3', 'active'));
  });

  it('navigates between graph and project state views', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /对话图谱/ }));
    expect(screen.getByRole('heading', { name: '对话图谱' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /知识状态/ }));
    expect(screen.getByRole('heading', { name: '当前有效知识' })).toBeInTheDocument();
  });

  it('submits a new discussion turn through the backend', async () => {
    render(<App />);
    await screen.findByText(/test-model/);
    const input = screen.getByLabelText('输入消息');
    fireEvent.change(input, { target: { value: '验证这个结构' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    expect(screen.getByText('验证这个结构')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('真实 Provider 回答')).toBeInTheDocument());
    expect(mocks.streamMessage).toHaveBeenCalledWith('验证这个结构', expect.any(Function));
  });

  it('opens provider settings and favorites a model', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '模型与 API 设置' }));
    expect(await screen.findByRole('dialog', { name: '模型与 API' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '收藏 test-model' }));
    await waitFor(() => expect(mocks.updateModel).toHaveBeenCalledWith('model-1', { favorite: true }));
  });

  it('keeps a temporary side conversation as a formal branch only on demand', async () => {
    render(<App />);
    await screen.findByText('原始回答');
    fireEvent.click(screen.getByRole('button', { name: '讨论整个段落' }));
    expect(screen.getByLabelText('临时支线')).toBeInTheDocument();
    expect(mocks.createBranch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('临时支线消息'), { target: { value: '为什么？' } });
    fireEvent.click(screen.getByRole('button', { name: '发送临时消息' }));
    expect(await screen.findByText('临时支线回答')).toBeInTheDocument();
    const title = screen.getByLabelText('临时支线标题');
    fireEvent.change(title, { target: { value: '可用性支线' } });
    fireEvent.click(screen.getByRole('button', { name: '保留为讨论流' }));
    await waitFor(() => expect(mocks.createBranch).toHaveBeenCalledWith({ title: '可用性支线', anchorText: '原始回答', sourceMessageId: 'm2', messages: [{ kind: 'user', text: '为什么？', createdAt: '2026-08-09T12:02:00.000Z' }, { kind: 'assistant', text: '临时支线回答', createdAt: '2026-08-09T12:02:01.000Z' }] }));
  });

  it('compresses navigation for deeply nested discussion nodes', async () => {
    const deepNodes = [workspace.discussionNodes[0], ...Array.from({ length: 4 }, (_, index) => ({ id: `deep-${index + 1}`, title: `深层讨论 ${index + 1}`, summary: '深层探索', status: 'active' as const, kind: 'branch' as const, sourceNodeId: index === 0 ? 'information-architecture' : `deep-${index}`, x: 400 + index * 50, y: 180 + index * 40, createdAt: `2026-08-09T12:0${index}:00.000Z`, updatedAt: '' }))];
    mocks.getWorkspace.mockResolvedValueOnce({ workspace: { ...workspace, discussionNodes: deepNodes, activeNodeId: 'deep-4', nodeId: 'deep-4' }, provider: { configured: true, name: 'Test Provider', model: 'test-model', baseUrl: 'https://example.test/v1' }, providerCatalog });
    render(<App />);
    expect(await screen.findByText('当前位置 · L5')).toBeInTheDocument();
    expect(screen.getByText('缩进已压缩，使用路径导航避免深层迷失')).toBeInTheDocument();
    expect(await screen.findByTitle('当前位于第 5 层')).toHaveTextContent('L5');
  });
});
