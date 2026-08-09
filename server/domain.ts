export type ContextMode = 'Auto' | 'Assisted' | 'Strict';
export type ContextStatus = 'active' | 'recommended' | 'excluded';
export type ContextRole = 'Fact' | 'Constraint' | 'Decision' | 'Reference';

export interface ContextItem {
  id: string;
  title: string;
  detail: string;
  role: ContextRole;
  status: ContextStatus;
  tokens: number;
  reason?: string;
}

export interface StoredMessage {
  id: string;
  nodeId: string;
  kind: 'user' | 'assistant';
  text: string;
  createdAt: string;
  manifestId?: string;
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

export interface ContextManifest {
  id: string;
  createdAt: string;
  mode: ContextMode;
  model: string;
  contextItemIds: string[];
  estimatedTokens: number;
}

export interface WorkspaceData {
  projectId: string;
  nodeId: string;
  mode: ContextMode;
  contextItems: ContextItem[];
  messages: StoredMessage[];
  discussionNodes: DiscussionNode[];
  discussionEdges: DiscussionEdge[];
  activeNodeId: string;
  manifests: ContextManifest[];
  updatedAt: string;
}

export interface ProviderStatus {
  configured: boolean;
  name: string;
  model: string;
  baseUrl: string;
}
