import { render, screen } from '@testing-library/react';
import { MarkdownContent } from './MarkdownContent';

vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), render: vi.fn(async () => ({ svg: '<svg data-testid="diagram-svg"><text>流程</text></svg>' })) } }));

describe('MarkdownContent', () => {
  it('renders GFM tables, task lists and KaTeX formulas', async () => {
    render(<MarkdownContent content={'## 结果\n\n| 项目 | 值 |\n| --- | --- |\n| 置信度 | **0.8** |\n\n- [x] 已验证\n\n公式：$E=mc^2$\n\n$$\\int_0^1 x^2 dx = \\frac{1}{3}$$'} />);
    expect(await screen.findByRole('heading', { name: '结果' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(document.querySelectorAll('.katex')).toHaveLength(2);
  });

  it('renders Mermaid code blocks as diagrams', async () => {
    render(<MarkdownContent content={'```mermaid\ngraph TD\n  A[开始] --> B[结束]\n```'} />);
    expect(await screen.findByRole('img', { name: 'Mermaid 流程图' })).toBeInTheDocument();
    expect(screen.getByTestId('diagram-svg')).toBeInTheDocument();
  });

  it('renders long Markdown, fenced code, blockquotes and wide tables without truncating content', async () => {
    const longTail = '稳定长文本。'.repeat(5_000);
    render(<MarkdownContent content={`> 引用来源\n\n\`\`\`ts\nconst stable = true;\n\`\`\`\n\n| A | B | C | D |\n|---|---|---|---|\n| 1 | 2 | 3 | 4 |\n\n${longTail}`} />);
    expect(await screen.findByText('引用来源')).toBeInTheDocument();
    expect(screen.getByText('const stable = true;')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(document.querySelector('.markdown-content')?.textContent?.endsWith('稳定长文本。')).toBe(true);
  });
});
