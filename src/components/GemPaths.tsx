import type { TreeSnapshotData } from '../lib/tree-snapshot';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/core';
import { resolveGemPaths, gemPathField, gemPathAttributes, type PathSelections } from '../lib/gem-paths';
export const GemPathsContext = createContext<{ mapsTree?: Partial<TreeSnapshotData>; choices: JSONContent[]; selections: PathSelections; choose: (id: string, path: string) => void }>({ choices: [], selections: {}, choose: () => {} });
export function useGemPaths(content: JSONContent, slug: string) {
  const [selections, setSelections] = useState<PathSelections>({});
  const key = `poe-gem-paths:${slug}`;
  useEffect(() => {
    const read = () => { try { setSelections(JSON.parse(localStorage.getItem(key) ?? '{}')); } catch { setSelections({}); } };
    read(); window.addEventListener('poe-gem-paths', read); window.addEventListener('storage', read);
    return () => { window.removeEventListener('poe-gem-paths', read); window.removeEventListener('storage', read); };
  }, [key]);
  let act = 1;
  const choices: JSONContent[] = [];
  let mapsTree: Partial<TreeSnapshotData> | undefined;
  for (const node of content.content ?? []) {
    if (node.type === 'heading' && node.attrs?.level === 2) {
      const match = /^Act\s+(10|[1-9])\b/i.exec((node.content ?? []).map(n => n.text ?? '').join(''));
      if (match) act = Number(match[1]);
      else if (/^Maps\b/i.test((node.content ?? []).map(n => n.text ?? '').join(''))) act = 11;
      else act = 0;
    }
    if (act === 11 && node.type === 'passiveTree' && !node.attrs?.snapshot?.campaignMode && node.attrs?.snapshot?.view !== 'ascendancy') mapsTree = node.attrs?.snapshot;
    if (node.type === 'gemPathChoice') choices.push({ ...node, attrs: { ...node.attrs, startAct: act } });
    if (node.type === 'gemPathMerge') {
      const choice = choices.find(n => n.attrs?.id === node.attrs?.choiceId);
      if (choice?.attrs) choice.attrs.endAct = act;
    }
  }
  function choose(id: string, path: string) {
    let current = selections; try { current = JSON.parse(localStorage.getItem(key) ?? '{}'); } catch {}
    const next = { ...current, [id]: path }; setSelections(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
    window.dispatchEvent(new Event('poe-gem-paths'));
  }
  const resolved = useMemo(() => resolveGemPaths(content, selections), [content, selections]);
  return { resolved, value: { choices, selections, choose, mapsTree } };
}
export function GemPathCards({ node, compact = false }: { node: JSONContent; compact?: boolean }) {
  const { selections, choose } = useContext(GemPathsContext);
  const a = gemPathAttributes(node);
  const selected = selections[a.id] ?? a.defaultPath ?? a.options?.[0]?.id;
  return <section className={`gem-path-choice ${compact ? 'is-compact' : ''}`}><h3><PathRichText content={gemPathField(node, 'title')} fallback={a.title || 'Choose your leveling path'} /></h3><div className="gem-path-cards">{(a.options ?? []).map((option: { id: string; label: string; description: string }) => <button type="button" key={option.id} aria-pressed={selected === option.id} onClick={() => choose(a.id, option.id)}><strong><PathRichText content={gemPathField(node, 'label', option.id)} fallback={option.label} /></strong>{!compact && <span><PathRichText content={gemPathField(node, 'description', option.id)} fallback={option.description} /></span>}<small>{selected === option.id ? 'Selected' : 'Use this path'}</small></button>)}</div>{!compact && <p>Your choice carries into later gem links until a replacement or merge. Change it anytime.</p>}</section>;
}
export function CampaignPathChoices({ act }: { act: number }) {
  const { choices } = useContext(GemPathsContext);
  return <>{choices.filter(n => act >= n.attrs?.startAct && (!n.attrs?.endAct || act < n.attrs.endAct)).map(node => <GemPathCards key={node.attrs?.id} node={node} compact />)}</>;
}

function PathRichText({ content, fallback }: { content?: JSONContent[]; fallback: string }) {
  if (!content) return <>{fallback}</>;
  return <>{content.map((node, index) => {
    if (node.type === 'hardBreak') return <br key={index} />;
    let value: ReactNode = node.text ?? node.attrs?.name ?? '';
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') value = <b>{value}</b>;
      if (mark.type === 'italic') value = <i>{value}</i>;
      if (mark.type === 'underline') value = <u>{value}</u>;
      if (mark.type === 'strike') value = <s>{value}</s>;
      if (mark.type === 'code') value = <code>{value}</code>;
      if (mark.type === 'textStyle' && mark.attrs?.color) value = <span style={{ color: String(mark.attrs.color) }}>{value}</span>;
    }
    return <span className="gem-path-inline" key={index}>{value}</span>;
  })}</>;
}
