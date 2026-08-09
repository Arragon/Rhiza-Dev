import { ProviderError } from './ai-provider';
import type { AIRuntime, ModelInfo, RuntimeRequest } from './ai-runtime';
import type { ProviderService } from './provider-service';

/**
 * Runtime adapter for the current Provider Catalog. Shared LibreChat schemas and
 * policies stay outside this execution boundary; Rhiza owns domain persistence.
 */
export class ProviderRuntime implements AIRuntime {
  readonly kind = 'provider-adapter' as const;
  constructor(private readonly providers: ProviderService) {}

  async listModels(): Promise<ModelInfo[]> {
    const catalog = await this.providers.snapshot();
    return catalog.models.map(model => ({
      id: model.id,
      provider: catalog.providers.find(provider => provider.id === model.providerId)?.name || 'Unknown',
      model: model.modelId,
      displayName: model.displayName,
      active: model.id === catalog.activeModelId,
    }));
  }

  async *generate(request: RuntimeRequest) {
    const profile = (await this.listModels()).find(model => model.id === request.modelId);
    if (!profile) {
      yield { type: 'RUN_ERROR' as const, requestId: request.requestId, code: 'MODEL_NOT_FOUND', message: 'Runtime 模型不存在。', status: 404 };
      return;
    }

    yield { type: 'RUN_START' as const, requestId: request.requestId, manifestId: request.manifestId, model: profile.model, provider: profile.provider };
    try {
      const completion = await this.providers.streamModel(request.modelId, request);
      let text = '';
      for await (const delta of completion.stream) {
        text += delta;
        yield { type: 'CONTENT_DELTA' as const, requestId: request.requestId, delta };
      }
      yield { type: 'RUN_END' as const, requestId: request.requestId, text, model: completion.model, provider: completion.provider };
    } catch (error) {
      const providerError = error instanceof ProviderError ? error : new ProviderError(error instanceof Error ? error.message : 'AI Runtime 执行失败。');
      yield { type: 'RUN_ERROR' as const, requestId: request.requestId, code: providerError.code, message: providerError.message, status: providerError.status };
    }
  }
}
