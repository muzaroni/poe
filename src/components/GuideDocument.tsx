import TreeBlock from './TreeBlock';
import GemSetupChanges, { GemSetupComparison } from './GemSetupChanges';
import { gemDisplayName } from '../lib/gems';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/core';
import { ExternalLink } from 'lucide-react';
import { assetUrl, headingId, plainText } from '../lib/guide';
import GemLinkList, { gemLinkGroups } from './GemLinkList';
import { guideAscendancySnapshots, guideGemLinksByAct, guideRegexes, type CampaignAscendancySnapshot, type GuideRegex } from '../lib/campaign';
import RegexCopyButton from './RegexCopyButton';

type Props = { content: JSONContent; slug: string };
const CampaignGemsContext = createContext<Record<string, JSONContent[]>>({});
const CampaignRegexContext = createContext<GuideRegex[]>([]);
const CampaignAscendancyContext = createContext<CampaignAscendancySnapshot[]>([]);

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
  return <div className="regex-card"><div className="regex-head"><strong>{label}</strong><RegexCopyButton label={label} value={value} /></div><code>{value}</code></div>;
}

function Text({ node }: { node: JSONContent }) {
  let value: ReactNode = node.text ?? '';
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') value = <strong>{value}</strong>;
    if (mark.type === 'italic') value = <em>{value}</em>;
    if (mark.type === 'underline') value = <u>{value}</u>;
    if (mark.type === 'textStyle' && mark.attrs?.color) value = <span style={{ color: String(mark.attrs.color) }}>{value}</span>;
    if (mark.type === 'code') value = <code>{value}</code>;
    if (mark.type === 'link') value = <a href={String(mark.attrs?.href ?? '#')} target="_blank" rel="noopener noreferrer">{value}<ExternalLink size={11} aria-hidden /></a>;
  }
  return <>{value}</>;
}

function Node({ node, slug, section, path, gemSetup = false }: { node: JSONContent; slug: string; section: string; path: string; gemSetup?: boolean }) {
  const campaignGemLinks = useContext(CampaignGemsContext);
  const campaignRegexes = useContext(CampaignRegexContext);
  const campaignAscendancy = useContext(CampaignAscendancyContext);
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
    case 'icon': return <img className="inline-icon" src={assetUrl(String(attrs.src ?? ''))} alt={String(attrs.name ?? '')} title={attrs.name ? String(attrs.name) : undefined} />;
    case 'image': {
      const caption = attrs.caption ?? (attrs.alt && attrs.alt !== 'Guide screenshot' ? String(attrs.alt) : '');
      const width = attrs.widthPercent == null ? null : Math.max(10, Math.min(100, Number(attrs.widthPercent) || 100));
      return <figure><img className={width == null ? undefined : 'has-custom-width'} style={width == null ? undefined : { width: `${width}%`, height: 'auto' }} src={assetUrl(String(attrs.src ?? ''))} alt={String(attrs.alt ?? '')} loading="lazy" />{caption && <figcaption>{String(caption)}</figcaption>}</figure>;
    }
    case 'regex': return <Regex label={String(attrs.label ?? 'Regex')} value={String(attrs.value ?? '')} />;
    case 'passiveTree': return <TreeBlock snapshot={attrs.snapshot ?? {}} guideGemLinks={campaignGemLinks} guideRegexes={campaignRegexes} guideAscendancy={campaignAscendancy} />;
    case 'gemSetup': return <section className="gem-setup" title={attrs.previousSetup ? `Changes from ${attrs.previousSetup.title}` : undefined}><div className="block-eyebrow">GEM LINKS</div><GemSetupComparison content={node.content ?? []} baseline={attrs.previousSetup} overrides={attrs.changeOverrides}>{children}</GemSetupComparison><GemSetupChanges content={node.content ?? []} baseline={attrs.previousSetup} overrides={attrs.changeOverrides} /></section>;
    case 'callout': return <aside className={`callout ${attrs.tone === 'important' ? 'callout-important' : ''}`}>{children}</aside>;
    case 'pobLinks': return <div className="pob-grid">{(attrs.links ?? []).map((link: { label: string; url: string }, index: number) => <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className="pob-card"><span>{link.label}</span><ExternalLink size={17} /></a>)}</div>;
    case 'horizontalRule': return <hr />;
    case 'hardBreak': return <br />;
    default: return <>{children}</>;
  }
}

export default function GuideDocument({ content, slug }: Props) {
  const campaignGemLinks = useMemo(() => guideGemLinksByAct(content), [content]);
  const campaignRegexes = useMemo(() => guideRegexes(content), [content]);
  const campaignAscendancy = useMemo(() => guideAscendancySnapshots(content), [content]);
  const sections: { heading?: JSONContent; title: string; items: { node: JSONContent; index: number }[] }[] = [{ title: 'intro', items: [] }];
  for (const [index, node] of (content.content ?? []).entries()) {
    if (node.type === 'heading' && Number(node.attrs?.level) === 2) sections.push({ heading: node, title: plainText(node), items: [] });
    else sections[sections.length - 1].items.push({ node, index });
  }
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  useEffect(() => {
    function openHashSection() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const index = sections.findIndex(section => section.heading && headingId(section.title) === id);
      if (index >= 0) setCollapsed(current => current[index] ? { ...current, [index]: false } : current);
    }
    openHashSection();
    window.addEventListener('hashchange', openHashSection);
    return () => window.removeEventListener('hashchange', openHashSection);
  }, [content]);
  const headingCount = sections.length - 1;
  return <CampaignGemsContext.Provider value={campaignGemLinks}><CampaignRegexContext.Provider value={campaignRegexes}><CampaignAscendancyContext.Provider value={campaignAscendancy}><div className="guide-content">
    {headingCount > 0 && <div className="guide-section-controls" aria-label="Guide section controls"><button type="button" onClick={() => setCollapsed({})}>Show all</button><button type="button" onClick={() => setCollapsed(Object.fromEntries(sections.map((section, index) => [index, !!section.heading])))}>Collapse all</button></div>}
    {sections.map((section, index) => <div className={`guide-section${collapsed[index] ? ' is-collapsed' : ''}`} key={index}>
      {section.heading && <h2 id={headingId(section.title)}><button type="button" aria-expanded={!collapsed[index]} aria-controls={`guide-section-${index}`} onClick={() => setCollapsed(current => ({ ...current, [index]: !current[index] }))}><span>{(section.heading.content ?? []).map((child, childIndex) => <Node key={childIndex} node={child} slug={slug} section={section.title} path={`${index}.heading.${childIndex}`} />)}</span><span className="guide-section-toggle">{collapsed[index] ? 'Show' : 'Hide'} <span className="guide-section-chevron" aria-hidden="true">▴</span></span></button></h2>}
      <div className={section.heading ? 'guide-section-body' : undefined} id={section.heading ? `guide-section-${index}` : undefined} aria-hidden={section.heading ? !!collapsed[index] : undefined} inert={section.heading ? !!collapsed[index] : undefined}><div className={section.heading ? 'guide-section-inner' : undefined}>{section.items.map(({ node, index: nodeIndex }) => <Node key={nodeIndex} node={node} slug={slug} section={section.title} path={String(nodeIndex)} />)}</div></div>
    </div>)}
  </div></CampaignAscendancyContext.Provider></CampaignRegexContext.Provider></CampaignGemsContext.Provider>;
}
