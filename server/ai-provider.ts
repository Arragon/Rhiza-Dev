import type { AiConfig } from './config';
import type { ContextItem, StoredMessage } from './domain';
import { buildLibreChatAgentMessages } from './librechat-shared';

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

function completionPayload(config: AiConfig, request: CompletionRequest, stream = false) {
  return {
    model: config.model,
    temperature: config.temperature,
    ...(stream ? { stream: true } : {}),
    messages: buildLibreChatAgentMessages(request),
  };
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

function extractDelta(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const content = (payload as { choices?: Array<{ delta?: { content?: unknown } }> }).choices?.[0]?.delta?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map(part => part && typeof part === 'object' && 'text' in part && typeof part.text === 'string' ? part.text : '').join('');
}

function parseSseDelta(frame: string): string {
  const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
  if (!data || data === '[DONE]') return '';
  try { return extractDelta(JSON.parse(data)); } catch { return ''; }
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
        body: JSON.stringify(completionPayload(this.config, request)),
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

  /** Normalizes OpenAI-compatible SSE into text deltas without exposing provider wire events. */
  async *stream(request: CompletionRequest): AsyncIterable<string> {
    if (!this.config.apiKey && !this.config.allowNoKey) {
      throw new ProviderError('尚未配置第三方 AI。请在模型设置中配置供应商和模型。', 503, 'PROVIDER_NOT_CONFIGURED');
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
        body: JSON.stringify(completionPayload(this.config, request, true)),
        signal: controller.signal,
      });

      if (!response.ok) {
        const raw = await response.text();
        let payload: unknown;
        try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }
        const providerMessage = payload && typeof payload === 'object' && 'error' in payload
          ? JSON.stringify((payload as { error: unknown }).error)
          : raw.slice(0, 300);
        throw new ProviderError(`第三方 AI 请求失败（${response.status}）：${providerMessage || '无响应详情'}`, 502, 'PROVIDER_REQUEST_FAILED');
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream')) {
        const text = extractText(await response.json().catch(() => ({})));
        if (!text) throw new ProviderError('第三方 AI 返回了无法识别的空响应。', 502, 'INVALID_PROVIDER_RESPONSE');
        yield text;
        return;
      }

      if (!response.body) throw new ProviderError('第三方 AI 未返回可读取的事件流。', 502, 'INVALID_PROVIDER_RESPONSE');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let emitted = false;
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() || '';
        for (const frame of frames) {
          const delta = parseSseDelta(frame);
          if (delta) { emitted = true; yield delta; }
        }
        if (done) break;
      }
      const trailingDelta = parseSseDelta(buffer);
      if (trailingDelta) { emitted = true; yield trailingDelta; }
      if (!emitted) throw new ProviderError('第三方 AI 事件流未包含文本内容。', 502, 'INVALID_PROVIDER_RESPONSE');
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw new ProviderError('第三方 AI 请求超时，请检查网络或调高 AI_TIMEOUT_MS。', 504, 'PROVIDER_TIMEOUT');
      throw new ProviderError(`无法连接第三方 AI：${error instanceof Error ? error.message : '未知错误'}`, 502, 'PROVIDER_UNREACHABLE');
    } finally {
      clearTimeout(timeout);
    }
  }
}
