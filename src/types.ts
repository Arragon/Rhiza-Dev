export type View = 'chat' | 'graph' | 'state';
export type ContextMode = 'Auto' | 'Assisted' | 'Strict';
export type ContextStatus = 'active' | 'recommended' | 'excluded';

export interface ContextItem {
  id: string;
  title: string;
  detail: string;
  role: 'Fact' | 'Constraint' | 'Decision' | 'Reference';
  status: ContextStatus;
  tokens: number;
  reason?: string;
}

export interface Message {
  id: string;
  nodeId: string;
  kind: 'user' | 'assistant';
  text: string;
  createdAt: string;
  manifestId?: string;
  pending?: boolean;
}

export interface TemporaryBranch {
  id: string;
  sourceNodeId: string;
  sourceMessageId: string;
  anchorText: string;
  title: string;
  messages: Message[];
}

export type DiscussionStatus = 'draft' | 'active' | 'resolved' | 'stale' | 'archived';
export type EdgeRelation = 'derived-from' | 'references' | 'merged-into';

export interface DiscussionNode {
  id: string;
  title: string;
  summary: string;
  status: DiscussionStatus;
  kind: 'main' | 'branch';
  sourceNodeId?: string;
  sourceMessageId?: string;
  anchorText?: string;
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiscussionEdge {
  id: string;
  source: string;
  target: string;
  relation: EdgeRelation;
  label: string;
  createdAt: string;
}

export interface ProviderStatus {
  configured: boolean;
  name: string;
  model: string;
  baseUrl: string;
}

export type ProviderPreset = 'openai' | 'openrouter' | 'deepseek' | 'siliconflow' | 'ollama' | 'custom';
export interface SafeProvider {
  id: string; preset: ProviderPreset; name: string; baseUrl: string; chatPath: string;
  allowNoKey: boolean; hasApiKey: boolean; configured: boolean; createdAt: string; updatedAt: string;
}
export interface ModelRecord {
  id: string; providerId: string; modelId: string; displayName: string;
  favorite: boolean; pinned: boolean; createdAt: string;
}
export interface ProviderCatalog { providers: SafeProvider[]; models: ModelRecord[]; activeModelId: string | null }
export interface ProviderPresetInfo { name: string; baseUrl: string; allowNoKey: boolean }

export interface WorkspaceSnapshot {
  projectId: string;
  nodeId: string;
  mode: ContextMode;
  contextItems: ContextItem[];
  messages: Message[];
  discussionNodes: DiscussionNode[];
  discussionEdges: DiscussionEdge[];
  activeNodeId: string;
  manifests: Array<{ id: string; contextItemIds: string[]; model: string; estimatedTokens: number }>;
  updatedAt: string;
}
