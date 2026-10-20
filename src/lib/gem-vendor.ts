import type { JSONContent } from '@tiptap/core';

type Price = { name: string; requiredLevel: number | null; cost: number | null; currency: string | null };
type PriceCache = { league: string; gems: Price[] };
const caches = import.meta.glob('../data/gem-vendors/*.json', { eager: true, import: 'default' }) as Record<string, PriceCache>;
const byLeague = new Map(Object.values(caches).map(cache => [cache.league, new Map(cache.gems.map(gem => [gem.name.toLowerCase(), gem]))]));
const latestLeague = [...byLeague.keys()].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
const currencyIcons: Record<string, string> = {
  'Scroll of Wisdom': '/images/sunder-rf/wisdom.png',
  'Orb of Transmutation': '/images/sunder-rf/trans.png',
  'Orb of Alteration': '/images/sunder-rf/alt.png',
  'Orb of Chance': '/images/sunder-rf/chance.png',
  'Orb of Alchemy': '/images/currency/alchemy.png',
};

export type GemVendorCost = { cost: number; currency: string; icon: string };
function gemData(name: string, guideLeague = ''): Price | undefined {
  const league = /\d+\.\d+/.exec(guideLeague)?.[0] ?? latestLeague;
  return (byLeague.get(league) ?? byLeague.get(latestLeague))?.get(name.trim().toLowerCase());
}

export function gemRequiredLevel(name: string, guideLeague = ''): number | null {
  return gemData(name, guideLeague)?.requiredLevel ?? null;
}

export function gemVendorCost(name: string, guideLeague = ''): GemVendorCost | null {
  const price = gemData(name, guideLeague);
  if (!price || price.cost === null || price.currency === null || !currencyIcons[price.currency]) return null;
  return { cost: price.cost, currency: price.currency, icon: currencyIcons[price.currency] };
}

// Show the lookup price only for an unpriced "Buy [gem]" instruction.
export function gemVendorCostAt(content: JSONContent[], index: number, guideLeague = ''): GemVendorCost | null {
  const gem = content[index];
  if (gem?.type !== 'gem') return null;
  const before = content.slice(0, index).map(node => node.text ?? '').join('');
  if (!/\bbuy\s+$/i.test(before)) return null;
  const nextGem = content.findIndex((node, next) => next > index && node.type === 'gem');
  const after = content.slice(index + 1, nextGem < 0 ? undefined : nextGem);
  const nextText = after[0]?.text ?? '';
  if (/^\s*[-–:]\s*\d+\b/.test(nextText)) return null;
  if (after.some(node => node.type === 'icon' && Object.values(currencyIcons).includes(String(node.attrs?.src ?? '')))) return null;
  return gemVendorCost(String(gem.attrs?.name ?? ''), guideLeague);
}
