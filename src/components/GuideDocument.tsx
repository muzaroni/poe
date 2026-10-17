import { gemDisplayName } from '../lib/gems';
import { useEffect, useState, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/core';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { assetUrl, headingId, plainText } from '../lib/guide';
import GemLinkList, { gemLinkGroups } from './GemLinkList';

type Props = { content: JSONContent; slug: string };

function hash(value: string) {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return (result >>> 0).toString(36);
}

function ChecklistItem({ node, slug, section, path, gemSetup = false }: { node: JSONContent; slug: string; section: string; path: string; gemSetup?: boolean }) {
  const id = `${slug}:${hash(section + ':' + path + ':' + plainText(node))}`;
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    try { setChecked(localStorage.getItem(`poe-check:${id}`) === 'true'); } catch { /* private browsing */ }
  }, [id]);
  function toggle() {
    const next = !checked;
    setChecked(next);
    try { localStorage.setItem(`poe-check:${id}`, String(next)); } catch { /* private browsing */ }
  }
  return <li className={`reader-task ${checked ? 'is-done' : ''}`}>
    <label><input type="checkbox" checked={checked} onChange={toggle} aria-label={`Mark ${plainText(node)} complete`} />
      <div>{(node.content ?? []).map((child, index) => <Node key={index} node={child} slug={slug} section={section} path={`${path}.${index}`} gemSetup={gemSetup} />)}</div>
    </label>
  </li>;
}

function Regex({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return <div className="regex-card"><div className="regex-head"><strong>{label}</strong><button type="button" onClick={copy} aria-label={`Copy ${label}`}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy'}</button></div><code>{value}</code></div>;
}

function Text({ node }: { node: JSONContent }) {
  let value: ReactNode = node.text ?? '';
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') value = <strong>{value}</strong>;
    if (mark.type === 'italic') value = <em>{value}</em>;
    if (mark.type === 'textStyle' && mark.attrs?.color) value = <span style={{ color: String(mark.attrs.color) }}>{value}</span>;
    if (mark.type === 'code') value = <code>{value}</code>;
    if (mark.type === 'link') value = <a href={String(mark.attrs?.href ?? '#')} target="_blank" rel="noopener noreferrer">{value}<ExternalLink size={11} aria-hidden /></a>;
  }
  return <>{value}</>;
}

function Node({ node, slug, section, path, gemSetup = false }: { node: JSONContent; slug: string; section: string; path: string; gemSetup?: boolean }) {
  const children = (node.content ?? []).map((child, index) => <Node key={index} node={child} slug={slug} section={section} path={`${path}.${index}`} gemSetup={gemSetup || node.type === 'gemSetup'} />);
  const attrs = node.attrs ?? {};
  switch (node.type) {
    case 'text': return <Text node={node} />;
    case 'paragraph': return gemSetup && gemLinkGroups(node) ? <GemLinkList node={node} renderInline={(child, index) => <Node key={index} node={child} slug={slug} section={section} path={`${path}.${index}`} />} /> : <p>{children}</p>;
    case 'heading': {
      const level = Number(attrs.level ?? 2);
      const id = headingId(plainText(node));
      if (level === 2) return <h2 id={id}>{children}</h2>;
      if (level === 3) return <h3 id={id}>{children}</h3>;
      return <h4 id={id}>{children}</h4>;
    }
    case 'bulletList': return <ul className="prose-list">{children}</ul>;
    case 'orderedList': return <ol className="prose-list">{children}</ol>;
    case 'listItem': return <li>{children}</li>;
    case 'taskList': return <ul className={`reader-task-list ${gemSetup ? 'gem-link-grid' : ''}`}>{(node.content ?? []).map((item, index) => <ChecklistItem key={index} node={item} slug={slug} section={section} path={`${path}.${index}`} gemSetup={gemSetup} />)}</ul>;
    case 'gem': return <button type="button" className={`gem gem-${attrs.color ?? 'red'}`} data-gem-info={String(attrs.name ?? '')} aria-haspopup="dialog" aria-label={`${gemDisplayName(String(attrs.name ?? ''))}: gem details`}>{gemDisplayName(String(attrs.name ?? ''))}</button>;
    case 'icon': return <img className="inline-icon" src={assetUrl(String(attrs.src ?? ''))} alt="" />;
    case 'image': return <figure><img src={assetUrl(String(attrs.src ?? ''))} alt={String(attrs.alt ?? 'Guide screenshot')} loading="lazy" /><figcaption>{attrs.alt && attrs.alt !== 'Guide screenshot' ? String(attrs.alt) : ''}</figcaption></figure>;
    case 'regex': return <Regex label={String(attrs.label ?? 'Regex')} value={String(attrs.value ?? '')} />;
    case 'gemSetup': return <section className="gem-setup"><div className="block-eyebrow">GEM LINKS</div>{children}</section>;
    case 'callout': return <aside className={`callout ${attrs.tone === 'important' ? 'callout-important' : ''}`}>{children}</aside>;
    case 'pobLinks': return <div className="pob-grid">{(attrs.links ?? []).map((link: { label: string; url: string }, index: number) => <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className="pob-card"><span>{link.label}</span><ExternalLink size={17} /></a>)}</div>;
    case 'horizontalRule': return <hr />;
    case 'hardBreak': return <br />;
    default: return <>{children}</>;
  }
}

export default function GuideDocument({ content, slug }: Props) {
  let section = 'intro';
  return <div className="guide-content">{(content.content ?? []).map((node, index) => {
    if (node.type === 'heading' && Number(node.attrs?.level) === 2) section = plainText(node);
    return <Node key={index} node={node} slug={slug} section={section} path={String(index)} />;
  })}</div>;
}
