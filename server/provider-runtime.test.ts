// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { collectRuntimeResult } from './ai-runtime';
import { ProviderRuntime } from './provider-runtime';
import type { ProviderService } from './provider-service';

describe('ProviderRuntime', () => {
  it('maps a frozen Rhiza request onto the runtime event protocol', async () => {
    const providers = {
      snapshot: vi.fn().mockResolvedValue({
        providers: [{ id: 'provider-1', name: 'Test Provider' }],
        models: [{ id: 'model-1', providerId: 'provider-1', modelId: 'test-model', displayName: 'Test Model' }],
        activeModelId: 'model-1',
      }),
      streamModel: vi.fn().mockImplementation(async () => ({
        stream: (async function* () {
          yield { type: 'reasoning', delta: '先检查约束' };
          yield { type: 'tool', toolCall: { id: 'tool-1', name: 'search', arguments: '{"q":' } };
          yield { type: 'tool', toolCall: { id: 'tool-1', name: '', arguments: '"Rhiza"}' } };
          yield { type: 'content', delta: '运行时' };
          yield { type: 'content', delta: '回答' };
          yield { type: 'usage', usage: { promptTokens: 10, completionTokens: 4, totalTokens: 14 } };
        })(),
        model: 'test-model', provider: 'Test Provider',
      })),
    } as unknown as ProviderService;
    const runtime = new ProviderRuntime(providers);
    const request = {
      requestId: 'request-1', manifestId: 'manifest-1', projectId: 'project-1', nodeId: 'node-1', modelId: 'model-1',
      prompt: '继续分析', history: [], contextItems: [], mode: 'Assisted' as const,
    };

    const events = [];
    for await (const event of runtime.generate(request)) events.push(event);

    expect(events.map(event => event.type)).toEqual(['RUN_START', 'REASONING_DELTA', 'TOOL_CALL_DELTA', 'TOOL_CALL_DELTA', 'CONTENT_DELTA', 'CONTENT_DELTA', 'USAGE', 'RUN_END']);
    expect(events[0]).toMatchObject({ manifestId: 'manifest-1', model: 'test-model', provider: 'Test Provider' });
    expect(await collectRuntimeResult(runtime, request)).toMatchObject({ text: '运行时回答', model: 'test-model', provider: 'Test Provider', reasoning: '先检查约束', toolCalls: [{ id: 'tool-1', name: 'search', arguments: '{"q":"Rhiza"}' }], usage: { promptTokens: 10, completionTokens: 4, totalTokens: 14 } });
    expect(providers.streamModel).toHaveBeenCalledWith('model-1', expect.objectContaining({ nodeId: 'node-1', manifestId: 'manifest-1' }));
  });
});
