import type { JSONContent } from '@tiptap/core';
import { gemPurchaseCosts } from '../lib/gem-costs';
import { assetUrl } from '../lib/guide';

export default function GemCostSummary({ nodes, league = '' }: { nodes: JSONContent[]; league?: string }) {
  const { totals, unknown } = gemPurchaseCosts(nodes, league);
  if (!totals.size && !unknown.length) return null;
  const description = [...totals].map(([currency, price]) => `${price.cost} ${currency}`).join(', ');
  return <span className="campaign-gem-cost" aria-label={`Total cost: ${description}${unknown.length ? '; some prices unavailable' : ''}`} title={`Total cost: ${description}${unknown.length ? ` · Price unavailable: ${[...new Set(unknown)].join(', ')}` : ''}`}>
    <span>Cost</span>{[...totals].map(([currency, { cost, icon }]) => <span className="campaign-gem-cost-amount" key={currency}>{cost}<img src={assetUrl(icon)} alt={currency} /></span>)}
    {unknown.length > 0 && <span aria-hidden="true">+ ?</span>}
  </span>;
}
