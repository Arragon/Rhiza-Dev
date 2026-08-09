import {
  EModelEndpoint,
  fullMimeTypesList,
  getEndpointFileConfig,
  mergeFileConfig,
  tModelSpecSchema,
} from 'librechat-data-provider';
import type { ContextItem, StoredMessage } from './domain';
import type { ModelRecord, ProviderPreset, StoredProvider } from './provider-domain';

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AgentMessageInput {
  prompt: string;
  history: StoredMessage[];
  contextItems: ContextItem[];
  mode: string;
}

export function libreChatEndpointForPreset(preset: ProviderPreset): EModelEndpoint {
  return preset === 'openai' ? EModelEndpoint.openAI : EModelEndpoint.custom;
}

export function toLibreChatModelSpec(provider: StoredProvider, model: ModelRecord) {
  return tModelSpecSchema.parse({
    name: model.id,
    label: model.displayName,
    group: provider.name,
    description: `${provider.name} · ${model.modelId}`,
    preset: {
      endpoint: libreChatEndpointForPreset(provider.preset),
      endpointType: libreChatEndpointForPreset(provider.preset),
      model: model.modelId,
    },
  });
}

function acceptsMimeType(type: string, patterns: RegExp[] = []): boolean {
  return patterns.some(pattern => {
    pattern.lastIndex = 0;
    return pattern.test(type);
  });
}

export function libreChatFilePolicy(endpoint = EModelEndpoint.custom) {
  const config = mergeFileConfig(undefined);
  const endpointConfig = getEndpointFileConfig({ fileConfig: config, endpoint });
  return {
    disabled: endpointConfig.disabled ?? false,
    maxFiles: endpointConfig.fileLimit ?? 0,
    maxFileSizeBytes: endpointConfig.fileSizeLimit ?? 0,
    maxTotalSizeBytes: endpointConfig.totalSizeLimit ?? 0,
    fileTokenLimit: config.fileTokenLimit ?? 0,
    supportedMimeTypes: fullMimeTypesList.filter(type => acceptsMimeType(type, endpointConfig.supportedMimeTypes)),
  };
}

function buildSystemPrompt(contextItems: ContextItem[], mode: string): string {
  const context = contextItems.length
    ? contextItems.map(item => `- [${item.role}] ${item.title}: ${item.detail}`).join('\n')
    : '- 没有附加项目上下文';
  return [
    '你是根系（Rhiza）中的项目协作 AI。回答应准确、结构清晰，并明确区分事实、约束、假设与建议。',
    `当前上下文控制模式：${mode}。只把下列 Active Context 当作本轮项目背景，不要虚构未提供的项目事实。`,
    'Active Context:',
    context,
    '使用与用户相同的语言回答。避免复述上下文清单，除非这有助于解释结论。',
  ].join('\n');
}

/**
 * Keeps Rhiza's domain prompt while following LibreChat v0.8.7's non-LangChain
 * message formatting: system prompt, bounded history, then the current user turn.
 */
export function buildLibreChatAgentMessages(input: AgentMessageInput): AgentMessage[] {
  return [
    { role: 'system', content: buildSystemPrompt(input.contextItems, input.mode) },
    ...input.history.slice(-20).map(message => ({ role: message.kind, content: message.text })),
    { role: 'user', content: input.prompt },
  ];
}
