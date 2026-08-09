import { useRef, useState } from 'react';
import { Focus, Grip, Search } from 'lucide-react';
import type { DiscussionEdge, DiscussionNode } from '../types';

type DragState = { id: string; offsetX: number; offsetY: number; moved: boolean; x: number; y: number };

export function GraphView({ nodes, edges, activeNodeId, onMove, onActivate }: { nodes: DiscussionNode[]; edges: DiscussionEdge[]; activeNodeId: string; onMove: (id: string, x: number, y: number) => Promise<void>; onActivate: (id: string) => Promise<void> }) {
  const canvasRef = useRef<HTMLElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [query, setQuery] = useState('');

  const positionOf = (node: DiscussionNode) => positions[node.id] || { x: node.x, y: node.y };
  const pointerDown = (event: React.PointerEvent<HTMLButtonElement>, node: DiscussionNode) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const position = positionOf(node);
    dragRef.current = { id: node.id, offsetX: event.clientX - rect.left - position.x, offsetY: event.clientY - rect.top - position.y, moved: false, ...position };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;
    const x = Math.max(18, Math.min(rect.width - 166, event.clientX - rect.left - drag.offsetX));
    const y = Math.max(72, Math.min(rect.height - 120, event.clientY - rect.top - drag.offsetY));
    drag.moved = drag.moved || Math.abs(event.movementX) + Math.abs(event.movementY) > 1;
    drag.x = Math.round(x); drag.y = Math.round(y);
    setPositions(current => ({ ...current, [drag.id]: { x: Math.round(x), y: Math.round(y) } }));
  };
  const pointerUp = async (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    // React clears currentTarget after the first await; release capture while it is stable.
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.moved) await onMove(drag.id, drag.x, drag.y);
    else await onActivate(drag.id);
  };

  const filteredNodes = nodes.filter(node => node.title.toLowerCase().includes(query.toLowerCase()));
  const visibleIds = new Set(filteredNodes.map(node => node.id));
  return <main className="workspace graph-view">
    <header className="workspace-header graph-header"><div><span className="eyebrow">CONVERSATION GRAPH</span><h1>项目关系图谱</h1><p>{nodes.length} 个讨论节点 · {edges.length} 条语义关系 · 拖拽可调整并持久保存</p></div><div className="graph-status-key"><span><i className="legend-current"/>当前讨论</span><span><i className="legend-active"/>进行中</span><span><i className="legend-resolved"/>已合并</span></div></header>
    <section className="graph-canvas" aria-label="讨论关系图" ref={canvasRef}>
      <div className="graph-search"><Search size={15}/><input aria-label="搜索图谱" placeholder="在图谱中搜索" value={query} onChange={event => setQuery(event.target.value)}/></div>
      <svg className="edges" width="100%" height="100%" aria-hidden="true">
        {edges.filter(edge => visibleIds.has(edge.source) && visibleIds.has(edge.target)).map(edge => {
          const source = nodes.find(node => node.id === edge.source);
          const target = nodes.find(node => node.id === edge.target);
          if (!source || !target) return null;
          const from = positionOf(source); const to = positionOf(target);
          const sx = from.x + 148; const sy = from.y + 42; const tx = to.x; const ty = to.y + 42; const mid = (sx + tx) / 2;
          return <g key={edge.id} className={`graph-edge ${edge.relation}`}><path d={`M ${sx} ${sy} C ${mid} ${sy}, ${mid} ${ty}, ${tx} ${ty}`}/><text x={mid} y={(sy + ty) / 2 - 7}>{edge.label}</text></g>;
        })}
      </svg>
      {filteredNodes.map(node => {
        const position = positionOf(node);
        return <button className={`graph-node ${node.kind} ${node.status} ${node.id === activeNodeId ? 'current' : ''}`} style={{ left: position.x, top: position.y }} key={node.id} onPointerDown={event => pointerDown(event, node)} onPointerMove={pointerMove} onPointerUp={pointerUp} title="拖拽移动，点击打开讨论">
          <span className="node-kicker">{node.kind === 'main' ? 'MAIN NODE' : 'FORMAL BRANCH'} <Grip size={12}/></span><strong>{node.title}</strong><small>{node.status === 'resolved' ? '已合并回主线' : node.summary}</small><i className="port left"/><i className="port right"/>
        </button>;
      })}
      {filteredNodes.length === 0 && <div className="graph-empty">没有匹配的讨论节点</div>}
      <div className="graph-controls"><button aria-label="聚焦当前节点" onClick={() => { const node = nodes.find(item => item.id === activeNodeId); if (node) setPositions(current => ({ ...current, [node.id]: { x: 350, y: 150 } })); }}><Focus size={16}/></button></div>
      <div className="graph-hint"><span>DRAG</span> 拖动节点调整空间关系 · 点击节点返回对应讨论流</div>
    </section>
  </main>;
}
