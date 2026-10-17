import type { JSONContent } from '@tiptap/core';
import type { Guide } from '../types';

export function contentPath(guide: Guide) {
  return `${guide.kind === 'article' ? 'articles' : 'builds'}/${guide.slug}/`;
}

export function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim().replace(/\s+/g, ' ').toLowerCase()).filter(Boolean))];
}

export function searchableText(node: JSONContent): string {
  return [node.text, node.type === 'gem' ? node.attrs?.name : '', node.attrs?.label,
    node.type === 'regex' ? node.attrs?.value : '',
    node.type === 'passiveTree' ? [node.attrs?.snapshot?.title, ...(node.attrs?.snapshot?.markers ?? []).map((marker: { note?: string }) => marker.note)].filter(Boolean).join(' ') : '',
    ...(node.attrs?.links ?? []).map((link: { label?: string }) => link.label),
    ...(node.content ?? []).map(searchableText)].filter(Boolean).join(' ');
}

export type SearchEntry = Pick<Guide, 'slug' | 'title' | 'subtitle' | 'league' | 'ascendancy' | 'updated'> & {
  kind: 'build' | 'article'; tags: string[]; text: string; path: string;
};

export function searchEntries(entries: SearchEntry[], query: string, tag: string, kind: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    if (kind !== 'all' && entry.kind !== kind) return false;
    if (tag && !entry.tags.includes(tag)) return false;
    const haystack = [entry.title, entry.subtitle, entry.league, entry.ascendancy, ...entry.tags, entry.text].join(' ').toLowerCase();
    return terms.every((term) => haystack.includes(term));
  }).sort((a, b) => {
    const score = (entry: SearchEntry) => terms.reduce((sum, term) => sum + (entry.title.toLowerCase().includes(term) ? 3 : 0) + (entry.tags.some((tag) => tag.includes(term)) ? 2 : 0), 0);
    return score(b) - score(a) || b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title);
  });
}
