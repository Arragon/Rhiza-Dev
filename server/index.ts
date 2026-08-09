import { createApp } from './app';
import { loadAiConfig } from './config';
import { ProviderService } from './provider-service';
import { ProviderStore } from './provider-store';
import { SecretVault } from './secret-vault';
import { WorkspaceStore } from './store';

const port = Number(process.env.API_PORT || process.env.PORT || 8787);
const provider = new ProviderService(new ProviderStore(), new SecretVault(), loadAiConfig());
const store = new WorkspaceStore();
const serveFrontend = process.env.SERVE_FRONTEND !== 'false';
const app = createApp(store, provider, serveFrontend);

app.listen(port, '127.0.0.1', () => {
  console.info(`[api] RabbitHole backend listening on http://127.0.0.1:${port}`);
  provider.activeStatus().then(status => console.info(`[api] AI provider=${status.name} model=${status.model} configured=${status.configured}`)).catch(error => console.error('[api] provider initialization failed', error));
});
