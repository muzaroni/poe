import type { ReactNode } from 'react';
export default function GemChangeBadge({ kind, children, title }: { title?: string; kind: 'new' | 'removed' | 'moved' | 'swap'; children?: ReactNode }) {
  return <span title={title} className={`gem-change-badge gem-change-${kind}${kind === 'new' ? ' gem-inline-added' : ''}`}>{children ?? ({ new: 'NEW', removed: 'REMOVED', moved: 'MOVED', swap: 'SWAP' }[kind])}</span>;
}
