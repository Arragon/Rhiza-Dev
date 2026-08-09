import type { ContextItem, ContextMode, StoredMessage } from './domain';

export interface ModelInfo {
  id: string;
  provider: string;
  model: string;
  displayName: string;
  active: boolean;
}

export interface RuntimeRequest {
  requestId: string;
  manifestId: string;
  projectId: string;
  nodeId: string;
  modelId: string;
  prompt: string;
  history: StoredMessage[];
  contextItems: ContextItem[];
  mode: ContextMode;
}

export type RuntimeEvent =
  | { type: 'RUN_START'; requestId: string; manifestId: string; model: string; provider: string }
  | { type: 'CONTENT_DELTA'; requestId: string; delta: string }
  | { type: 'RUN_END'; requestId: string; text: string; model: string; provider: string }
  | { type: 'RUN_ERROR'; requestId: string; code: string; message: string; status: number };

export interface AIRuntime {
  readonly kind?: 'provider-adapter' | 'librechat';
  listModels(): Promise<ModelInfo[]>;
  generate(request: RuntimeRequest): AsyncIterable<RuntimeEvent>;
}

export interface RuntimeResult {
  text: string;
  model: string;
  provider: string;
}

export class RuntimeExecutionError extends Error {
  constructor(message: string, readonly status = 502, readonly code = 'RUNTIME_ERROR') {
    super(message);
  }
}

/** Collects the event protocol for today's request/response API; SSE can consume the same stream later. */
export async function collectRuntimeResult(runtime: AIRuntime, request: RuntimeRequest): Promise<RuntimeResult> {
  let result: RuntimeResult | undefined;
  for await (const event of runtime.generate(request)) {
    if (event.type === 'RUN_END') result = { text: event.text, model: event.model, provider: event.provider };
    if (event.type === 'RUN_ERROR') {
      throw new RuntimeExecutionError(event.message, event.status, event.code);
    }
  }
  if (!result) throw new Error('AI Runtime 未返回 RUN_END 事件。');
  return result;
}
