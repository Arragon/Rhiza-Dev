// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildLibreChatAgentMessages, libreChatFilePolicy, toLibreChatModelSpec } from './librechat-shared';

const provider = {
  id: 'provider-1', preset: 'deepseek' as const, name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1',
  chatPath: '/chat/completions', allowNoKey: false, createdAt: '2026-01-01', updatedAt: '2026-01-01',
};
const model = {
  id: 'model-1', providerId: 'provider-1', modelId: 'deepseek-chat', displayName: 'DeepSeek Chat',
  favorite: false, pinned: true, createdAt: '2026-01-01',
};

describe('LibreChat shared adapters', () => {
  it('validates Rhiza models through the LibreChat model-spec schema', () => {
    expect(toLibreChatModelSpec(provider, model)).toMatchObject({
      name: 'model-1', label: 'DeepSeek Chat', group: 'DeepSeek',
      preset: { endpoint: 'custom', endpointType: 'custom', model: 'deepseek-chat' },
    });
  });

  it('exposes LibreChat endpoint file limits and MIME capabilities', () => {
    const policy = libreChatFilePolicy();
    expect(policy.disabled).toBe(false);
    expect(policy.maxFiles).toBeGreaterThan(0);
    expect(policy.maxFileSizeBytes).toBeGreaterThan(0);
    expect(policy.supportedMimeTypes).toEqual(expect.arrayContaining(['text/plain', 'application/pdf']));
  });

  it('formats a bounded agent prompt as role-based messages', () => {
    const messages = buildLibreChatAgentMessages({
      prompt: '继续', mode: 'Strict',
      contextItems: [{ id: 'context-1', title: '约束', detail: '保留图谱语义', role: 'Constraint', status: 'active', tokens: 8 }],
      history: [{ id: 'message-1', nodeId: 'node-1', kind: 'assistant', text: '已记录', createdAt: '2026-01-01' }],
    });
    expect(messages.map(message => message.role)).toEqual(['system', 'assistant', 'user']);
    expect(messages[0].content).toContain('保留图谱语义');
    expect(messages.at(-1)?.content).toBe('继续');
  });
});
