// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { OpenAiCompatibleProvider, ProviderError } from './ai-provider';
import type { AiConfig } from './config';

const config: AiConfig = {
  baseUrl: 'https://provider.example/v1', apiKey: 'secret-test-key', model: 'provider-model',
  providerName: 'Test', chatPath: '/chat/completions', timeoutMs: 1000, temperature: 0.2, extraHeaders: { 'X-Test': 'yes' },
  allowNoKey: false,
};

describe('OpenAiCompatibleProvider', () => {
  it('sends compatible messages and extracts the answer', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe('provider-model');
      expect(body.messages[0].content).toContain('[Fact] 访谈');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer secret-test-key');
      return new Response(JSON.stringify({ choices: [{ message: { content: '真实回答' } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new OpenAiCompatibleProvider(config, fetcher);
    const answer = await provider.complete({
      prompt: '继续分析', mode: 'Assisted', history: [],
      contextItems: [{ id: 'c1', title: '访谈', detail: '用户需要透明度', role: 'Fact', status: 'active', tokens: 100 }],
    });
    expect(answer).toBe('真实回答');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('fails clearly when no API key is configured', async () => {
    const provider = new OpenAiCompatibleProvider({ ...config, apiKey: '' });
    await expect(provider.complete({ prompt: 'test', mode: 'Strict', history: [], contextItems: [] }))
      .rejects.toMatchObject<Partial<ProviderError>>({ code: 'PROVIDER_NOT_CONFIGURED', status: 503 });
  });
});
