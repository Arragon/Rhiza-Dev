// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { PostgresWorkspaceStore } from '../server/postgres-store';

async function migratedDatabase() {
  const database = new PGlite();
  for (const migration of ['0001_rhiza_core', '0002_chat_parity', '0003_domain_persistence']) {
    await database.exec(await readFile(resolve(`db/migrations/${migration}.up.sql`), 'utf8'));
  }
  return database;
}

describe('PostgreSQL workspace persistence', () => {
  it('transactionally restores Project, Node, Segment, Event and audit state', async () => {
    const database = await migratedDatabase();
    try {
      const projectId = randomUUID();
      const store = new PostgresWorkspaceStore(database, projectId);
      const seeded = await store.read();
      expect(seeded).toMatchObject({ projectId, projectTitle: 'Rhiza 产品研究', mode: 'Assisted' });
      expect(seeded.discussionNodes).toHaveLength(1);
      expect(seeded.segments).toHaveLength(1);
      expect(seeded.messages.map(event => event.text)).toHaveLength(2);

      const eventId = randomUUID();
      const branchId = randomUUID();
      const anchorId = randomUUID();
      const edgeId = randomUUID();
      const createdAt = new Date().toISOString();
      const updated = await store.update(current => ({
        ...current,
        mode: 'Strict',
        messages: [...current.messages, { id: eventId, nodeId: current.activeNodeId, segmentId: current.segments[0].id, kind: 'user', text: '持久化验证事件', createdAt }],
        discussionNodes: [...current.discussionNodes, { id: branchId, title: '精确锚点支线', summary: '验证 Anchor 恢复', status: 'active', kind: 'branch', sourceNodeId: current.activeNodeId, sourceMessageId: eventId, anchorText: '验证事件', x: 620, y: 280, createdAt, updatedAt: createdAt }],
        anchors: [...current.anchors, { id: anchorId, nodeId: current.activeNodeId, messageId: eventId, segmentId: current.segments[0].id, selectedText: '验证事件', startOffset: 3, endOffset: 7, createdAt }],
        discussionEdges: [...current.discussionEdges, { id: edgeId, source: current.activeNodeId, target: branchId, relation: 'derived-from', anchorId, label: '从内容锚点派生', createdAt }],
      }));
      expect(updated.auditEvents.at(-1)).toMatchObject({ action: 'workspace.updated', entityType: 'workspace', metadata: expect.objectContaining({ backend: 'postgres' }) });

      const recovered = await new PostgresWorkspaceStore(database, projectId).read();
      expect(recovered.mode).toBe('Strict');
      expect(recovered.messages.at(-1)).toMatchObject({ id: eventId, text: '持久化验证事件', segmentId: recovered.segments[0].id });
      expect(recovered.anchors).toContainEqual(expect.objectContaining({ id: anchorId, messageId: eventId, selectedText: '验证事件', startOffset: 3, endOffset: 7 }));
      expect(recovered.discussionEdges).toContainEqual(expect.objectContaining({ id: edgeId, target: branchId, anchorId }));
      expect(recovered.auditEvents).toHaveLength(1);
    } finally {
      await database.close();
    }
  });

  it('recovers 1000+ Events in stable database order with indexed access paths', async () => {
    const database = await migratedDatabase();
    try {
      const projectId = randomUUID();
      const store = new PostgresWorkspaceStore(database, projectId);
      const seeded = await store.read();
      await database.query(`
        INSERT INTO rhiza_messages (id, node_id, segment_id, kind, body, created_at)
        SELECT md5($1 || value::text)::uuid, $2, $3, 'user', 'event-' || value, now()
        FROM generate_series(1, 1000) AS value
      `, [projectId, seeded.activeNodeId, seeded.segments[0].id]);

      const recovered = await store.read();
      expect(recovered.messages).toHaveLength(1002);
      expect(recovered.messages.slice(-3).map(event => event.text)).toEqual(['event-998', 'event-999', 'event-1000']);
      const indexes = await database.query<{ indexname: string }>("SELECT indexname FROM pg_indexes WHERE tablename = 'rhiza_messages'");
      expect(indexes.rows.map(row => row.indexname)).toEqual(expect.arrayContaining(['rhiza_messages_node_event_ordinal_key', 'rhiza_messages_node_idx']));
    } finally {
      await database.close();
    }
  });
});
