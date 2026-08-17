import 'dotenv/config';

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  providerName: string;
  chatPath: string;
  timeoutMs: number;
  temperature: number;
  extraHeaders: Record<string, string>;
  allowNoKey: boolean;
}

function parseExtraHeaders(value: string | undefined): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('must be an object');
    return Object.fromEntries(Object.entries(parsed).map(([key, headerValue]) => [key, String(headerValue)]));
  } catch (error) {
    throw new Error(`AI_EXTRA_HEADERS must be valid JSON: ${error instanceof Error ? error.message : 'invalid value'}`, { cause: error });
  }
}

export function loadAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  return {
    baseUrl: (env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    apiKey: env.AI_API_KEY || '',
    model: env.AI_MODEL || 'gpt-4.1-mini',
    providerName: env.AI_PROVIDER_NAME || 'OpenAI-compatible',
    chatPath: env.AI_CHAT_PATH || '/chat/completions',
    timeoutMs: Number(env.AI_TIMEOUT_MS || 90_000),
    temperature: Number(env.AI_TEMPERATURE || 0.4),
    extraHeaders: parseExtraHeaders(env.AI_EXTRA_HEADERS),
    allowNoKey: env.AI_ALLOW_NO_KEY === 'true',
  };
}
