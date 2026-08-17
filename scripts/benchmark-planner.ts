import { planContext } from '../server/context-planner';
import type { DiscussionNode } from '../server/domain';
import { createSeedWorkspace } from '../server/seed';

const runs = 50;
const results = [10, 100, 300].map(nodeCount => {
  const workspace = createSeedWorkspace();
  workspace.contextItems = [];
  workspace.discussionNodes = Array.from({ length: nodeCount }, (_, index): DiscussionNode => ({
    id: `node-${index}`, title: `Research node ${index}`,
    summary: index % 17 === 0 ? 'Payment idempotency, transaction boundaries and outbox evidence' : `Product research material ${index}`,
    status: 'active', kind: index ? 'branch' : 'main', x: index, y: index,
    createdAt: workspace.updatedAt, updatedAt: workspace.updatedAt,
  }));
  workspace.activeNodeId = 'node-0';
  workspace.nodeId = 'node-0';
  workspace.messages = workspace.discussionNodes.map((node, index) => ({ id: `message-${index}`, nodeId: node.id, kind: 'assistant' as const, text: node.summary.repeat(4), createdAt: workspace.updatedAt }));
  const samples = Array.from({ length: runs }, () => planContext(workspace, 'How should payment transaction idempotency work?').diagnostics.elapsedMs).sort((a, b) => a - b);
  return { nodes: nodeCount, runs, p50Ms: Number(samples[Math.floor(runs * 0.5)].toFixed(2)), p95Ms: Number(samples[Math.floor(runs * 0.95) - 1].toFixed(2)), maxMs: Number(samples.at(-1)!.toFixed(2)) };
});

console.table(results);
const hundred = results.find(result => result.nodes === 100)!;
if (hundred.p95Ms >= 2_000) throw new Error(`100-node Planner P95 ${hundred.p95Ms}ms exceeds the 2,000ms M5 target.`);
