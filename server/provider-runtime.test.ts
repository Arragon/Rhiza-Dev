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
        stream: (async function* () { yield '运行时'; yield '回答'; })(),
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

    expect(events.map(event => event.type)).toEqual(['RUN_START', 'CONTENT_DELTA', 'CONTENT_DELTA', 'RUN_END']);
    expect(events[0]).toMatchObject({ manifestId: 'manifest-1', model: 'test-model', provider: 'Test Provider' });
    expect(await collectRuntimeResult(runtime, request)).toEqual({ text: '运行时回答', model: 'test-model', provider: 'Test Provider' });
    expect(providers.streamModel).toHaveBeenCalledWith('model-1', expect.objectContaining({ nodeId: 'node-1', manifestId: 'manifest-1' }));
  });
});
