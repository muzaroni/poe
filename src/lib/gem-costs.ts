import type { JSONContent } from '@tiptap/core';
import { gemVendorCost } from './gem-vendor';

export function gemPurchaseCosts(nodes: JSONContent[], league = '') {
    const totals = new Map<string, { cost: number; icon: string }>();
    const unknown: string[] = [];
    let hasGems = false;
    function visit(node: JSONContent) {
      if (node.type === 'gem') {
        hasGems = true;
        if (node.attrs?.acquisition === 'buy' && node.attrs?.acquisitionFirst === true) {
          const name = String(node.attrs.name ?? '');
          const price = gemVendorCost(name, league);
          if (!price) unknown.push(name);
          else totals.set(price.currency, { cost: (totals.get(price.currency)?.cost ?? 0) + price.cost, icon: price.icon });
        }
      }
      node.content?.forEach(visit);
    }
    nodes.forEach(visit);
    return { totals, unknown, hasGems };
}

// Pricing content has acquisition inheritance resolved; preserve the author's gem nodes.
export function withGemCosts(setup: JSONContent, pricing = setup, league = ''): JSONContent {
  const sections: { nodes: JSONContent[]; prices: JSONContent[] }[] = [];
  (setup.content ?? []).forEach((node, index) => {
    if (!sections.length || node.type === 'heading') sections.push({ nodes: [], prices: [] });
    sections.at(-1)!.nodes.push(node);
    sections.at(-1)!.prices.push(pricing.content?.[index] ?? node);
  });
  return { ...setup, content: sections.flatMap(({ nodes, prices }) => {
    const { totals, unknown, hasGems } = gemPurchaseCosts(prices, league);
    if (!hasGems) return nodes;
    const content: JSONContent[] = [{ type: 'text', text: 'Total Cost: ' }];
    for (const [currency, { cost, icon }] of totals) {
      if (content.length > 1) content.push({ type: 'text', text: ', ' });
      content.push({ type: 'text', text: `${cost} ` }, { type: 'icon', attrs: { src: icon, name: currency } }, { type: 'text', text: ` ${currency}` });
    }
    if (!totals.size) content.push({ type: 'text', text: unknown.length ? 'Unknown' : 'None' });
    if (unknown.length) content.push({ type: 'text', text: ` (price unavailable: ${[...new Set(unknown)].join(', ')})` });
    const total = { type: 'paragraph', content };
    const isTotal = (node: JSONContent) => node.type === 'paragraph' && /^\s*Total Cost\s*:/i.test(node.content?.map(child => child.text ?? '').join('') ?? '');
    let replaced = false;
    const result = nodes.flatMap(node => {
      if (!isTotal(node)) return [node];
      if (replaced) return [];
      replaced = true;
      return [total];
    });
    if (!replaced) result.push(total);
    return result;
  }) };
}
