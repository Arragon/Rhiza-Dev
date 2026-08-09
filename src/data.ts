import type { ContextItem } from './types';

export const initialContext: ContextItem[] = [
  { id: 'c1', title: '研究目标与边界', detail: '目标用户、交付范围与时间约束', role: 'Constraint', status: 'active', tokens: 1840 },
  { id: 'c2', title: '访谈发现 · 第 02 轮', detail: '用户对上下文失控的高频反馈', role: 'Fact', status: 'active', tokens: 2360 },
  { id: 'c3', title: '竞品模式拆解', detail: '与当前讨论有 86% 语义关联', role: 'Reference', status: 'recommended', tokens: 1120, reason: '当前问题涉及信息架构，该节点包含竞品导航模式的对照结论。' },
  { id: 'c4', title: '早期定价假设', detail: '已被新版商业假设替代', role: 'Decision', status: 'excluded', tokens: 760 },
];

export const graphNodes = [
  { id: 'n1', label: '研究框架', meta: '已确认 · 8 轮', x: 46, y: 44, tone: 'sage' },
  { id: 'n2', label: '用户访谈洞察', meta: '进行中 · 12 轮', x: 270, y: 34, tone: 'blue' },
  { id: 'n3', label: '竞品模式拆解', meta: '已解决 · 6 轮', x: 276, y: 210, tone: 'sand' },
  { id: 'n4', label: '信息架构方向', meta: '当前节点 · 5 轮', x: 505, y: 112, tone: 'active' },
  { id: 'n5', label: 'MVP 验证计划', meta: '草稿 · 3 轮', x: 726, y: 54, tone: 'violet' },
  { id: 'n6', label: '待验证假设', meta: '存在冲突 · 2 轮', x: 728, y: 230, tone: 'rose' },
];
