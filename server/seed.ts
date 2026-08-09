import type { WorkspaceData } from './domain';

export function createSeedWorkspace(): WorkspaceData {
  const createdAt = new Date().toISOString();
  return {
    projectId: 'rhiza-product-research',
    nodeId: 'information-architecture',
    mode: 'Assisted',
    contextItems: [
      { id: 'c1', title: '研究目标与边界', detail: '目标用户、交付范围与时间约束', role: 'Constraint', status: 'active', tokens: 1840, selectionMode: 'CURRENT' },
      { id: 'c2', title: '访谈发现 · 第 02 轮', detail: '用户对上下文失控的高频反馈', role: 'Fact', status: 'active', tokens: 2360, selectionMode: 'USER_SELECTED' },
      { id: 'c3', title: '竞品模式拆解', detail: '与当前讨论有 86% 语义关联', role: 'Reference', status: 'recommended', tokens: 1120, reason: '当前问题涉及信息架构，该节点包含竞品导航模式的对照结论。' },
      { id: 'c4', title: '早期定价假设', detail: '已被新版商业假设替代', role: 'Decision', status: 'excluded', tokens: 760 },
    ],
    messages: [
      { id: 'm1', nodeId: 'information-architecture', kind: 'user', text: '结合前两轮访谈，我们应该怎样组织产品的首屏信息架构？重点考虑专业用户，但不要让首次进入的人觉得复杂。', createdAt: '2026-08-09T12:00:00.000Z' },
      { id: 'm2', nodeId: 'information-architecture', kind: 'assistant', text: '我建议首屏采用“聚焦工作区 + 渐进式上下文”的双层结构。用户首先进入单一讨论流，项目结构、图谱与状态都作为邻近但不抢占注意力的能力存在。', createdAt: '2026-08-09T12:00:10.000Z' },
    ],
    discussionNodes: [{ id: 'information-architecture', title: '信息架构方向', summary: '探索首屏的内容层级、上下文入口与专业能力的渐进呈现方式。', status: 'active', kind: 'main', x: 350, y: 150, createdAt, updatedAt: createdAt }],
    discussionEdges: [],
    activeNodeId: 'information-architecture',
    manifests: [],
    updatedAt: new Date().toISOString(),
  };
}
