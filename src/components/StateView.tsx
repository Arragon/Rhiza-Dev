import { ArrowUpRight, CheckCircle2, CircleDashed, Clock3, FileText, ShieldCheck } from 'lucide-react';

const sections = [
  { title: '已确认事实', icon: CheckCircle2, tone: 'fact', items: ['专业用户需要跨轮次追踪信息来源', '首屏默认体验应接近普通对话'] },
  { title: '项目约束', icon: ShieldCheck, tone: 'constraint', items: ['MVP 不接入真实模型服务', '视觉系统必须支持低成本换肤'] },
  { title: '当前决策', icon: FileText, tone: 'decision', items: ['采用三栏桌面工作台与移动端抽屉', 'Assisted 作为专业模式默认值'] },
  { title: '开放问题', icon: CircleDashed, tone: 'question', items: ['用户何时会主动进入 Graph？', 'Context 推荐解释需要多详细？'] },
];

export function StateView() {
  return <main className="workspace state-view"><header className="workspace-header"><div><span className="eyebrow">PROJECT STATE</span><h1>当前有效知识</h1><p>这里保存“现在什么是有效的”，每一项都保留来源与版本。</p></div><button className="primary-button">+ 添加状态</button></header>
    <div className="state-summary"><div><strong>10</strong><span>有效状态项</span></div><div><strong>2</strong><span>开放问题</span></div><div><strong>1</strong><span>需要复核</span></div><div className="sync-status"><Clock3 size={15}/><span>最后更新于刚刚</span></div></div>
    <div className="state-grid">{sections.map(section => <section className={`state-card ${section.tone}`} key={section.title}><header><span><section.icon size={16}/>{section.title}</span><small>{section.items.length}</small></header>{section.items.map((item, index) => <article key={item}><div><strong>{item}</strong><p>来自「{index ? '研究框架' : '信息架构方向'}」· 第 {index + 2} 轮</p></div><button aria-label="查看来源"><ArrowUpRight size={15}/></button></article>)}</section>)}</div>
  </main>;
}
