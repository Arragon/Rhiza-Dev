import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, AtSign, BookmarkPlus, Check, ChevronRight, FilePlus2, GitBranch, GitMerge, Link2, Paperclip, Send, Sparkles, TextSelect, Trash2, X } from 'lucide-react';
import type { ContextMode, DiscussionNode, Message, ProviderCatalog, ProviderStatus, TemporaryBranch } from '../types';
import { ParticleMark } from './ParticleMark';
import { ModelSelector } from './ModelSelector';
import { MarkdownContent } from './MarkdownContent';

type TemporaryInput = { sourceNodeId: string; anchorText: string; message: string; history: Array<Pick<Message, 'kind' | 'text'>> };
type BranchInput = { title: string; anchorText?: string; sourceMessageId?: string; messages?: Array<Pick<Message, 'kind' | 'text' | 'createdAt'>> };
type SelectionAction = { message: Message; text: string; x: number; y: number };

function nodePath(node: DiscussionNode, nodes: DiscussionNode[]) {
  const byId = new Map(nodes.map(item => [item.id, item]));
  const path: DiscussionNode[] = [];
  const visited = new Set<string>();
  let cursor: DiscussionNode | undefined = node;
  while (cursor && !visited.has(cursor.id) && path.length < 50) {
    path.unshift(cursor); visited.add(cursor.id); cursor = cursor.sourceNodeId ? byId.get(cursor.sourceNodeId) : undefined;
  }
  return path;
}

export function ChatView({ activeNode, nodes, mode, activeCount, messages, provider, providerCatalog, syncError, onSend, onTempSend, onCreateBranch, onMerge, onSelectModel, onSettings, onOpenContext, onGraph }: { activeNode: DiscussionNode; nodes: DiscussionNode[]; mode: ContextMode; activeCount: number; messages: Message[]; provider: ProviderStatus; providerCatalog: ProviderCatalog; syncError: string; onSend: (text: string) => Promise<void>; onTempSend: (input: TemporaryInput) => Promise<{ userMessage: Message; assistantMessage: Message; model: string }>; onCreateBranch: (input: BranchInput) => Promise<void>; onMerge: (id: string) => Promise<void>; onSelectModel: (id: string) => Promise<void>; onSettings: () => void; onOpenContext: () => void; onGraph: () => void }) {
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [chatError, setChatError] = useState('');
  const [selectionAction, setSelectionAction] = useState<SelectionAction | null>(null);
  const [temporary, setTemporary] = useState<TemporaryBranch | null>(null);
  const [tempDraft, setTempDraft] = useState('');
  const [tempThinking, setTempThinking] = useState(false);
  const [tempError, setTempError] = useState('');
  const [preserving, setPreserving] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const tempEndRef = useRef<HTMLDivElement>(null);
  const path = useMemo(() => nodePath(activeNode, nodes), [activeNode, nodes]);
  const compactPath = path.length <= 3 ? path : [path[0], null, ...path.slice(-2)];
  const hasStreamingAnswer = messages.some(message => message.kind === 'assistant' && message.pending && message.text);

  useEffect(() => { if (typeof endRef.current?.scrollIntoView === 'function') endRef.current.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking]);
  useEffect(() => { if (typeof tempEndRef.current?.scrollIntoView === 'function') tempEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [temporary?.messages, tempThinking]);

  const send = async () => {
    const text = draft.trim();
    if (!text || thinking) return;
    setDraft(''); setThinking(true); setChatError('');
    try { await onSend(text); } catch (error) { setDraft(text); setChatError(error instanceof Error ? error.message : 'AI 请求失败'); } finally { setThinking(false); }
  };

  const openTemporary = (message: Message, anchorText: string) => {
    const normalized = anchorText.trim().slice(0, 4000);
    if (!normalized) return;
    setTemporary({ id: `temp-${Date.now()}`, sourceNodeId: activeNode.id, sourceMessageId: message.id, anchorText: normalized, title: `探索：${normalized.replace(/\s+/g, ' ').slice(0, 22)}`, messages: [] });
    setSelectionAction(null); setTempDraft(''); setTempError('');
    window.getSelection()?.removeAllRanges();
  };

  const captureSelection = (event: React.MouseEvent<HTMLElement>, message: Message) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.anchorNode || !event.currentTarget.contains(selection.anchorNode)) return;
    const text = selection.toString().trim();
    if (text.length < 2) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    setSelectionAction({ message, text, x: Math.min(rect.left + rect.width / 2, window.innerWidth - 90), y: Math.max(12, rect.top - 42) });
  };

  const sendTemp = async () => {
    if (!temporary || !tempDraft.trim() || tempThinking) return;
    const text = tempDraft.trim(); setTempDraft(''); setTempThinking(true); setTempError('');
    try {
      const result = await onTempSend({ sourceNodeId: temporary.sourceNodeId, anchorText: temporary.anchorText, message: text, history: temporary.messages.map(({ kind, text: messageText }) => ({ kind, text: messageText })) });
      setTemporary(current => current ? { ...current, messages: [...current.messages, result.userMessage, result.assistantMessage] } : current);
    } catch (error) { setTempDraft(text); setTempError(error instanceof Error ? error.message : '临时对话请求失败'); } finally { setTempThinking(false); }
  };

  const preserveTemporary = async () => {
    if (!temporary || !temporary.title.trim()) return;
    setPreserving(true); setTempError('');
    try {
      await onCreateBranch({ title: temporary.title.trim(), anchorText: temporary.anchorText, sourceMessageId: temporary.sourceMessageId, messages: temporary.messages.map(({ kind, text, createdAt }) => ({ kind, text, createdAt })) });
      setTemporary(null);
    } catch (error) { setTempError(error instanceof Error ? error.message : '支线保留失败'); } finally { setPreserving(false); }
  };

  return (
    <main className={`workspace chat-view ${temporary ? 'temp-branch-open' : ''}`}>
      <header className="workspace-header"><div><div className="crumbs node-breadcrumb">{compactPath.map((node, index) => node ? <span key={node.id}>{node.title}{index < compactPath.length - 1 && <ChevronRight size={12}/>}</span> : <span className="path-ellipsis" key="ellipsis">…<ChevronRight size={12}/></span>)}</div><h1>{activeNode.title} <span className={`node-state ${activeNode.status}`}><i/> {activeNode.status}</span></h1></div><div className="header-actions">{activeNode.kind === 'branch' && activeNode.status !== 'resolved' && <button className="ghost-button merge-button" onClick={() => onMerge(activeNode.id)}><GitMerge size={15}/>合并回主线</button>}<button className="ghost-button" onClick={onGraph}><GitBranch size={15}/>查看关系</button><button className="context-chip" onClick={onOpenContext}><span className="context-orb"/>{activeCount} 项上下文 <ChevronRight size={14}/></button></div></header>
      <div className="conversation" onScroll={() => setSelectionAction(null)}>
        <div className="conversation-intro"><span className="round-index">{String(messages.filter(message => message.kind === 'user').length).padStart(2, '0')}</span><div><span className="eyebrow">{activeNode.kind === 'branch' ? `FORMAL BRANCH · LEVEL ${path.length}` : 'DISCUSSION NODE'}</span><h2>{activeNode.title}</h2><p>{activeNode.summary}</p>{activeNode.anchorText && <blockquote className="branch-anchor"><span>来源锚点</span>{activeNode.anchorText}</blockquote>}</div></div>
        <div className="timeline">
          {messages.map((message, index) => message.kind === 'user' ? (
            <article className="message user-message" key={message.id}><div className="message-meta"><span>YOU</span><time>第 {Math.floor(index / 2) + 1} 轮</time></div><MarkdownContent content={message.text}/></article>
          ) : (
            <article className="message assistant-message selectable-answer" key={message.id} onMouseUp={event => captureSelection(event, message)}>
              <div className="assistant-head"><ParticleMark compact/><span>RHIZA</span><small>基于 {activeCount} 项 Active Context</small></div>
              <div className="answer-paragraph"><MarkdownContent content={message.text}/><button className="paragraph-branch" aria-label="讨论整个段落" title="将整段放入临时支线" onClick={() => openTemporary(message, message.text)}><TextSelect size={14}/></button></div>
              {activeNode.kind === 'main' && index === 1 && <div className="answer-grid"><section><span className="answer-number">01</span><h3>默认保持单线聚焦</h3><p>中间区域只承载当前讨论。导航、上下文和状态采用可收起的邻接面板，复杂度随意图展开。</p></section><section><span className="answer-number">02</span><h3>让系统状态始终可见</h3><p>用轻量标签持续展示节点生命周期、引用来源与 Context Budget，而不是等用户出错后再解释。</p></section><section><span className="answer-number">03</span><h3>先临时探索，再决定保留</h3><p>划线或选中段落后在当前讨论旁打开临时对话；有价值时才固化为正式节点。</p></section></div>}
              <div className="message-actions"><button onClick={() => openTemporary(message, message.text)}><GitBranch size={14}/>在临时支线中讨论</button><button><Link2 size={14}/>保存为引用</button><button><Check size={14}/>提取为状态</button></div>
              {message.manifestId && <div className="branch-note"><span className="branch-line"/><GitMerge size={14}/><span>Context Manifest · {message.manifestId.slice(0, 8)}</span></div>}
            </article>
          ))}
          {thinking && !hasStreamingAnswer && <div className="thinking"><ParticleMark compact/><span>正在组织上下文</span><i/><i/><i/></div>}
          <div ref={endRef}/>
        </div>
      </div>
      {selectionAction && <button className="selection-branch-action" style={{ left: selectionAction.x, top: selectionAction.y }} onMouseDown={event => event.preventDefault()} onClick={() => openTemporary(selectionAction.message, selectionAction.text)}><GitBranch size={13}/>讨论选中内容</button>}
      {temporary && <aside className="temporary-branch" aria-label="临时支线">
        <header><div><span className="temp-status"><i/> TEMP · 未保存</span><input aria-label="临时支线标题" value={temporary.title} onChange={event => setTemporary(current => current ? { ...current, title: event.target.value } : current)}/></div><button aria-label="丢弃临时支线" onClick={() => setTemporary(null)}><X size={16}/></button></header>
        <blockquote><span>选中内容</span>{temporary.anchorText}</blockquote>
        <div className="temp-thread">{temporary.messages.length === 0 && <div className="temp-empty"><GitBranch size={18}/><strong>这是临时探索空间</strong><p>对话只存在于当前页面；点击“保留”后才会进入节点树与对话图谱。</p></div>}{temporary.messages.map(message => <article className={`temp-message ${message.kind}`} key={message.id}><span>{message.kind === 'user' ? 'YOU' : 'RHIZA'}</span><MarkdownContent content={message.text}/></article>)}{tempThinking && <div className="thinking"><ParticleMark compact/><span>沿锚点继续思考</span><i/><i/><i/></div>}<div ref={tempEndRef}/></div>
        {tempError && <div className="temp-error" role="alert">{tempError}</div>}
        <div className="temp-composer"><textarea aria-label="临时支线消息" rows={2} value={tempDraft} onChange={event => setTempDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendTemp(); } }} placeholder="围绕选中内容追问…"/><button aria-label="发送临时消息" onClick={sendTemp} disabled={!tempDraft.trim() || tempThinking || !provider.configured}><Send size={15}/></button></div>
        <footer><button className="discard-temp" onClick={() => setTemporary(null)}><Trash2 size={14}/>丢弃</button><button className="keep-temp" onClick={preserveTemporary} disabled={!temporary.title.trim() || preserving}><BookmarkPlus size={14}/>{preserving ? '保留中…' : '保留为讨论流'}</button></footer>
      </aside>}
      <div className="composer-wrap">
        {(chatError || syncError) && <div className="composer-error" role="alert">{chatError || syncError}</div>}
        <div className="composer"><textarea aria-label="输入消息" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="继续这段讨论…" rows={2}/><div className="composer-tools"><div><button aria-label="添加附件"><Paperclip size={16}/></button><button aria-label="引用节点"><AtSign size={16}/></button><button aria-label="添加文件"><FilePlus2 size={16}/></button></div><div className="send-side"><ModelSelector catalog={providerCatalog} onSelect={onSelectModel} onSettings={onSettings}/><span className={provider.configured ? 'provider-online' : 'provider-offline'}><Sparkles size={13}/>{provider.configured ? 'Ready' : '未连接'} · {mode} · {activeCount} sources</span><button className="send-button" onClick={send} disabled={!draft.trim() || thinking || !provider.configured} aria-label="发送"><ArrowUp size={17}/></button></div></div></div>
        <p className="composer-caption"><span className="live-dot"/> Rhiza Domain 将冻结上下文，再交由 AI Runtime 执行</p>
      </div>
    </main>
  );
}
