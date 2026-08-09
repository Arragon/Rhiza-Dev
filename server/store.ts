import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { WorkspaceData } from './domain';
import { createSeedWorkspace } from './seed';

export class WorkspaceStore {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath = resolve('var/data/workspace.json')) {}

  async read(): Promise<WorkspaceData> {
    try {
      return this.normalize(JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<WorkspaceData>);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const seed = createSeedWorkspace();
      await this.write(seed);
      return seed;
    }
  }

  private normalize(raw: Partial<WorkspaceData>): WorkspaceData {
    const fallback = createSeedWorkspace();
    const activeNodeId = raw.activeNodeId || raw.nodeId || fallback.activeNodeId;
    const now = new Date().toISOString();
    const discussionNodes = raw.discussionNodes?.length ? raw.discussionNodes : [{ id: activeNodeId, title: '信息架构方向', summary: '探索首屏的内容层级、上下文入口与专业能力的渐进呈现方式。', status: 'active' as const, kind: 'main' as const, x: 350, y: 150, createdAt: now, updatedAt: now }];
    return {
      ...fallback,
      ...raw,
      nodeId: activeNodeId,
      activeNodeId,
      discussionNodes,
      discussionEdges: raw.discussionEdges || [],
      messages: (raw.messages || fallback.messages).map(message => ({ ...message, nodeId: message.nodeId || activeNodeId })),
      contextItems: raw.contextItems || fallback.contextItems,
      manifests: raw.manifests || [],
      mode: raw.mode || fallback.mode,
      updatedAt: raw.updatedAt || now,
    };
  }

  async update(mutator: (current: WorkspaceData) => WorkspaceData | Promise<WorkspaceData>): Promise<WorkspaceData> {
    let result!: WorkspaceData;
    this.queue = this.queue.then(async () => {
      const current = await this.read();
      result = await mutator(structuredClone(current));
      result.updatedAt = new Date().toISOString();
      await this.write(result);
    });
    await this.queue;
    return result;
  }

  private async write(data: WorkspaceData): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, this.filePath);
  }
}
