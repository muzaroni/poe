import type { JSONContent } from '@tiptap/core';
import type { ReactNode } from 'react';

// Keep the original document intact: punctuation describes the link relationships.
export function gemLinkGroups(node: JSONContent) {
  if (node.type !== 'paragraph' || !node.content?.some((child) => child.type === 'gem')) return null;
  let title = 'Gems';
  const groups: JSONContent[][][] = [[[]]];
  for (const [index, original] of node.content.entries()) {
    let child = original;
    if (index === 0 && child.type === 'text') {
      const label = child.text?.match(/^\s*([^:]{1,40}):\s*/);
      if (label) { title = label[1].trim(); child = { ...child, text: child.text!.slice(label[0].length) }; }
    }
    if (child.type === 'text') {
      // Tiptap combines adjacent text, e.g. " (1) + ", into one node.
      // Read separators within it while retaining annotations and their marks.
      for (const part of (child.text ?? '').split(/([+,])/)) {
        if (part === ',') groups.push([[]]);
        else if (part === '+') groups.at(-1)!.push([]);
        else if (part.trim()) groups.at(-1)!.at(-1)!.push({ ...child, text: part });
      }
    } else groups.at(-1)!.at(-1)!.push(child);
  }
  return { title, groups: groups.map((group) => group.filter((row) => row.length)).filter((group) => group.length) };
}

export default function GemLinkList({ node, renderInline }: { node: JSONContent; renderInline: (node: JSONContent, index: number) => ReactNode }) {
  const setup = gemLinkGroups(node);
  if (!setup) return null;
  const maxLinks = Math.max(...setup.groups.map((group) => group.length));
  return <div className="gem-link-list">
    <div className="gem-link-heading"><span>{setup.title}</span><small>{maxLinks > 1 ? `${maxLinks}-link` : 'No links needed'}</small></div>
    {setup.groups.map((group, groupIndex) => <ul key={groupIndex} className={`gem-link-group ${group.length > 1 ? 'is-linked' : ''}`} aria-label={group.length > 1 ? 'Linked gems' : 'Independent gem'}>
      {group.map((row, rowIndex) => <li key={rowIndex}><span className={`gem-link-dot gem-${row.find((item) => item.type === 'gem')?.attrs?.color ?? 'red'}`} aria-hidden="true" /><span>{row.map(renderInline)}</span></li>)}
    </ul>)}
  </div>;
}
