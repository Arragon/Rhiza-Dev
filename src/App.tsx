import { useEffect, useState } from 'react';
import { initialContext } from './data';
import type { ContextMode, ContextStatus, DiscussionEdge, DiscussionNode, Message, ProviderCatalog, ProviderPresetInfo, ProviderStatus, View, WorkspaceSnapshot } from './types';
import { api } from './api';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { GraphView } from './components/GraphView';
import { StateView } from './components/StateView';
import { ContextPanel } from './components/ContextPanel';
import { ProviderSettings, type ProviderFormState } from './components/ProviderSettings';

export function App() {
  const initialNode: DiscussionNode = { id: 'information-architecture', title: '信息架构方向', summary: '探索首屏的内容层级、上下文入口与专业能力的渐进呈现方式。', status: 'active', kind: 'main', x: 350, y: 150, createdAt: '2026-08-09T12:00:00.000Z', updatedAt: '2026-08-09T12:00:00.000Z' };
  const [view, setView] = useState<View>('chat');
  const [contextItems, setContextItems] = useState(initialContext);
  const [mode, setMode] = useState<ContextMode>('Assisted');
  const [messages, setMessages] = useState<Message[]>([
    { id: 'm1', nodeId: initialNode.id, kind: 'user', text: '结合前两轮访谈，我们应该怎样组织产品的首屏信息架构？重点考虑专业用户，但不要让首次进入的人觉得复杂。', createdAt: '2026-08-09T12:00:00.000Z' },
    { id: 'm2', nodeId: initialNode.id, kind: 'assistant', text: '我建议首屏采用“聚焦工作区 + 渐进式上下文”的双层结构。用户首先进入单一讨论流，项目结构、图谱与状态都作为邻近但不抢占注意力的能力存在。', createdAt: '2026-08-09T12:00:10.000Z' },
  ]);
  const [discussionNodes, setDiscussionNodes] = useState<DiscussionNode[]>([initialNode]);
  const [discussionEdges, setDiscussionEdges] = useState<DiscussionEdge[]>([]);
  const [activeNodeId, setActiveNodeId] = useState(initialNode.id);
  const [provider, setProvider] = useState<ProviderStatus>({ configured: false, name: 'OpenAI-compatible', model: '未配置', baseUrl: '' });
  const [providerCatalog, setProviderCatalog] = useState<ProviderCatalog>({ providers: [], models: [], activeModelId: null });
  const [providerPresets, setProviderPresets] = useState<Record<string, ProviderPresetInfo>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [contextOpen, setContextOpen] = useState(false);

  const applyWorkspace = (workspace: WorkspaceSnapshot) => {
    setContextItems(workspace.contextItems);
    setMessages(workspace.messages);
    setMode(workspace.mode);
    setDiscussionNodes(workspace.discussionNodes);
    setDiscussionEdges(workspace.discussionEdges);
    setActiveNodeId(workspace.activeNodeId);
  };

  useEffect(() => {
    api.getWorkspace().then(({ workspace, provider: providerStatus, providerCatalog: catalog }) => {
      applyWorkspace(workspace);
      setProvider(providerStatus);
      setProviderCatalog(catalog);
      setSyncError('');
    }).catch(error => setSyncError(error instanceof Error ? error.message : '无法连接后端'));
  }, []);

  const applyCatalog = (catalog: ProviderCatalog) => {
    setProviderCatalog(catalog);
    const activeModel = catalog.models.find(model => model.id === catalog.activeModelId);
    const activeProvider = catalog.providers.find(item => item.id === activeModel?.providerId);
    setProvider({ configured: Boolean(activeModel && activeProvider?.configured), name: activeProvider?.name || '未配置供应商', model: activeModel?.displayName || '未选择模型', baseUrl: activeProvider?.baseUrl || '' });
  };

  const openSettings = async () => {
    setSettingsOpen(true);
    try {
      const { catalog, presets } = await api.getProviders();
      applyCatalog(catalog);
      setProviderPresets(presets);
    } catch (error) { setSyncError(error instanceof Error ? error.message : '模型配置加载失败'); }
  };

  const saveProvider = async (form: ProviderFormState) => {
    const { catalog } = await api.saveProvider(form);
    applyCatalog(catalog);
  };
  const discoverModels = async (providerId: string) => { const { catalog } = await api.discoverModels(providerId); applyCatalog(catalog); };
  const updateModel = async (modelId: string, changes: { favorite?: boolean; pinned?: boolean }) => { const { catalog } = await api.updateModel(modelId, changes); applyCatalog(catalog); };
  const selectModel = async (modelId: string) => { const result = await api.selectModel(modelId); setProviderCatalog(result.catalog); setProvider(result.provider); };

  const updateStatus = async (id: string, status: ContextStatus) => {
    const previous = contextItems;
    setContextItems(items => items.map(item => item.id === id ? { ...item, status } : item));
    try {
      const { workspace } = await api.setContextStatus(id, status);
      setContextItems(workspace.contextItems);
      setSyncError('');
    } catch (error) {
      setContextItems(previous);
      setSyncError(error instanceof Error ? error.message : 'Context 保存失败');
    }
  };

  const updateMode = async (nextMode: ContextMode) => {
    const previous = mode;
    setMode(nextMode);
    try {
      await api.setMode(nextMode);
      setSyncError('');
    } catch (error) {
      setMode(previous);
      setSyncError(error instanceof Error ? error.message : '模式保存失败');
    }
  };

  const sendMessage = async (text: string) => {
    const pendingId = `pending-${Date.now()}`;
    const pendingAssistantId = `${pendingId}-assistant`;
    const pending: Message = { id: pendingId, nodeId: activeNodeId, kind: 'user', text, createdAt: new Date().toISOString(), pending: true };
    const pendingAssistant: Message = { id: pendingAssistantId, nodeId: activeNodeId, kind: 'assistant', text: '', createdAt: new Date().toISOString(), pending: true };
    setMessages(current => [...current, pending]);
    try {
      const result = await api.streamMessage(text, event => {
        if (event.type !== 'CONTENT_DELTA') return;
        setMessages(current => current.some(message => message.id === pendingAssistantId)
          ? current.map(message => message.id === pendingAssistantId ? { ...message, text: message.text + event.delta } : message)
          : [...current, { ...pendingAssistant, text: event.delta }]);
      });
      setMessages(current => [...current.filter(message => message.id !== pendingId && message.id !== pendingAssistantId), result.userMessage, result.assistantMessage]);
      setSyncError('');
    } catch (error) {
      setMessages(current => current.filter(message => message.id !== pendingAssistantId).map(message => message.id === pendingId ? { ...message, pending: false } : message));
      throw error;
    }
  };
  const createBranch = async (input: { title: string; anchorText?: string; sourceMessageId?: string; messages?: Array<Pick<Message, 'kind' | 'text' | 'createdAt'>> }) => {
    const { workspace } = await api.createBranch(input);
    applyWorkspace(workspace);
    setView('chat');
    setSyncError('');
  };
  const sendTemporaryMessage = async (input: { sourceNodeId: string; anchorText: string; message: string; history: Array<Pick<Message, 'kind' | 'text'>> }) => api.sendTemporaryMessage(input);
  const activateNode = async (id: string, openChat = false) => {
    const { workspace } = await api.activateNode(id);
    applyWorkspace(workspace);
    if (openChat) setView('chat');
  };
  const moveNode = async (id: string, x: number, y: number) => {
    const previous = discussionNodes;
    setDiscussionNodes(nodes => nodes.map(node => node.id === id ? { ...node, x, y } : node));
    try {
      const { workspace } = await api.moveNode(id, x, y);
      applyWorkspace(workspace);
    } catch (error) {
      setDiscussionNodes(previous);
      setSyncError(error instanceof Error ? error.message : '节点位置保存失败');
    }
  };
  const createGraphNode = async (input: { title: string; summary?: string; x: number; y: number }) => {
    const { workspace } = await api.createGraphNode(input);
    applyWorkspace(workspace);
    setSyncError('');
  };
  const deleteGraphNode = async (id: string) => {
    const { workspace } = await api.deleteGraphNode(id);
    applyWorkspace(workspace);
    setSyncError('');
  };
  const createGraphEdge = async (input: { source: string; target: string; relation: 'derived-from' | 'references' | 'merged-into'; label: string }) => {
    const { workspace } = await api.createGraphEdge(input);
    applyWorkspace(workspace);
    setSyncError('');
  };
  const deleteGraphEdge = async (id: string) => {
    const { workspace } = await api.deleteGraphEdge(id);
    applyWorkspace(workspace);
    setSyncError('');
  };
  const mergeNode = async (id: string) => {
    const { workspace } = await api.mergeNode(id);
    applyWorkspace(workspace);
    setView('chat');
  };
  const activeCount = contextItems.filter(item => item.status === 'active').length;
  const activeNode = discussionNodes.find(node => node.id === activeNodeId) || discussionNodes[0] || initialNode;
  const activeMessages = messages.filter(message => message.nodeId === activeNode.id);

  return <div className={`app-shell ${contextOpen ? 'context-open' : ''}`}>
    <div className="ambient-grid" aria-hidden="true"/>
    <Sidebar view={view} nodes={discussionNodes} messages={messages} activeNodeId={activeNode.id} onView={setView} onNode={id => activateNode(id, true)} onSettings={openSettings}/>
    {view === 'chat' && <ChatView activeNode={activeNode} nodes={discussionNodes} mode={mode} activeCount={activeCount} messages={activeMessages} provider={provider} providerCatalog={providerCatalog} syncError={syncError} onSend={sendMessage} onTempSend={sendTemporaryMessage} onCreateBranch={createBranch} onMerge={mergeNode} onSelectModel={selectModel} onSettings={openSettings} onOpenContext={() => setContextOpen(open => !open)} onGraph={() => setView('graph')}/>} 
    {view === 'graph' && <GraphView nodes={discussionNodes} edges={discussionEdges} activeNodeId={activeNode.id} onMove={moveNode} onActivate={id => activateNode(id, true)} onCreateNode={createGraphNode} onDeleteNode={deleteGraphNode} onCreateEdge={createGraphEdge} onDeleteEdge={deleteGraphEdge}/>}
    {view === 'state' && <StateView/>}
    <div className="context-backdrop" onClick={() => setContextOpen(false)}/>
    <ContextPanel items={contextItems} mode={mode} onMode={updateMode} onStatus={updateStatus}/>
    {settingsOpen && <ProviderSettings catalog={providerCatalog} presets={providerPresets} onClose={() => setSettingsOpen(false)} onSave={saveProvider} onDiscover={discoverModels} onToggleModel={updateModel} onSelectModel={selectModel}/>} 
  </div>;
}
