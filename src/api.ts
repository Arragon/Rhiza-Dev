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

export const api = {
  getWorkspace: () => request<{ workspace: WorkspaceSnapshot; provider: ProviderStatus; providerCatalog: ProviderCatalog }>('/api/workspace'),
  setMode: (mode: ContextMode) => request<{ workspace: WorkspaceSnapshot }>('/api/workspace/mode', { method: 'PATCH', body: JSON.stringify({ mode }) }),
  setContextStatus: (id: string, status: ContextStatus) => request<{ workspace: WorkspaceSnapshot }>(`/api/workspace/context/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  sendMessage: (message: string) => request<{ userMessage: Message; assistantMessage: Message; manifest: { id: string } }>('/api/chat', { method: 'POST', body: JSON.stringify({ message }) }),
  createBranch: (input: { title: string; anchorText?: string; sourceMessageId?: string; messages?: Array<Pick<Message, 'kind' | 'text' | 'createdAt'>> }) => request<{ workspace: WorkspaceSnapshot }>('/api/nodes', { method: 'POST', body: JSON.stringify(input) }),
  sendTemporaryMessage: (input: { sourceNodeId: string; anchorText: string; message: string; history: Array<Pick<Message, 'kind' | 'text'>> }) => request<{ userMessage: Message; assistantMessage: Message; model: string }>('/api/temp-chat', { method: 'POST', body: JSON.stringify(input) }),
  activateNode: (id: string) => request<{ workspace: WorkspaceSnapshot }>(`/api/nodes/${encodeURIComponent(id)}/activate`, { method: 'POST' }),
  moveNode: (id: string, x: number, y: number) => request<{ workspace: WorkspaceSnapshot }>(`/api/nodes/${encodeURIComponent(id)}/position`, { method: 'PATCH', body: JSON.stringify({ x, y }) }),
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
