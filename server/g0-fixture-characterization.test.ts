// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import type { AIRuntime } from './ai-runtime';
import type { WorkspaceData } from './domain';
import { ProviderService } from './provider-service';
import { ProviderStore } from './provider-store';
import { SecretVault } from './secret-vault';
import { WorkspaceStore } from './store';

const root = resolve(import.meta.dirname, '..');
const directories: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolveClose, rejectClose) => server.close(error => error ? rejectClose(error) : resolveClose()))));
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

async function fixture<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(join(root, 'docs/architecture-gates/fixtures', name), 'utf8')) as T;
}

it('loads registered workspace and error-retry fixtures to characterize route and recovery semantics', async () => {
  const workspaceFixture = await fixture<{ workspace: WorkspaceData }>('branch-context-provider.json');
  const scenarioFixture = await fixture<{ scenario: { workspaceFixtureId: string; operations: Array<{ operation: string; expected: string }> } }>('error-cancel-recovery.json');
  expect(scenarioFixture.scenario.workspaceFixtureId).toBe('g0-branch-context-provider-v1');
  const directory = await mkdtemp(join(tmpdir(), 'rhiza-g0-fixture-'));
  directories.push(directory);
  const store = new WorkspaceStore(join(directory, 'workspace.json'));
  await store.update(() => structuredClone(workspaceFixture.workspace));
  let attempts = 0;
  const runtime: AIRuntime = {
    kind: 'provider-adapter',
    listModels: async () => [{ id: 'fixture', provider: 'Fixture', model: 'fixture', displayName: 'Fixture', active: true }],
    async *generate(input) {
      attempts += 1;
      yield { type: 'RUN_START', requestId: input.requestId, manifestId: input.manifestId, model: 'fixture', provider: 'Fixture' } as const;
      if (attempts === 1) { yield { type: 'RUN_ERROR', requestId: input.requestId, code: 'UPSTREAM_TIMEOUT', message: 'fixture timeout', status: 504 } as const; return; }
      yield { type: 'RUN_END', requestId: input.requestId, text: 'fixture retry complete', model: 'fixture', provider: 'Fixture' } as const;
    },
  };
  const provider = new ProviderService(new ProviderStore(join(directory, 'providers.json')), new SecretVault(join(directory, '.key')), { baseUrl: 'https://fixture.invalid', apiKey: '', model: 'fixture', providerName: 'Fixture', chatPath: '/chat/completions', timeoutMs: 1000, temperature: 0.4, extraHeaders: {}, allowNoKey: true });
  const server = createServer(createApp(store, provider, false, runtime));
  await new Promise<void>((resolveListen, rejectListen) => server.listen(0, '127.0.0.1', resolveListen).once('error', rejectListen));
  servers.push(server);
  const before = await request(server).get('/api/workspace').expect(200);
  expect(before.body.workspace.activeNodeId).toBe('fixture-main');
  await request(server).post('/api/chat').send({ message: 'fixture retry route' }).expect(504);
  const failed = await request(server).get('/api/workspace').expect(200);
  expect(failed.body.workspace.messages).toEqual(before.body.workspace.messages);
  await request(server).post('/api/chat').send({ message: 'fixture retry route', operation: 'retry' }).expect(201);
  const recovered = await request(server).get('/api/workspace').expect(200);
  expect(recovered.body.workspace.messages.slice(-2).map((message: { operation: string }) => message.operation)).toEqual(['retry', 'retry']);
  expect(scenarioFixture.scenario.operations.map(item => `${item.operation}:${item.expected}`)).toContain('retry:committed');
});
