export type ProviderPreset = 'openai' | 'openrouter' | 'deepseek' | 'siliconflow' | 'ollama' | 'custom';

export interface EncryptedSecret { iv: string; tag: string; data: string }

export interface StoredProvider {
  id: string;
  preset: ProviderPreset;
  name: string;
  baseUrl: string;
  chatPath: string;
  allowNoKey: boolean;
  apiKey?: EncryptedSecret;
  createdAt: string;
  updatedAt: string;
}

export interface ModelRecord {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  favorite: boolean;
  pinned: boolean;
  createdAt: string;
}

export interface ProviderData {
  providers: StoredProvider[];
  models: ModelRecord[];
  activeModelId: string | null;
  updatedAt: string;
}

export interface SafeProvider extends Omit<StoredProvider, 'apiKey'> {
  hasApiKey: boolean;
  configured: boolean;
}

export interface ProviderSnapshot {
  providers: SafeProvider[];
  models: ModelRecord[];
  activeModelId: string | null;
}
