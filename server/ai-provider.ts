import type { AiConfig } from './config';
import type { ContextItem, StoredMessage } from './domain';

export class ProviderError extends Error {
  constructor(message: string, readonly status = 502, readonly code = 'PROVIDER_ERROR') {
    super(message);
  }
}

interface CompletionRequest {
  prompt: string;
  history: StoredMessage[];
  contextItems: ContextItem[];
  mode: string;
}

function buildSystemPrompt(contextItems: ContextItem[], mode: string): string {
  const context = contextItems.length
    ? contextItems.map(item => `- [${item.role}] ${item.title}: ${item.detail}`).join('\n')
    : '- 没有附加项目上下文';
  return [
    '你是 RabbitHole 中的项目协作 AI。回答应准确、结构清晰，并明确区分事实、约束、假设与建议。',
    `当前上下文控制模式：${mode}。只把下列 Active Context 当作本轮项目背景，不要虚构未提供的项目事实。`,
    'Active Context:',
    context,
    '使用与用户相同的语言回答。避免复述上下文清单，除非这有助于解释结论。',
  ].join('\n');
}

function extractText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const data = payload as { choices?: Array<{ message?: { content?: unknown } }>; output_text?: unknown };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    const text = content.map(part => {
      if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text;
      return '';
    }).join('').trim();
    if (text) return text;
  }
  return typeof data.output_text === 'string' ? data.output_text.trim() : undefined;
}

export class OpenAiCompatibleProvider {
  constructor(private readonly config: AiConfig, private readonly fetcher: typeof fetch = fetch) {
    if (!/^https?:\/\//.test(config.baseUrl)) throw new Error('AI_BASE_URL must use http or https');
  }

  get status() {
    const safeUrl = new URL(this.config.baseUrl);
    safeUrl.username = '';
    safeUrl.password = '';
    safeUrl.search = '';
    safeUrl.hash = '';
    return {
      configured: Boolean(this.config.apiKey) || this.config.allowNoKey,
      name: this.config.providerName,
      model: this.config.model,
      baseUrl: safeUrl.toString().replace(/\/$/, ''),
    };
  }

  async complete(request: CompletionRequest): Promise<string> {
    if (!this.config.apiKey && !this.config.allowNoKey) {
      throw new ProviderError('尚未配置第三方 AI。请在 .env 中设置 AI_API_KEY、AI_BASE_URL 和 AI_MODEL。', 503, 'PROVIDER_NOT_CONFIGURED');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetcher(`${this.config.baseUrl}${this.config.chatPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
          ...this.config.extraHeaders,
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: this.config.temperature,
          messages: [
            { role: 'system', content: buildSystemPrompt(request.contextItems, request.mode) },
            ...request.history.slice(-20).map(message => ({ role: message.kind, content: message.text })),
            { role: 'user', content: request.prompt },
          ],
        }),
        signal: controller.signal,
      });

      const raw = await response.text();
      let payload: unknown;
      try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }
      if (!response.ok) {
        const providerMessage = payload && typeof payload === 'object' && 'error' in payload
          ? JSON.stringify((payload as { error: unknown }).error)
          : raw.slice(0, 300);
        throw new ProviderError(`第三方 AI 请求失败（${response.status}）：${providerMessage || '无响应详情'}`, 502, 'PROVIDER_REQUEST_FAILED');
      }

      const text = extractText(payload);
      if (!text) throw new ProviderError('第三方 AI 返回了无法识别的空响应。', 502, 'INVALID_PROVIDER_RESPONSE');
      return text;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ProviderError('第三方 AI 请求超时，请检查网络或调高 AI_TIMEOUT_MS。', 504, 'PROVIDER_TIMEOUT');
      }
      throw new ProviderError(`无法连接第三方 AI：${error instanceof Error ? error.message : '未知错误'}`, 502, 'PROVIDER_UNREACHABLE');
    } finally {
      clearTimeout(timeout);
    }
  }
}
