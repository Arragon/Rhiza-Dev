// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app';
import { ProviderService } from '../server/provider-service';
import { ProviderStore } from '../server/provider-store';
import { SecretVault } from '../server/secret-vault';
import { WorkspaceStore } from '../server/store';

const servers: Server[] = [];
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))));
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server did not expose a TCP port');
  return address.port;
}

describe('provider request and streaming E2E', () => {
  it('streams a real provider HTTP response through Rhiza SSE and commits it', async () => {
    let providerRequest: { authorization?: string; payload?: Record<string, unknown> } = {};
    const upstream = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', chunk => chunks.push(Buffer.from(chunk)));
      request.on('end', () => {
        providerRequest = {
          authorization: request.headers.authorization,
          payload: JSON.parse(Buffer.concat(chunks).toString('utf8')),
        };
        response.writeHead(200, { 'Content-Type': 'text/event-stream' });
        response.write('data: {"choices":[{"delta":{"content":"端到端"}}]}\n\n');
        response.end('data: {"choices":[{"delta":{"content":"流式回答"}}]}\n\ndata: [DONE]\n\n');
      });
    });
    const upstreamPort = await listen(upstream);

    const directory = await mkdtemp(join(tmpdir(), 'rhiza-e2e-'));
    directories.push(directory);
    const provider = new ProviderService(
      new ProviderStore(join(directory, 'providers.json')),
      new SecretVault(join(directory, '.provider-key')),
      {
        baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'e2e-secret', model: 'e2e-model',
        providerName: 'E2E Provider', chatPath: '/chat/completions', timeoutMs: 5_000,
        temperature: 0.2, extraHeaders: {}, allowNoKey: false,
      },
    );
    const appServer = createServer(createApp(new WorkspaceStore(join(directory, 'workspace.json')), provider));
    const appPort = await listen(appServer);

    const response = await fetch(`http://127.0.0.1:${appPort}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '验证真实流链路' }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const stream = await response.text();
    expect(stream).toContain('"type":"RUN_START"');
    expect(stream).toContain('"delta":"端到端"');
    expect(stream).toContain('"delta":"流式回答"');
    expect(stream).toContain('"type":"COMMIT"');

    expect(providerRequest.authorization).toBe('Bearer e2e-secret');
    expect(providerRequest.payload).toMatchObject({ model: 'e2e-model', stream: true, temperature: 0.4, top_p: 1, max_tokens: 2048 });
    const workspace = await fetch(`http://127.0.0.1:${appPort}/api/workspace`).then(result => result.json()) as {
      workspace: { messages: Array<{ text: string }>; manifests: unknown[] };
    };
    expect(workspace.workspace.messages.slice(-2).map(message => message.text)).toEqual(['验证真实流链路', '端到端流式回答']);
    expect(workspace.workspace.manifests).toHaveLength(1);
  });

  it('aborts the upstream provider on Stop and leaves persisted history unchanged', async () => {
    let upstreamClosed = false;
    const upstream = createServer((request, response) => {
      request.on('close', () => { upstreamClosed = true; });
      response.on('close', () => { upstreamClosed = true; });
      request.resume();
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      response.write('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n');
      setTimeout(() => { if (!response.destroyed) response.end('data: [DONE]\n\n'); }, 500);
    });
    const upstreamPort = await listen(upstream);
    const directory = await mkdtemp(join(tmpdir(), 'rhiza-stop-e2e-'));
    directories.push(directory);
    const provider = new ProviderService(
      new ProviderStore(join(directory, 'providers.json')),
      new SecretVault(join(directory, '.provider-key')),
      { baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'stop-secret', model: 'stop-model', providerName: 'Stop Provider', chatPath: '/chat/completions', timeoutMs: 5_000, temperature: 0.4, extraHeaders: {}, allowNoKey: false },
    );
    const appServer = createServer(createApp(new WorkspaceStore(join(directory, 'workspace.json')), provider));
    const appPort = await listen(appServer);
    const controller = new AbortController();
    const response = await fetch(`http://127.0.0.1:${appPort}/api/chat/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: '停止这一轮' }), signal: controller.signal });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let received = '';
    while (!received.includes('partial')) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error('Stream ended before the provider delta');
      received += decoder.decode(chunk.value, { stream: true });
    }
    controller.abort();
    await expect(reader.read()).rejects.toMatchObject({ name: 'AbortError' });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(upstreamClosed).toBe(true);
    const workspace = await fetch(`http://127.0.0.1:${appPort}/api/workspace`).then(result => result.json()) as { workspace: { messages: unknown[]; manifests: unknown[] } };
    expect(workspace.workspace.messages).toHaveLength(2);
    expect(workspace.workspace.manifests).toHaveLength(0);
  });
});
