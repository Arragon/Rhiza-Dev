import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GraphView } from './GraphView';

const node = { id: 'root', title: '根节点', summary: '根讨论', status: 'active' as const, kind: 'main' as const, x: 320, y: 160, createdAt: '', updatedAt: '' };
const callbacks = () => ({ onMove: vi.fn().mockResolvedValue(undefined), onActivate: vi.fn().mockResolvedValue(undefined), onCreateNode: vi.fn().mockResolvedValue(undefined), onDeleteNode: vi.fn().mockResolvedValue(undefined), onCreateEdge: vi.fn().mockResolvedValue(undefined), onDeleteEdge: vi.fn().mockResolvedValue(undefined) });

describe('GraphView', () => {
  it('zooms the graph and creates a node from the graph toolbar', async () => {
    const handlers = callbacks();
    render(<GraphView nodes={[node]} edges={[]} activeNodeId="root" {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: '放大图谱' }));
    expect(screen.getByLabelText('当前缩放比例')).toHaveTextContent('110%');
    fireEvent.click(screen.getByRole('button', { name: '新建图谱节点' }));
    fireEvent.change(screen.getByLabelText('节点标题'), { target: { value: '新节点' } });
    fireEvent.change(screen.getByLabelText('摘要（可选）'), { target: { value: '节点摘要' } });
    fireEvent.click(screen.getByRole('button', { name: '创建节点' }));
    await waitFor(() => expect(handlers.onCreateNode).toHaveBeenCalledWith(expect.objectContaining({ title: '新节点', summary: '节点摘要' })));
  });

  it('opens node deletion confirmation and removes a leaf node', async () => {
    const handlers = callbacks();
    render(<GraphView nodes={[node]} edges={[]} activeNodeId="root" {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: '删除节点 根节点' }));
    expect(screen.getByRole('alertdialog', { name: '删除图谱节点' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    await waitFor(() => expect(handlers.onDeleteNode).toHaveBeenCalledWith('root'));
  });

  it('keeps 300 nodes navigable through search, focus and fit view', () => {
    const nodes = Array.from({ length: 300 }, (_, index) => ({ ...node, id: `node-${index}`, title: `讨论 ${index}`, summary: index === 287 ? '唯一检索目标' : '规模测试', x: (index % 20) * 100, y: Math.floor(index / 20) * 80 }));
    render(<GraphView nodes={nodes} edges={[]} activeNodeId="node-287" {...callbacks()} />);
    expect(screen.getAllByRole('button', { name: /讨论节点/ })).toHaveLength(300);
    fireEvent.change(screen.getByLabelText('搜索图谱'), { target: { value: '唯一检索目标' } });
    expect(screen.getAllByRole('button', { name: /讨论节点/ })).toHaveLength(1);
    fireEvent.keyDown(screen.getByLabelText('搜索图谱'), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: '适合全部节点' }));
    expect(screen.getByLabelText('图谱概览').querySelectorAll('i')).toHaveLength(300);
  });
});
