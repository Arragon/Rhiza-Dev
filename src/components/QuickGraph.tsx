import { ExternalLink, GitBranch, X } from 'lucide-react';
import type { DiscussionEdge, DiscussionNode } from '../types';

export function QuickGraph({ nodes, edges, activeNodeId, onActivate, onOpenFull, onClose }: { nodes: DiscussionNode[]; edges: DiscussionEdge[]; activeNodeId: string; onActivate: (id: string) => Promise<void>; onOpenFull: () => void; onClose: () => void }) {
  const active = nodes.find(node => node.id === activeNodeId);
  const relatedIds = new Set(edges.flatMap(edge => edge.source === activeNodeId ? [edge.target] : edge.target === activeNodeId ? [edge.source] : []));
  if (active?.sourceNodeId) relatedIds.add(active.sourceNodeId);
  for (const node of nodes) if (node.sourceNodeId === activeNodeId) relatedIds.add(node.id);
  const related = nodes.filter(node => relatedIds.has(node.id)).slice(0, 12);
  return <aside className="quick-graph" aria-label="快速图谱">
    <header><div><span className="eyebrow">QUICK GRAPH</span><strong>{active?.title}</strong></div><button aria-label="关闭快速图谱" onClick={onClose}><X size={15}/></button></header>
    <div className="quick-graph-current"><GitBranch size={15}/><span><small>当前讨论</small>{active?.title}</span></div>
    <div className="quick-graph-neighbors">{related.length ? related.map(node => <button key={node.id} onClick={() => void onActivate(node.id)}><i className={node.status}/><span>{node.title}<small>{node.sourceNodeId === activeNodeId ? '子支线' : node.id === active?.sourceNodeId ? '来源节点' : '相关节点'}</small></span></button>) : <p>当前节点还没有相邻讨论。</p>}</div>
    <footer><button onClick={onOpenFull}><ExternalLink size={13}/>打开完整图谱</button><span>{nodes.length} 节点 · {edges.length} 关系</span></footer>
  </aside>;
}
