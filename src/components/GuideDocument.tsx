import { GemPathsContext, GemPathCards, useGemPaths } from './GemPaths';
import TreeBlock from './TreeBlock';
import GemSetupChanges, { GemSetupComparison } from './GemSetupChanges';
import { gemDisplayName } from '../lib/gems';
import { createContext, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/core';
import { ExternalLink } from 'lucide-react';
import { assetUrl, headingId, plainText } from '../lib/guide';
import GemLinkList, { gemLinkGroups } from './GemLinkList';
import { guideAscendancySnapshots, guideGemProgressionByAct, guideRegexes, type CampaignAscendancySnapshot, type CampaignGemStage, type GuideRegex } from '../lib/campaign';
import RegexCopyButton from './RegexCopyButton';
import { gemVendorCostAt } from '../lib/gem-vendor';
import { carryGemAcquisitions } from '../lib/gem-links';
import GemAcquisitionSummary from './GemAcquisitionSummary';

type Props = { content: JSONContent; slug: string; league?: string; ascendancy?: string; normalized?: boolean; companionEntry?: boolean };
const CampaignGemsContext = createContext<Record<string, CampaignGemStage[]>>({});
const CampaignRegexContext = createContext<GuideRegex[]>([]);
const CampaignAscendancyContext = createContext<CampaignAscendancySnapshot[]>([]);
const VendorLeagueContext = createContext('');
const GuideAscendancyContext = createContext('');
const CompanionEntryContext = createContext(false);

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
  const compactCompanion = useContext(CompanionEntryContext);
  const campaignRegexes = useContext(CampaignRegexContext);
  const campaignAscendancy = useContext(CampaignAscendancyContext);
  const vendorLeague = useContext(VendorLeagueContext);
  const guideAscendancyName = useContext(GuideAscendancyContext);
  const children = (node.content ?? []).map((child, index) => <Node key={index} node={child} slug={slug} section={section} path={`${path}.${index}`} gemSetup={gemSetup || node.type === 'gemSetup'} />);
  const attrs = node.attrs ?? {};
  switch (node.type) {
    case 'text': return <Text node={node} />;
    case 'paragraph': if (compactCompanion && plainText(node).trim() === 'Click the Passive tree below to open the snapshot viewer.') return <p>Open the campaign companion for passive tree steps and current gem links, act by act.</p>; return gemSetup && gemLinkGroups(node) ? <GemLinkList node={node} renderInline={(child, index) => <Node key={index} node={child} slug={slug} section={section} path={`${path}.${index}`} />} /> : <p>{(node.content ?? []).map((child, index) => {
      const price = gemSetup ? null : gemVendorCostAt(node.content ?? [], index, vendorLeague);
      return <span key={index}><Node node={child} slug={slug} section={section} path={`${path}.${index}`} />{price && <> - {price.cost} <img className="inline-icon" src={assetUrl(price.icon)} alt={price.currency} title={price.currency} /></>}</span>;
    })}</p>;
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
    case 'passiveTree': return <TreeBlock compactCompanion={compactCompanion} snapshot={attrs.snapshot ?? {}} guideGemLinks={campaignGemLinks} guideRegexes={campaignRegexes} guideAscendancy={campaignAscendancy} guideCharacterAscendancy={guideAscendancyName} guideLeague={vendorLeague} guideSlug={slug} />;
    case 'gemPathChoice': return <GemPathCards node={node} />;
    case 'gemPathMerge': return <div className="gem-path-merge">Paths merge · {attrs.title || 'Continue with shared gem links'}</div>;
    case 'gemSetup': return <section className="gem-setup" title={attrs.previousSetup ? `Changes from ${attrs.previousSetup.title}` : undefined}><div className="block-eyebrow">GEM LINKS</div><GemAcquisitionSummary nodes={node.content ?? []} ascendancy={guideAscendancyName} league={vendorLeague} /><GemSetupComparison content={node.content ?? []} baseline={attrs.previousSetup} overrides={attrs.changeOverrides}>{children}</GemSetupComparison><GemSetupChanges content={node.content ?? []} baseline={attrs.previousSetup} overrides={attrs.changeOverrides} /></section>;
    case 'callout': return <aside className={`callout ${attrs.tone === 'important' ? 'callout-important' : ''}`}>{children}</aside>;
    case 'pobLinks': return <div className="pob-grid">{(attrs.links ?? []).map((link: { label: string; url: string }, index: number) => <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className="pob-card"><span>{link.label}</span><ExternalLink size={17} /></a>)}</div>;
    case 'horizontalRule': return <hr />;
    case 'hardBreak': return <br />;
    default: return <>{children}</>;
  }
}

export default function GuideDocument({ content, slug, league = '', ascendancy = '', normalized = false, companionEntry = false }: Props) {
  const paths = useGemPaths(content, slug);
  const companion = companionEntry ? content.content?.find(node => node.type === 'passiveTree' && node.attrs?.snapshot?.campaignMode && node.attrs.snapshot.nodes?.length) : undefined;
  const chooser = useRef<HTMLElement>(null);
  const readingAct = useRef<number | undefined>(undefined);
  const [showCompanionShortcut, setShowCompanionShortcut] = useState(false);
  useEffect(() => {
    if (!companion || !chooser.current) return;
    const observer = new IntersectionObserver(([entry]) => setShowCompanionShortcut(!entry.isIntersecting && entry.boundingClientRect.bottom < 0));
    observer.observe(chooser.current);
    return () => observer.disconnect();
  }, [companion]);
  function openCompanion() {
    window.dispatchEvent(new CustomEvent('poe-open-companion', { detail: { slug, title: companion?.attrs?.snapshot?.title, act: readingAct.current } }));
  }
  const displayContent = useMemo(() => normalized ? paths.resolved : carryGemAcquisitions(paths.resolved), [paths.resolved, normalized]);
  const campaignGemLinks = useMemo(() => guideGemProgressionByAct(displayContent), [displayContent]);
  const campaignRegexes = useMemo(() => guideRegexes(displayContent), [displayContent]);
  const campaignAscendancy = useMemo(() => guideAscendancySnapshots(displayContent), [displayContent]);
  const sections: { heading?: JSONContent; title: string; items: { node: JSONContent; index: number }[] }[] = [{ title: 'intro', items: [] }];
  for (const [index, node] of (displayContent.content ?? []).entries()) {
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
  }, [displayContent]);
  const documentRoot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = documentRoot.current;
    const shell = root?.closest('.guide-shell');
    if (!root || !shell) return;
    const headings = Array.from(root.querySelectorAll<HTMLElement>('.guide-section > h2[id]'));
    const links = Array.from(shell.querySelectorAll<HTMLAnchorElement>('.guide-page-sections a[href^="#"]'));
    if (!headings.length || !links.length) return;
    const jump = shell.querySelector<HTMLSelectElement>('#section-jump');
    let frame = 0;
    let activeId: string | undefined;
    function update() {
      frame = 0;
      const header = document.querySelector('.site-header');
      const threshold = (header?.getBoundingClientRect().bottom ?? 100) + 36;
      let current = '';
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= threshold) current = heading.id;
        else break;
      }
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = headings.at(-1)!.id;
      const heading = headings.find(heading => heading.id === current);
      const text = heading?.querySelector('button > span')?.textContent ?? heading?.textContent ?? '';
      const actMatch = /^Act\s+(10|[1-9])\b/i.exec(text.trim());
      readingAct.current = /^Maps\b/i.test(text.trim()) ? 11 : actMatch ? Number(actMatch[1]) : undefined;
      if (current === activeId) return;
      activeId = current;
      for (const link of links) {
        if (decodeURIComponent(link.hash.slice(1)) === current) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
      if (jump && document.activeElement !== jump) jump.value = current;
      const active = links.find(link => link.getAttribute('aria-current') === 'location');
      const sidebar = active?.closest<HTMLElement>('.guide-nav');
      if (active && sidebar) {
        const item = active.getBoundingClientRect(), bounds = sidebar.getBoundingClientRect();
        if (item.top < bounds.top) sidebar.scrollTop -= bounds.top - item.top + 8;
        else if (item.bottom > bounds.bottom) sidebar.scrollTop += item.bottom - bounds.bottom + 8;
      }
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(update); }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    update();
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect(); cancelAnimationFrame(frame);
      links.forEach(link => link.removeAttribute('aria-current'));
    };
  }, [displayContent]);
  useEffect(() => {
    if (!companionEntry) return;
    function returnToGuide(event: Event) {
      const detail = (event as CustomEvent).detail;
      if (detail?.slug !== slug) return;
      const act = Number(detail.act);
      let target = -1;
      for (let index = 0; index < sections.length; index++) {
        const title = sections[index].title.trim();
        if (act === 11 && /^Maps\b/i.test(title)) { target = index; break; }
        const match = /^Act\s+(10|[1-9])(?:\s*[-–]\s*(10|[1-9]))?\b/i.exec(title);
        if (!match) continue;
        const first = Number(match[1]), last = Number(match[2] ?? match[1]);
        if (first <= Math.min(act, 10)) target = index;
        if (act >= first && act <= last) break;
      }
      if (target < 0) return;
      setCollapsed(current => ({ ...current, [target]: false }));
      const id = headingId(sections[target].title);
      const url = new URL(window.location.href); url.hash = id;
      window.history.replaceState(null, '', url);
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'instant' }));
    }
    window.addEventListener('poe-close-companion', returnToGuide);
    return () => window.removeEventListener('poe-close-companion', returnToGuide);
  }, [companionEntry, slug, displayContent]);
  const headingCount = sections.length - 1;
  return <CompanionEntryContext.Provider value={companionEntry}><GemPathsContext.Provider value={paths.value}><VendorLeagueContext.Provider value={league}><GuideAscendancyContext.Provider value={ascendancy}><CampaignGemsContext.Provider value={campaignGemLinks}><CampaignRegexContext.Provider value={campaignRegexes}><CampaignAscendancyContext.Provider value={campaignAscendancy}><div ref={documentRoot} className="guide-content">
    {companion && <section ref={chooser} className="guide-follow-choice" aria-label="Choose how to follow this build">
      <h2>How do you want to follow this build?</h2>
      <div className="guide-follow-options">
        <div className="guide-follow-option is-companion"><span className="guide-follow-label">PLAY ALONG</span><h3>Campaign companion</h3><p>Keep this open beside your game. Follow passive tree steps and gem links, act by act through Maps.</p><button type="button" onClick={openCompanion}>Open campaign companion <span aria-hidden="true">↗</span></button><small>Progress is saved on this device. Chrome, Edge &amp; Opera can auto-track your act when you allow access to Client.txt.</small></div>
        <div className="guide-follow-option"><span className="guide-follow-label">READ AT YOUR PACE</span><h3>Written guide</h3><p>The full walkthrough, with leveling tips, explanations, and the details behind each step.</p><a href={`#${headingId(sections.find(section => section.heading)?.title ?? 'Overview')}`} onClick={() => setCollapsed(current => ({ ...current, 1: false }))}>Read the guide <span aria-hidden="true">↓</span></a></div>
      </div>
    </section>}
    {companion && showCompanionShortcut && <button type="button" className="guide-companion-shortcut" onClick={openCompanion}>Open companion <span aria-hidden="true">↗</span></button>}
    {headingCount > 0 && <div className="guide-section-controls" aria-label="Guide section controls"><button type="button" onClick={() => setCollapsed({})}>Show all</button><button type="button" onClick={() => setCollapsed(Object.fromEntries(sections.map((section, index) => [index, !!section.heading])))}>Collapse all</button></div>}
    {sections.map((section, index) => <div className={`guide-section${collapsed[index] ? ' is-collapsed' : ''}`} key={index}>
      {section.heading && <h2 id={headingId(section.title)}><button type="button" aria-expanded={!collapsed[index]} aria-controls={`guide-section-${index}`} onClick={() => setCollapsed(current => ({ ...current, [index]: !current[index] }))}><span>{(section.heading.content ?? []).map((child, childIndex) => <Node key={childIndex} node={child} slug={slug} section={section.title} path={`${index}.heading.${childIndex}`} />)}</span><span className="guide-section-toggle">{collapsed[index] ? 'Show' : 'Hide'} <span className="guide-section-chevron" aria-hidden="true">▴</span></span></button></h2>}
      <div className={section.heading ? 'guide-section-body' : undefined} id={section.heading ? `guide-section-${index}` : undefined} aria-hidden={section.heading ? !!collapsed[index] : undefined} inert={section.heading ? !!collapsed[index] : undefined}><div className={section.heading ? 'guide-section-inner' : undefined}>{section.items.map(({ node, index: nodeIndex }) => <Node key={nodeIndex} node={node} slug={slug} section={section.title} path={String(nodeIndex)} />)}</div></div>
    </div>)}
  </div></CampaignAscendancyContext.Provider></CampaignRegexContext.Provider></CampaignGemsContext.Provider></GuideAscendancyContext.Provider></VendorLeagueContext.Provider></GemPathsContext.Provider></CompanionEntryContext.Provider>;
}
