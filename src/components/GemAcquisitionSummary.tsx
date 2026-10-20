import type { JSONContent } from '@tiptap/core';
import type { ReactNode } from 'react';
import { gemAcquisitionGroups } from '../lib/gem-links';
import { gemDisplayName } from '../lib/gems';

function byVendor(gems: { name: string; vendor: string | null; color: string; quantity: number }[]) {
  const groups = new Map<string, typeof gems>();
  for (const gem of gems) groups.set(gem.vendor ?? '', [...(groups.get(gem.vendor ?? '') ?? []), gem]);
  return [...groups].map(([vendor, names], groupIndex) => <span key={vendor || groupIndex}>
    {groupIndex > 0 && '; '}{vendor && `${vendor}: `}
    {names.map((gem, index): ReactNode => <span key={`${gem.name}:${index}`}>
      {index > 0 && ', '}
      <button type="button" className={`gem gem-${gem.color} gem-acquisition-name`} data-gem-info={gem.name} aria-haspopup="dialog" aria-label={`${gemDisplayName(gem.name)}: gem details`}>{gemDisplayName(gem.name)}</button>{gem.quantity > 1 && <span className="gem-acquisition-count"> ×{gem.quantity}</span>}
    </span>)}
  </span>);
}

export default function GemAcquisitionSummary({ nodes, act, ascendancy = '', league = '' }: { nodes: JSONContent[]; act?: number; ascendancy?: string; league?: string }) {
  const { reward, buy } = gemAcquisitionGroups(nodes, act, ascendancy, league);
  if (!reward.length && !buy.length) return null;
  return <div className="gem-acquisition-summary" aria-label="How to obtain gems">
    {reward.length > 0 && <span><strong>Reward</strong> {byVendor(reward)}</span>}
    {buy.length > 0 && <span><strong>Buy</strong> {byVendor(buy)}</span>}
  </div>;
}
