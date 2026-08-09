import { createApp } from './app';
import { loadAiConfig } from './config';
import { ProviderService } from './provider-service';
import { ProviderRuntime } from './provider-runtime';
import { ProviderStore } from './provider-store';
import { SecretVault } from './secret-vault';
import { WorkspaceStore } from './store';

const port = Number(process.env.API_PORT || process.env.PORT || 8787);
const provider = new ProviderService(new ProviderStore(), new SecretVault(), loadAiConfig());
const store = new WorkspaceStore();
const serveFrontend = process.env.SERVE_FRONTEND !== 'false';
const runtime = new ProviderRuntime(provider);
const app = createApp(store, provider, serveFrontend, runtime);

app.listen(port, '127.0.0.1', () => {
  console.info(`[api] Rhiza backend listening on http://127.0.0.1:${port} runtime=${runtime.kind}`);
  provider.activeStatus().then(status => console.info(`[api] AI provider=${status.name} model=${status.model} configured=${status.configured}`)).catch(error => console.error('[api] provider initialization failed', error));
});
