import type { ContextMode, ContextStatus, Message, ProviderCatalog, ProviderPreset, ProviderPresetInfo, ProviderStatus, WorkspaceSnapshot } from './types';

export class ApiError extends Error {
  constructor(message: string, readonly code = 'API_ERROR', readonly status = 500) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const payload = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string } } & T;
  if (!response.ok) throw new ApiError(payload.error?.message || `请求失败（${response.status}）`, payload.error?.code, response.status);
  return payload;
}

type RuntimeStreamEvent =
  | { type: 'RUN_START'; requestId: string; manifestId: string; model: string; provider: string }
  | { type: 'CONTENT_DELTA'; requestId: string; delta: string }
  | { type: 'RUN_END'; requestId: string; text: string; model: string; provider: string }
  | { type: 'RUN_ERROR'; requestId: string; code: string; message: string; status: number };

type ChatCommit = { type: 'COMMIT'; userMessage: Message; assistantMessage: Message; manifest: { id: string } };

async function streamMessage(message: string, onEvent: (event: RuntimeStreamEvent) => void): Promise<Omit<ChatCommit, 'type'>> {
  const response = await fetch('/api/chat/stream', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify({ message }) });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string } };
    throw new ApiError(payload.error?.message || `请求失败（${response.status}）`, payload.error?.code, response.status);
  }
  if (!response.body) throw new ApiError('浏览器未收到可读取的 AI 事件流。', 'STREAM_UNAVAILABLE', 502);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let commit: ChatCommit | undefined;
  let streamError: Extract<RuntimeStreamEvent, { type: 'RUN_ERROR' }> | undefined;

  const consumeFrame = (frame: string) => {
    const lines = frame.split(/\r?\n/);
    const eventName = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
    const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data) return;
    let payload: RuntimeStreamEvent | ChatCommit;
    try { payload = JSON.parse(data) as RuntimeStreamEvent | ChatCommit; } catch { return; }
    if (eventName === 'commit' && payload.type === 'COMMIT') commit = payload;
    if (eventName === 'runtime' && payload.type !== 'COMMIT') {
      onEvent(payload);
      if (payload.type === 'RUN_ERROR') streamError = payload;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() || '';
    frames.forEach(consumeFrame);
    if (done) break;
  }
  if (buffer.trim()) consumeFrame(buffer);
  if (streamError) throw new ApiError(streamError.message, streamError.code, streamError.status);
  if (!commit) throw new ApiError('AI 事件流结束前未提交消息。', 'INCOMPLETE_STREAM', 502);
  const { type: _type, ...result } = commit;
  return result;
}

export const api = {
  getWorkspace: () => request<{ workspace: WorkspaceSnapshot; provider: ProviderStatus; providerCatalog: ProviderCatalog }>('/api/workspace'),
  setMode: (mode: ContextMode) => request<{ workspace: WorkspaceSnapshot }>('/api/workspace/mode', { method: 'PATCH', body: JSON.stringify({ mode }) }),
  setContextStatus: (id: string, status: ContextStatus) => request<{ workspace: WorkspaceSnapshot }>(`/api/workspace/context/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  sendMessage: (message: string) => request<{ userMessage: Message; assistantMessage: Message; manifest: { id: string } }>('/api/chat', { method: 'POST', body: JSON.stringify({ message }) }),
  streamMessage,
  createBranch: (input: { title: string; anchorText?: string; sourceMessageId?: string; messages?: Array<Pick<Message, 'kind' | 'text' | 'createdAt'>> }) => request<{ workspace: WorkspaceSnapshot }>('/api/nodes', { method: 'POST', body: JSON.stringify(input) }),
  sendTemporaryMessage: (input: { sourceNodeId: string; anchorText: string; message: string; history: Array<Pick<Message, 'kind' | 'text'>> }) => request<{ userMessage: Message; assistantMessage: Message; model: string }>('/api/temp-chat', { method: 'POST', body: JSON.stringify(input) }),
  activateNode: (id: string) => request<{ workspace: WorkspaceSnapshot }>(`/api/nodes/${encodeURIComponent(id)}/activate`, { method: 'POST' }),
  moveNode: (id: string, x: number, y: number) => request<{ workspace: WorkspaceSnapshot }>(`/api/nodes/${encodeURIComponent(id)}/position`, { method: 'PATCH', body: JSON.stringify({ x, y }) }),
  createGraphNode: (input: { title: string; summary?: string; x: number; y: number }) => request<{ workspace: WorkspaceSnapshot }>('/api/graph/nodes', { method: 'POST', body: JSON.stringify(input) }),
  deleteGraphNode: (id: string) => request<{ workspace: WorkspaceSnapshot }>(`/api/graph/nodes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  createGraphEdge: (input: { source: string; target: string; relation: 'derived-from' | 'references' | 'merged-into'; label: string }) => request<{ workspace: WorkspaceSnapshot }>('/api/graph/edges', { method: 'POST', body: JSON.stringify(input) }),
  deleteGraphEdge: (id: string) => request<{ workspace: WorkspaceSnapshot }>(`/api/graph/edges/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  mergeNode: (id: string, targetNodeId?: string, summary?: string) => request<{ workspace: WorkspaceSnapshot }>(`/api/nodes/${encodeURIComponent(id)}/merge`, { method: 'POST', body: JSON.stringify({ targetNodeId, summary }) }),
  getProviders: () => request<{ catalog: ProviderCatalog; presets: Record<string, ProviderPresetInfo> }>('/api/providers'),
  saveProvider: (input: { id?: string; preset: ProviderPreset; name: string; baseUrl: string; apiKey?: string; allowNoKey: boolean; modelId?: string; displayName?: string }) => {
    const { id, ...body } = input;
    return request<{ catalog: ProviderCatalog }>(id ? `/api/providers/${id}` : '/api/providers', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
  },
  discoverModels: (providerId: string) => request<{ catalog: ProviderCatalog }>(`/api/providers/${providerId}/discover`, { method: 'POST' }),
  updateModel: (modelId: string, changes: { favorite?: boolean; pinned?: boolean }) => request<{ catalog: ProviderCatalog }>(`/api/models/${modelId}`, { method: 'PATCH', body: JSON.stringify(changes) }),
  selectModel: (modelId: string) => request<{ catalog: ProviderCatalog; provider: ProviderStatus }>(`/api/models/${modelId}/select`, { method: 'POST' }),
};
