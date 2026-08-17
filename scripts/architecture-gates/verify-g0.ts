import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { cpus, platform, release, tmpdir, totalmem } from 'node:os';
import { join, relative, resolve } from 'node:path';
import Ajv2020, { type AnySchema, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import request from 'supertest';
import { createApp } from '../../server/app';
import type { AIRuntime } from '../../server/ai-runtime';
import { planContext } from '../../server/context-planner';
import type { DiscussionNode, WorkspaceData } from '../../server/domain';
import { ProviderService } from '../../server/provider-service';
import { ProviderStore } from '../../server/provider-store';
import { SecretVault } from '../../server/secret-vault';
import { WorkspaceStore } from '../../server/store';

const root = resolve(import.meta.dirname, '../..');
const gates = join(root, 'docs/architecture-gates');
const fixturesDirectory = join(gates, 'fixtures');
const update = process.argv.includes('--update');
const writeEvidence = process.argv.includes('--write-evidence');
const baselineCommit = 'b29d94fb034678e0c9d5660848e92e995311d4da';
const baselineTag = 'pre-0815-engineering-baseline';

type JsonObject = Record<string, unknown>;
type RegistryEntry = {
  id: string;
  path: string;
  schema_id: string;
  digest: string;
  size_bytes: number;
  scenario_ids: string[];
  purpose: string;
};
type FixtureRegistry = {
  schema_version: string;
  schema_id: string;
  provenance: 'synthetic';
  canonicalization_version: string;
  total_size_bytes: number;
  fixtures: RegistryEntry[];
};
type Metric = {
  metric: string;
  warmup_count: 20;
  sample_count: 200;
  concurrency: 1;
  external_network: false;
  failures: number;
  timeouts: number;
  drops: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
};

type PerformanceProfile = {
  profileVersion: '1.0.0';
  id: string;
  baseFixtureId: string;
  nodeCount: 300;
  node: { idPrefix: string; titleTemplate: string; summary: string; periodicSummary: string; periodicEvery: number; createdAt: string };
  message: { idPrefix: string; textFrom: 'nodeSummary'; createdAt: string };
  requests: { contextPrompt: string; streamMessage: string; timeoutMs: number };
};

const fail = (message: string): never => {
  throw new Error(`G0 verification failed: ${message}`);
};

const sha256 = (value: string | Buffer): string =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;

const canonicalize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as JsonObject)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalize(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

async function listFiles(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map(entry =>
    entry.isDirectory() ? listFiles(join(path, entry.name)) : [join(path, entry.name)]
  ))).flat();
}

async function createValidator(): Promise<Ajv2020> {
  const validator = new Ajv2020({ allErrors: true, strict: true });
  addFormats(validator);
  const schemaPaths = (await listFiles(gates)).filter(path => path.endsWith('.schema.json')).sort();
  for (const path of schemaPaths) {
    const schema = await readJson<AnySchema>(path);
    if (!schema || typeof schema !== 'object' || !('$id' in schema) || !('$schema' in schema)) {
      fail(`${relative(gates, path)} does not declare $schema and $id`);
    }
    validator.addSchema(schema);
  }
  return validator;
}

function assertValid(validator: Ajv2020, schemaId: string, value: unknown): void {
  const validate: ValidateFunction | undefined = validator.getSchema(schemaId);
  if (validate === undefined) throw new Error(`G0 verification failed: missing JSON Schema ${schemaId}`);
  if (!validate(value)) fail(validator.errorsText(validate.errors, { separator: '\n' }));
}

function assertFixtureHygiene(content: string, fixturePath: string): void {
  const forbidden = [
    /"(?:api[_-]?key|token|password|secret|authorization|credential)"\s*:\s*".+"/i,
    /(?:Bearer\s+|sk-)[A-Za-z0-9_-]{8,}/i,
    /(?:AKIA|AIza|ghp_|xox[baprs]-)[A-Za-z0-9_-]{8,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /file:\/\//i,
    /(?:^|[\\/])\.\.(?:[\\/]|$)/m,
    /(?:\/Users\/|\/home\/|\/private(?:\/|$)|\/tmp(?:\/|$)|\/etc(?:\/|$)|[A-Z]:\\|\\\\[^\\]+\\[^\\]+)/,
    /(?:^|["'])~\//m,
  ];
  if (forbidden.some(pattern => pattern.test(content))) {
    fail(`${fixturePath} contains a secret, absolute path, file URL, or traversal`);
  }
}

async function loadRegisteredFixture<T>(registry: FixtureRegistry, id: string): Promise<T> {
  const entry = registry.fixtures.find(item => item.id === id)
    ?? fail(`registered fixture not found: ${id}`);
  return readJson<T>(join(gates, entry.path));
}

async function verifyFixtures(validator: Ajv2020): Promise<{ registry: FixtureRegistry; digest: string }> {
  const registryPath = join(gates, 'fixture-registry.json');
  const registry = await readJson<FixtureRegistry>(registryPath);
  assertValid(validator, registry.schema_id, registry);
  if (registry.provenance !== 'synthetic') fail('fixture registry provenance must be synthetic');

  const unregistered = new Set((await listFiles(fixturesDirectory)).map(path => relative(gates, path)));
  const workspaceIds = new Set<string>();
  const scenarioReferences: string[] = [];
  const computedEntries: RegistryEntry[] = [];
  let totalSize = 0;

  for (const entry of registry.fixtures) {
    if (!unregistered.delete(entry.path)) fail(`fixture path is missing or duplicated: ${entry.path}`);
    const path = join(gates, entry.path);
    const content = await readFile(path, 'utf8');
    assertFixtureHygiene(content, entry.path);
    const sizeBytes = (await stat(path)).size;
    if (sizeBytes > 1_000_000) fail(`${entry.path} exceeds the 1 MB fixture limit`);

    const fixture = JSON.parse(content) as JsonObject;
    assertValid(validator, entry.schema_id, fixture);
    const digest = sha256(canonicalize(fixture));
    const repeatedDigest = sha256(canonicalize(JSON.parse(content)));
    if (digest !== repeatedDigest) fail(`${entry.id} is not canonically stable across consecutive runs`);
    if (!update && (entry.digest !== digest || entry.size_bytes !== sizeBytes)) {
      fail(`${entry.id} checksum or size drift; run pnpm g0:update after intentional review`);
    }

    if ('workspace' in fixture) workspaceIds.add(String(fixture.id));
    const scenario = fixture.scenario as JsonObject | undefined;
    if (scenario?.workspaceFixtureId) scenarioReferences.push(String(scenario.workspaceFixtureId));
    totalSize += sizeBytes;
    computedEntries.push({ ...entry, digest, size_bytes: sizeBytes });
  }

  if (unregistered.size) fail(`unregistered fixtures: ${[...unregistered].join(', ')}`);
  if (totalSize > 10_000_000) fail('fixture registry exceeds the 10 MB aggregate limit');
  if (!update && registry.total_size_bytes !== totalSize) fail('fixture registry aggregate size drift');
  for (const workspaceFixtureId of scenarioReferences) {
    if (!workspaceIds.has(workspaceFixtureId)) fail(`scenario references unknown workspace fixture ${workspaceFixtureId}`);
  }

  const normalized = { ...registry, total_size_bytes: totalSize, fixtures: computedEntries };
  if (update) await writeFile(registryPath, `${JSON.stringify(normalized, null, 2)}\n`);
  return { registry: normalized, digest: sha256(canonicalize(normalized)) };
}

async function verifyCharacterizationMap(): Promise<number> {
  const path = join(gates, 'G0/characterization-map.json');
  const map = await readJson<{ coverage: Array<{ behavior: string; file: string; title: string }> }>(path);
  const required = [
    'chat', 'branch', 'edit/resend', 'regenerate', 'Stop e2e', 'backend retry',
    'UI retry', 'file', 'archive/restore', 'merge/delete', 'provider selection', 'fixture route/retry',
  ];
  const actual = map.coverage.map(item => item.behavior).sort();
  if (actual.join('|') !== [...required].sort().join('|')) fail('characterization behavior set drift');
  for (const item of map.coverage) {
    const source = await readFile(join(root, item.file), 'utf8');
    if (!source.includes(`it('${item.title}'`)) {
      fail(`characterization title not found: ${item.file} :: ${item.title}`);
    }
  }
  return map.coverage.length;
}

async function verifySnapshots(registryDigest: string): Promise<Record<string, string>> {
  const snapshotDirectory = join(gates, 'G0/snapshots');
  await mkdir(snapshotDirectory, { recursive: true });
  const appSource = await readFile(join(root, 'server/app.ts'), 'utf8');
  const runtimeSource = await readFile(join(root, 'server/ai-runtime.ts'), 'utf8');
  const api = {
    version: 'legacy-api-snapshot-1.0.0',
    routes: [...appSource.matchAll(/app\.(get|post|patch|delete)\(\s*['`]([^'`]+)/g)]
      .map(match => `${match[1].toUpperCase()} ${match[2]}`)
      .filter(route => route !== 'GET *path')
      .sort(),
    sseChannels: ['runtime', 'commit'],
    sseEventTypes: [...new Set([...runtimeSource.matchAll(/type: '([A-Z_]+)'/g)].map(match => match[1]))].sort(),
  };
  const migrationPaths = (await listFiles(join(root, 'db/migrations')))
    .filter(path => path.endsWith('.sql'))
    .sort();
  const db = {
    version: 'legacy-db-schema-snapshot-1.0.0',
    migrations: Object.fromEntries(await Promise.all(migrationPaths.map(async path => [
      relative(root, path),
      sha256(await readFile(path)),
    ]))),
  };

  const checksums: Record<string, string> = {};
  for (const [name, value] of Object.entries({ api, db })) {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    const path = join(snapshotDirectory, `${name}.json`);
    if (update) await writeFile(path, content);
    else if (await readFile(path, 'utf8') !== content) fail(`${name} snapshot drift`);
    checksums[`G0/snapshots/${name}.json`] = sha256(content);
  }

  const schemaIndex = {
    schema_version: '1.0.0',
    workspace: {
      registry_digest: registryDigest,
      schema_digest: sha256(await readFile(join(gates, 'workspace-fixture.schema.json'))),
    },
    db: { digest: checksums['G0/snapshots/db.json'] },
    api: { digest: checksums['G0/snapshots/api.json'] },
  };
  const indexContent = `${JSON.stringify(schemaIndex, null, 2)}\n`;
  const indexPath = join(snapshotDirectory, 'schema-index.json');
  if (update) await writeFile(indexPath, indexContent);
  else if (await readFile(indexPath, 'utf8') !== indexContent) fail('schema index drift');
  checksums['G0/snapshots/schema-index.json'] = sha256(indexContent);
  return checksums;
}

function percentile(samples: number[], fraction: number): number {
  return samples[Math.ceil(samples.length * fraction) - 1];
}

async function measure(
  name: string,
  operation: () => Promise<void>,
  prepare?: () => Promise<void>,
): Promise<Metric> {
  const timeoutMs = 5_000;
  const execute = async () => new Promise<void>((resolveOperation, rejectOperation) => {
    const timer = setTimeout(() => rejectOperation(Object.assign(new Error(`${name} timed out`), { code: 'G0_OPERATION_TIMEOUT' })), timeoutMs);
    operation().then(() => { clearTimeout(timer); resolveOperation(); }, error => { clearTimeout(timer); rejectOperation(error); });
  });
  for (let index = 0; index < 20; index += 1) {
    await prepare?.();
    await execute();
  }
  const samples: number[] = [];
  let failures = 0;
  let timeouts = 0;
  let drops = 0;
  for (let index = 0; index < 200; index += 1) {
    try {
      await prepare?.();
      const started = process.hrtime.bigint();
      await execute();
      samples.push(Number(process.hrtime.bigint() - started) / 1e6);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'G0_OPERATION_TIMEOUT') timeouts += 1;
      else if ((error as NodeJS.ErrnoException).code === 'ECONNRESET') drops += 1;
      else failures += 1;
    }
  }
  samples.sort((left, right) => left - right);
  return {
    metric: name,
    warmup_count: 20,
    sample_count: 200,
    concurrency: 1,
    external_network: false,
    failures, timeouts, drops,
    p50: Number((samples.length ? percentile(samples, 0.5) : 0).toFixed(3)),
    p95: Number((samples.length ? percentile(samples, 0.95) : 0).toFixed(3)),
    p99: Number((samples.length ? percentile(samples, 0.99) : 0).toFixed(3)),
    max: Number((samples.at(-1) ?? 0).toFixed(3)),
  };
}

function createBenchmarkWorkspace(base: WorkspaceData, profile: PerformanceProfile): WorkspaceData {
  const workspace = structuredClone(base);
  workspace.discussionNodes = Array.from({ length: profile.nodeCount }, (_, index): DiscussionNode => ({
    id: `${profile.node.idPrefix}${index}`,
    title: profile.node.titleTemplate.replace('{index}', String(index)),
    summary: index % profile.node.periodicEvery === 0 ? profile.node.periodicSummary : profile.node.summary,
    status: 'active',
    kind: index ? 'branch' : 'main',
    x: index,
    y: index,
    createdAt: profile.node.createdAt,
    updatedAt: profile.node.createdAt,
  }));
  workspace.activeNodeId = `${profile.node.idPrefix}0`;
  workspace.nodeId = `${profile.node.idPrefix}0`;
  workspace.messages = workspace.discussionNodes.map((node, index) => ({
    id: `${profile.message.idPrefix}${index}`,
    nodeId: node.id,
    kind: 'assistant' as const,
    text: profile.message.textFrom === 'nodeSummary' ? node.summary : '',
    createdAt: profile.message.createdAt,
  }));
  workspace.updatedAt = profile.node.createdAt;
  return workspace;
}

async function runBenchmarks(registry: FixtureRegistry, profile: PerformanceProfile): Promise<Metric[]> {
  const directory = await mkdtemp(join(tmpdir(), 'rhiza-g0-'));
  const originalInfo = console.info;
  let server: Server | undefined;
  console.info = () => undefined;
  try {
    const fixture = await loadRegisteredFixture<{ workspace: WorkspaceData }>(registry, profile.baseFixtureId);
    const workspace = createBenchmarkWorkspace(fixture.workspace, profile);
    const store = new WorkspaceStore(join(directory, 'workspace.json'));
    await store.update(() => structuredClone(workspace));
    const reset = async () => { await store.update(() => structuredClone(workspace)); };
    const runtime: AIRuntime = {
      kind: 'provider-adapter',
      listModels: async () => [{ id: 'g0', provider: 'G0', model: 'g0', displayName: 'G0', active: true }],
      async *generate(input) {
        yield { type: 'RUN_START', requestId: input.requestId, manifestId: input.manifestId, model: 'g0', provider: 'G0' } as const;
        yield { type: 'CONTENT_DELTA', requestId: input.requestId, delta: 'ok' } as const;
        yield { type: 'RUN_END', requestId: input.requestId, text: 'ok', model: 'g0', provider: 'G0' } as const;
      },
    };
    const provider = new ProviderService(
      new ProviderStore(join(directory, 'providers.json')),
      new SecretVault(join(directory, '.provider-key')),
      {
        baseUrl: 'https://fixture.invalid', apiKey: '', model: 'g0',
        providerName: 'G0', chatPath: '/chat/completions', timeoutMs: 1_000,
        temperature: 0.4, extraHeaders: {}, allowNoKey: true,
      },
    );
    const app = createApp(store, provider, false, runtime);
    server = createServer(app);
    await new Promise<void>((resolveListen, rejectListen) => server!.listen(0, '127.0.0.1', () => resolveListen()).once('error', rejectListen));
    return [
      await measure('workspace_query_latency_ms', async () => {
        await request(server!).get('/api/workspace').timeout({ deadline: profile.requests.timeoutMs }).expect(200);
      }),
      await measure('workspace_command_latency_ms', async () => {
        await request(server!).patch('/api/workspace/mode').send({ mode: 'Strict' }).timeout({ deadline: profile.requests.timeoutMs }).expect(200);
      }, reset),
      await measure('legacy_graph_workspace_read_latency_ms', async () => {
        const response = await request(server!).get('/api/workspace').timeout({ deadline: profile.requests.timeoutMs }).expect(200);
        response.body.workspace.discussionNodes.map((node: DiscussionNode) => ({ id: node.id, status: node.status }));
      }),
      await measure('context_plan_latency_ms', async () => {
        planContext(workspace, profile.requests.contextPrompt);
      }),
      await measure('stream_chat_commit_latency_ms', async () => {
        await request(server!).post('/api/chat/stream').send({ message: profile.requests.streamMessage }).timeout({ deadline: profile.requests.timeoutMs }).expect(200);
      }, reset),
    ];
  } finally {
    console.info = originalInfo;
    if (server?.listening) await new Promise<void>((resolveClose, rejectClose) => server!.close(error => error ? rejectClose(error) : resolveClose()));
    await rm(directory, { recursive: true, force: true });
  }
}

function verifyBaselineTag(): {
  commit: string;
  tag: string;
  tag_object_type: 'annotated';
  signature_status: 'signed' | 'unsigned';
  signature_reason: string;
} {
  const objectType = execFileSync('git', ['cat-file', '-t', `refs/tags/${baselineTag}`], { cwd: root, encoding: 'utf8' }).trim();
  const peeled = execFileSync('git', ['rev-parse', `${baselineTag}^{}`], { cwd: root, encoding: 'utf8' }).trim();
  if (objectType !== 'tag' || peeled !== baselineCommit) {
    fail(`${baselineTag} must be an annotated tag that peels to ${baselineCommit}`);
  }
  try {
    execFileSync('git', ['verify-tag', baselineTag], { cwd: root, stdio: 'ignore' });
    return {
      commit: baselineCommit,
      tag: baselineTag,
      tag_object_type: 'annotated',
      signature_status: 'signed',
      signature_reason: 'git verify-tag passed',
    };
  } catch {
    return {
      commit: baselineCommit,
      tag: baselineTag,
      tag_object_type: 'annotated',
      signature_status: 'unsigned',
      signature_reason: 'No repository signing key was configured; object type and peeled commit were verified.',
    };
  }
}

async function run(): Promise<void> {
  const startedAt = new Date().toISOString();
  if (writeEvidence) {
    execFileSync('pnpm', ['run', 'test:g0'], { cwd: root, stdio: 'inherit' });
  }
  // A normal verification must fail for a missing, lightweight, or mispointed baseline tag.
  const baseline = update ? undefined : verifyBaselineTag();
  const validator = await createValidator();
  const profile = await readJson<JsonObject>(join(gates, 'environment-profile.json'));
  assertValid(validator, 'https://rhiza.dev/architecture-gates/environment-profile/1.0.0', profile);
  const fixture = await verifyFixtures(validator);
  const performanceProfile = await readJson<PerformanceProfile>(join(gates, 'performance-profile.json'));
  assertValid(validator, 'https://rhiza.dev/architecture-gates/performance-profile/1.0.0', performanceProfile);
  if (!fixture.registry.fixtures.some(entry => entry.id === performanceProfile.baseFixtureId && entry.schema_id === 'https://rhiza.dev/architecture-gates/workspace-fixture/1.0.0')) {
    fail(`performance profile references an unregistered workspace fixture: ${performanceProfile.baseFixtureId}`);
  }
  const characterizationCount = await verifyCharacterizationMap();
  const snapshotChecksums = await verifySnapshots(fixture.digest);
  const performanceProfileChecksum = sha256(await readFile(join(gates, 'performance-profile.json')));
  const metrics = await runBenchmarks(fixture.registry, performanceProfile);
  console.table(metrics);
  console.log(`fixture registry ${fixture.digest}; characterization ${characterizationCount}/${characterizationCount}`);

  if (metrics.some(metric => metric.failures || metric.timeouts || metric.drops)) {
    fail('benchmark samples contain failures, timeouts, or drops; no pass evidence was generated');
  }

  if (!writeEvidence) {
    if (!update) {
      try {
      const existingEvidence = await readJson<JsonObject>(join(gates, 'G0/evidence.json'));
      assertValid(validator, 'https://rhiza.dev/architecture-gates/evidence-manifest/1.0.0', existingEvidence);
      if (existingEvidence.fixture_digest !== fixture.digest) fail('archived evidence fixture_digest drift');
      const expectedCommit = execFileSync('git', ['rev-parse', 'HEAD^'], { cwd: root, encoding: 'utf8' }).trim();
      if (existingEvidence.commit !== expectedCommit) fail(`archived evidence commit must equal HEAD^ (${expectedCommit})`);
      const checksums = existingEvidence.checksums as JsonObject;
      const expectedChecksums = { ...snapshotChecksums, 'fixture-registry.json': fixture.digest, 'performance-profile.json': performanceProfileChecksum };
      for (const [path, digest] of Object.entries(expectedChecksums)) {
        const record = checksums[path] as JsonObject | undefined;
        if (!record || record.algorithm !== 'sha256' || record.value !== digest.replace(/^sha256:/, '')) {
          fail(`archived evidence checksum drift: ${path}`);
        }
      }
      for (const descriptor of existingEvidence.artifact_descriptors as JsonObject[]) {
        const path = String(descriptor.path);
        const checksumRef = String(descriptor.checksum_ref);
        if (!(checksumRef in checksums) || checksumRef !== path) {
          fail(`evidence artifact ${String(descriptor.artifact_id)} has an unknown checksum_ref`);
        }
        const expected = expectedChecksums[path as keyof typeof expectedChecksums];
        if (!expected) fail(`evidence artifact ${String(descriptor.artifact_id)} references an unknown path`);
      }
      const expectedMetrics = ['workspace_query_latency_ms', 'workspace_command_latency_ms', 'legacy_graph_workspace_read_latency_ms', 'context_plan_latency_ms', 'stream_chat_commit_latency_ms'];
      const recorded = existingEvidence.observed_metrics as Record<string, Metric>;
      if (Object.keys(recorded).sort().join('|') !== expectedMetrics.sort().join('|')) fail('archived evidence metric key drift');
      for (const metric of Object.values(recorded)) {
        if (metric.warmup_count !== 20 || metric.sample_count !== 200 || metric.failures !== 0 || metric.timeouts !== 0 || metric.drops !== 0) fail(`archived evidence metric counts drift: ${metric.metric}`);
      }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    return;
  }
  const evidenceBaseline = baseline ?? verifyBaselineTag();
  const observedMetrics = Object.fromEntries(metrics.map(metric => [metric.metric, metric]));
  const checksumRecords = Object.fromEntries(
    Object.entries({ ...snapshotChecksums, 'fixture-registry.json': fixture.digest, 'performance-profile.json': performanceProfileChecksum }).map(([id, digest]) => [
      id,
      { algorithm: 'sha256', value: digest.replace(/^sha256:/, '') },
    ]),
  );
  const manifest = {
    $schema: 'https://rhiza.dev/architecture-gates/evidence-manifest/1.0.0',
    schema_version: '1.0.0',
    gate_id: 'G0',
    architecture_version: '0818-v3.0',
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    baseline: evidenceBaseline,
    fixture_id: 'g0-fixture-registry-v1',
    fixture_digest: fixture.digest,
    command: 'pnpm g0:evidence',
    environment_profile: {
      declared: profile,
      actual: {
        node: process.version,
        os: `${platform()} ${release()}`,
        cpu: cpus()[0]?.model ?? 'unknown',
        memory_bytes: totalmem(),
        store_adapter: 'json',
      },
    },
    thresholds: {
      warmup_count: 20,
      sample_count: 200,
      external_network: false,
      failures: 0,
      timeouts: 0,
      drops: 0,
    },
    observed_metrics: observedMetrics,
    absolute_metrics: Object.fromEntries(metrics.map(metric => [metric.metric, {
      p50: metric.p50, p95: metric.p95, p99: metric.p99, max: metric.max,
    }])),
    regression_vs_g0: {
      reason: 'G0 is the initial baseline; later gates compare against these absolute metrics.',
      metrics: Object.fromEntries(metrics.map(metric => [metric.metric, null])),
    },
    checksums: checksumRecords,
    artifact_descriptors: Object.keys(checksumRecords).map((path, index) => ({
      artifact_id: `g0-artifact-${index + 1}`,
      path,
      media_type: 'application/json',
      canonicalization_version: fixture.registry.canonicalization_version,
      checksum_ref: path,
    })),
    failure_classification: [],
    failure_injection_checkpoint: {
      checkpoint: 'stream-before-commit',
      injection_command: 'pnpm exec vitest run e2e/provider-stream.e2e.test.ts',
      expected: 'Stop aborts the upstream stream and leaves persisted history unchanged.',
    },
    recovery_command: 'POST /api/chat with operation=retry',
    manual_evidence_links: [
      {
        item: '100-node one-hour browser stability', status: 'pending',
        path: 'docs/M6_ACCEPTANCE.md', target_work_package: 'WP-2.1',
      },
      {
        item: 'real external-user usability validation and P0/P1 closure', status: 'pending',
        path: 'docs/M6_ACCEPTANCE.md', target_work_package: 'WP-2.3',
      },
    ],
    known_exceptions: [],
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    result: 'pass',
  };
  assertValid(validator, 'https://rhiza.dev/architecture-gates/evidence-manifest/1.0.0', manifest);
  await writeFile(join(gates, 'G0/evidence.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

run().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
