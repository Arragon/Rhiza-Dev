import { lazy, Suspense } from 'react';

const MarkdownRenderer = lazy(() => import('./MarkdownRenderer').then(module => ({ default: module.MarkdownRenderer })));

export function MarkdownContent({ content }: { content: string }) {
  return <Suspense fallback={<div className="markdown-content markdown-loading" role="status">{content}</div>}>
    <MarkdownRenderer content={content}/>
  </Suspense>;
}
