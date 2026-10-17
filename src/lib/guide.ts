import type { JSONContent } from '@tiptap/core';
import type { Guide } from '../types';

const files = import.meta.glob('../content/builds/*.json', { eager: true, import: 'default' });

export const guides = Object.values(files) as Guide[];

export function plainText(node?: JSONContent): string {
  if (!node) return '';
  if (node.type === 'gem') return String(node.attrs?.name ?? '');
  if (node.type === 'icon') return '';
  return (node.text ?? '') + (node.content ?? []).map(plainText).join('');
}

export function headingId(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

export function assetUrl(src: string): string {
  if (/^https?:\/\//.test(src) || src.startsWith('data:')) return src;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${src.replace(/^\//, '')}`;
}
