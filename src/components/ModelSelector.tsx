import { Check, ChevronDown, Pin, Settings2, Star } from 'lucide-react';
import { useState } from 'react';
import type { ProviderCatalog } from '../types';

export function ModelSelector({ catalog, onSelect, onSettings }: { catalog: ProviderCatalog; onSelect: (id: string) => Promise<void>; onSettings: () => void }) {
  const [open, setOpen] = useState(false);
  const active = catalog.models.find(model => model.id === catalog.activeModelId);
  const providerName = catalog.providers.find(provider => provider.id === active?.providerId)?.name;
  return <div className="model-selector">
    <button className="model-trigger" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label="选择模型">
      <span><small>{providerName || '供应商'}</small><strong>{active?.displayName || '选择模型'}</strong></span><ChevronDown size={13}/>
    </button>
    {open && <div className="model-menu">
      <header><span>本轮模型</span><button onClick={() => { setOpen(false); onSettings(); }}><Settings2 size={13}/>管理</button></header>
      <div className="model-menu-list">{catalog.models.length ? catalog.models.map(model => {
        const provider = catalog.providers.find(item => item.id === model.providerId);
        return <button className={model.id === catalog.activeModelId ? 'model-option active' : 'model-option'} key={model.id} onClick={async () => { await onSelect(model.id); setOpen(false); }}>
          <span className="model-flags">{model.pinned && <Pin size={11}/>} {model.favorite && <Star size={11} fill="currentColor"/>}</span>
          <span><strong>{model.displayName}</strong><small>{provider?.name} · {model.modelId}</small></span>{model.id === catalog.activeModelId && <Check size={14}/>} 
        </button>;
      }) : <div className="model-empty">还没有模型，请先配置供应商。</div>}</div>
    </div>}
  </div>;
}
