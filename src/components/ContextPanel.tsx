import { Check, ChevronDown, EyeOff, FileText, LockKeyhole, MoreHorizontal, Plus, Sparkles, X } from 'lucide-react';
import type { ContextItem, ContextMode, ContextStatus } from '../types';

const sectionTitle: Record<ContextStatus, string> = { active: '有效上下文', recommended: '建议加入', excluded: '已排除' };

export function ContextPanel({ items, mode, onMode, onStatus }: { items: ContextItem[]; mode: ContextMode; onMode: (mode: ContextMode) => void | Promise<void>; onStatus: (id: string, status: ContextStatus) => void | Promise<void> }) {
  const activeTokens = items.filter(i => i.status === 'active').reduce((sum, item) => sum + item.tokens, 0);
  return (
    <aside className="context-panel">
      <header className="panel-header"><div><span className="eyebrow">CONTEXT INSPECTOR</span><h2>本轮上下文</h2></div><button className="icon-button" aria-label="更多上下文操作"><MoreHorizontal size={18}/></button></header>
      <div className="mode-control" aria-label="上下文模式">
        {(['Auto', 'Assisted', 'Strict'] as ContextMode[]).map(option => <button key={option} className={mode === option ? 'active' : ''} onClick={() => onMode(option)}>{option}</button>)}
      </div>
      <div className="budget-card">
        <div className="budget-top"><span>上下文预算</span><strong>{(activeTokens / 1000).toFixed(1)}K <small>/ 32K</small></strong></div>
        <div className="budget-track"><span style={{ width: `${Math.max(6, activeTokens / 320)}%` }} /></div>
        <p>当前输入结构健康，预计保留 83% 原始信息。</p>
      </div>
      <div className="context-scroll">
        {(['active', 'recommended', 'excluded'] as ContextStatus[]).map(status => {
          const list = items.filter(i => i.status === status);
          return list.length ? <section className="context-group" key={status}>
            <div className="context-title"><span>{status === 'recommended' ? <Sparkles size={13}/> : status === 'excluded' ? <EyeOff size={13}/> : <Check size={13}/>} {sectionTitle[status]}</span><small>{list.length}</small></div>
            {list.map(item => <article className={`context-item ${status}`} key={item.id}>
              <div className="context-item-main"><span className="file-icon"><FileText size={14}/></span><div><strong>{item.title}</strong><p>{item.detail}</p><span className={`role ${item.role.toLowerCase()}`}>{item.role}</span><small>{item.tokens.toLocaleString()} tk</small></div></div>
              {item.reason && <div className="why"><Sparkles size={12}/><span>{item.reason}</span></div>}
              <div className="context-actions">
                {status === 'recommended' && <button onClick={() => onStatus(item.id, 'active')}><Plus size={13}/>加入</button>}
                {status === 'active' && <><button title="固定"><LockKeyhole size={13}/></button><button title="排除" onClick={() => onStatus(item.id, 'excluded')}><X size={13}/></button></>}
                {status === 'excluded' && <button onClick={() => onStatus(item.id, 'active')}><Plus size={13}/>恢复</button>}
                <button aria-label="更改角色"><ChevronDown size={13}/></button>
              </div>
            </article>)}
          </section> : null;
        })}
      </div>
    </aside>
  );
}
