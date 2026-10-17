import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { assetUrl } from '../lib/guide';
import '../styles/gem-info.css';

type GemSummary = { id: string; name: string; color: string; icon: string | null; tags: string[]; description: string; support: boolean; maxLevel: number; version: string };
type GemLevel = { requiredLevel?: number; requirements: Record<string, number | null>; fields: [string, string][]; stats: string[] };
type GemDetail = GemSummary & { levels: Record<string, GemLevel>; quality: string[] };
const colors: Record<string, string> = { red: '#ff6655', green: '#65ed7f', blue: '#58a6ff' };
const aliases: Record<string, string> = { rf: 'righteous fire', 'blood & sand': 'blood and sand', skitterbots: 'summon skitterbots', 'burn damage': 'burning damage support', 'ele focus': 'elemental focus support', 'swift aff': 'swift affliction support', 'indimidating cry': 'intimidating cry' };
let indexRequest: Promise<GemSummary[]> | undefined;
const detailRequests = new Map<string, Promise<GemDetail>>();
const base = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/`;
function loadIndex() {
  return indexRequest ??= fetch(`${base}data/gems/index.json`).then((response) => { if (!response.ok) throw new Error('Gem data unavailable'); return response.json(); }).catch((error) => { indexRequest = undefined; throw error; });
}
function loadDetail(id: string) {
  if (!detailRequests.has(id)) detailRequests.set(id, fetch(`${base}data/gems/${id}.json`).then((response) => { if (!response.ok) throw new Error('Gem data unavailable'); return response.json(); }).catch((error) => { detailRequests.delete(id); throw error; }));
  return detailRequests.get(id)!;
}
export function resolveGemOptions(name: string, index: GemSummary[]) {
  const names = name.split(/\/|\s+or\s+/i).map((part) => part.replace(/^\s*\d+x\s*/i, '').replace(/\([^)]*\)/g, '').replace(/[,;]+$/, '').replace(/\s*&\s*/g, ' and ').trim().toLowerCase());
  return names.flatMap((name) => {
    const canonical = aliases[name] ?? name;
    const match = index.find((gem) => gem.name.toLowerCase() === canonical) ?? index.find((gem) => gem.name.toLowerCase() === `${canonical} support`);
    return match ? [match] : [];
  }).filter((gem, position, entries) => entries.findIndex((entry) => entry.id === gem.id) === position);
}
function GemIcon({ gem }: { gem: GemSummary }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [gem.id]);
  return gem.icon && !failed ? <img src={assetUrl(gem.icon)} width="44" height="44" alt="" onError={() => setFailed(true)} /> : <span className="gem-info-fallback-icon" aria-hidden="true">◇</span>;
}
function Panel({ detail, level, setLevel }: { detail: GemDetail; level: string; setLevel: (level: string) => void }) {
  const stats = detail.levels[level];
  const requirements = Object.entries(stats?.requirements ?? {}).filter(([, value]) => value != null && value > 0).map(([key, value]) => `${value} ${{ str: 'Strength', dex: 'Dexterity', int: 'Intelligence' }[key] ?? key}`);
  return <div className="gem-info-panel" style={{ '--gem-color': colors[detail.color] } as CSSProperties}>
    <header className="gem-info-heading"><GemIcon gem={detail} /><div><h2>{detail.name}</h2><span>{detail.support ? 'Support gem' : 'Active skill gem'}</span></div></header>
    <div className="gem-info-body"><p className="gem-info-tags">{detail.tags.join(' · ')}</p>
      <label className="gem-info-level">Gem level<select value={level} onChange={(event) => setLevel(event.target.value)}>{Object.keys(detail.levels).map((number) => <option key={number} value={number}>{number}</option>)}</select><span>Stats at this level · Base quality</span></label>
      {stats && <><dl className="gem-info-fields">{stats.fields.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl><p className="gem-info-requirements">Requires character level <b>{stats.requiredLevel ?? '—'}</b>{requirements.length > 0 && <> · {requirements.join(' · ')}</>}</p></>}
      {detail.description && <p className="gem-info-description">{detail.description}</p>}
      {!!stats?.stats.length && <ul className="gem-info-stats">{stats.stats.map((stat, index) => <li key={index}>{stat}</li>)}</ul>}
      {!!detail.quality.length && <div className="gem-info-quality"><span>Additional effects at 20% quality</span>{detail.quality.map((stat, index) => <p key={index}>{stat}</p>)}</div>}
      <footer><a href={`https://www.poewiki.net/wiki/${encodeURIComponent(detail.name.replaceAll(' ', '_'))}`} target="_blank" rel="noopener noreferrer">Full details on PoE Wiki ↗</a><span>Game data: {detail.version} · RePoE snapshot</span></footer>
    </div>
  </div>;
}

export default function GemInfo() {
  const [mounted, setMounted] = useState(false);
  const [compact, setCompact] = useState<{ gem: GemSummary; rect: DOMRect } | null>(null);
  const [full, setFull] = useState<{ name: string; rect: DOMRect; gem?: GemSummary; options?: GemSummary[] } | null>(null);
  const [detail, setDetail] = useState<GemDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [level, setLevel] = useState('1');
  const dialog = useRef<HTMLDialogElement>(null);
  const compactElement = useRef<HTMLDivElement>(null);
  const fullRef = useRef(full);
  fullRef.current = full;
  const anchor = useRef<HTMLElement | null>(null);
  const hovered = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suppressedUntil = useRef(0);
  const requestVersion = useRef(0);
  function hideCompact() { clearTimeout(timer.current); hovered.current = null; setCompact(null); }
  function close() { requestVersion.current++; suppressedUntil.current = Date.now() + 600; hideCompact(); setFull(null); anchor.current?.focus({ preventScroll: true }); }
  useEffect(() => {
    setMounted(true);
    const triggerFor = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLElement>('[data-gem-info]') : null;
    function preview(trigger: HTMLElement) {
      if (fullRef.current || Date.now() < suppressedUntil.current) return;
      hideCompact(); hovered.current = trigger;
      timer.current = setTimeout(() => { void loadIndex().then((index) => { const gem = resolveGemOptions(trigger.dataset.gemInfo ?? '', index)[0]; if (gem && hovered.current === trigger && !fullRef.current) setCompact({ gem, rect: trigger.getBoundingClientRect() }); }).catch(() => {}); }, 350);
    }
    const over = (event: PointerEvent) => { const trigger = triggerFor(event.target); if (event.pointerType === 'mouse' && trigger && trigger !== triggerFor(event.relatedTarget)) preview(trigger); };
    const out = (event: PointerEvent) => { const trigger = triggerFor(event.target); if (trigger && trigger !== triggerFor(event.relatedTarget)) hideCompact(); };
    const focus = (event: FocusEvent) => { const trigger = triggerFor(event.target); if (trigger) preview(trigger); };
    const blur = (event: FocusEvent) => { if (triggerFor(event.target)) hideCompact(); };
    const click = (event: MouseEvent) => {
      const trigger = triggerFor(event.target);
      if (!trigger || trigger.closest('fieldset[disabled]')) return;
      event.preventDefault(); event.stopPropagation(); hideCompact(); anchor.current = trigger;
      const name = trigger.dataset.gemInfo ?? '';
      const rect = trigger.getBoundingClientRect();
      const request = ++requestVersion.current;
      setFull({ name, rect }); setDetail(null); setFailed(false);
      void loadIndex().then((index) => { if (requestVersion.current !== request) return; const options = resolveGemOptions(name, index); if (!options.length) { setFailed(true); return; } setFull({ name, rect, gem: options[0], options }); }).catch(() => { if (requestVersion.current === request) setFailed(true); });
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') hideCompact(); };
    const scroll = () => { const focused = triggerFor(document.activeElement); hideCompact(); if (focused) preview(focused); };
    document.addEventListener('pointerover', over); document.addEventListener('pointerout', out);
    document.addEventListener('focusin', focus); document.addEventListener('focusout', blur);
    document.addEventListener('click', click, true); document.addEventListener('keydown', key);
    window.addEventListener('scroll', scroll, true);
    return () => { clearTimeout(timer.current); document.removeEventListener('pointerover', over); document.removeEventListener('pointerout', out); document.removeEventListener('focusin', focus); document.removeEventListener('focusout', blur); document.removeEventListener('click', click, true); document.removeEventListener('keydown', key); window.removeEventListener('scroll', scroll, true); };
  }, []);
  useEffect(() => {
    if (!full?.gem) return;
    let cancelled = false;
    setDetail(null); setFailed(false);
    void loadDetail(full.gem.id).then((value) => { if (!cancelled) { setDetail(value); const explicit = full.name.match(/\((\d+)\)/)?.[1]; setLevel(explicit && value.levels[explicit] ? explicit : /\(max\)/i.test(full.name) ? String(value.maxLevel) : Object.keys(value.levels)[0] ?? '1'); } }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [full?.gem?.id]);
  useLayoutEffect(() => {
    if (!full) { dialog.current?.close(); return; }
    if (!dialog.current?.open) dialog.current?.showModal();
    const element = dialog.current!;
    const position = () => {
      if (window.innerWidth <= 650) { element.style.removeProperty('left'); element.style.removeProperty('top'); return; }
      const { width, height } = element.getBoundingClientRect();
      const rect = full.rect;
      element.style.left = `${Math.max(12, Math.min(rect.right + width + 24 <= window.innerWidth ? rect.right + 12 : rect.left - width - 12, window.innerWidth - width - 12))}px`;
      element.style.top = `${Math.max(12, Math.min(rect.top, window.innerHeight - height - 12))}px`;
    };
    position(); window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [full, detail, level, failed]);
  useLayoutEffect(() => {
    if (!compact || !compactElement.current) return;
    const element = compactElement.current;
    const { width, height } = element.getBoundingClientRect();
    element.style.left = `${Math.max(12, Math.min(compact.rect.left, window.innerWidth - width - 12))}px`;
    element.style.top = `${Math.max(12, compact.rect.bottom + height + 20 <= window.innerHeight ? compact.rect.bottom + 7 : compact.rect.top - height - 7)}px`;
  }, [compact]);
  if (!mounted) return null;
  return createPortal(<>
    {compact && !full && <div ref={compactElement} className="gem-info-compact" role="tooltip" style={{ '--gem-color': colors[compact.gem.color] } as CSSProperties}><div className="gem-info-compact-heading"><GemIcon gem={compact.gem} /><strong>{compact.gem.name}</strong></div><p>{compact.gem.tags.slice(0, 5).join(' · ')}</p><span>{compact.gem.description ? compact.gem.description.split(/(?<=[.!?])\s/)[0] : compact.gem.support ? 'Support gem' : 'Active skill gem'}</span><small>Click for full gem details</small></div>}
    <dialog ref={dialog} className="gem-info-dialog" aria-label={`${full?.gem?.name ?? full?.name ?? 'Gem'} details`} onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => { if (fullRef.current) close(); }} onClick={(event) => { if (event.target !== event.currentTarget) return; const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); }}>
      <button type="button" className="gem-info-close" aria-label="Close gem details" onClick={close}>×</button>
      <div className="gem-info-scroll">{full?.options && full.options.length > 1 && <div className="gem-info-alternatives" aria-label="Choose an alternative gem">{full.options.map((gem) => <button key={gem.id} type="button" aria-pressed={full.gem?.id === gem.id} onClick={() => setFull({ ...full, gem })}>{gem.name}</button>)}</div>}
        {detail ? <Panel detail={detail} level={level} setLevel={setLevel} /> : <div className="gem-info-loading" role="status"><h2>{full?.name}</h2><p>{failed ? 'Detailed data is unavailable for this gem.' : 'Loading gem details…'}</p>{failed && <a href={`https://www.poewiki.net/wiki/Special:Search?search=${encodeURIComponent(full?.name ?? '')}`} target="_blank" rel="noopener noreferrer">Find this gem on PoE Wiki ↗</a>}</div>}
      </div>
    </dialog>
  </>, document.body);
}
