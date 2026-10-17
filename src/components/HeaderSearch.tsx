import { useEffect, useRef, useState } from 'react';
import { searchEntries, type SearchEntry } from '../lib/search';

export default function HeaderSearch({ base }: { base: string }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [error, setError] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open || entries) return;
    const controller = new AbortController();
    setError(false);
    fetch(`${base}search-index.json`, { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error('Search unavailable');
      return response.json();
    }).then(setEntries).catch((error) => { if (error.name !== 'AbortError') setError(true); });
    return () => controller.abort();
  }, [open, entries, base]);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  const results = entries ? searchEntries(entries, query, '', 'all') : [];
  return <div className="header-search" ref={root} role="search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={(event) => {
    if (event.key === 'Escape') { input.current?.focus(); setOpen(false); }
    if (event.key === 'ArrowDown' && event.target === input.current) { event.preventDefault(); root.current?.querySelector<HTMLAnchorElement>('.header-search-result')?.focus(); }
  }}>
    <input ref={input} type="search" aria-label="Search guides and articles" placeholder="Search guides, articles, tags…" value={query} aria-expanded={open} aria-controls="header-search-results" onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); root.current?.querySelector<HTMLAnchorElement>('.header-search-result')?.click(); } }} />
    {open && <div id="header-search-results" className="header-search-results">
      <div className="header-search-status" role="status">{error ? 'Search could not load. Close and reopen to retry.' : !entries ? 'Loading search…' : query.trim() ? `${results.length} ${results.length === 1 ? 'result' : 'results'}` : 'Browse guides and articles, or search by a tag or gem'}</div>
      {results.slice(0, 8).map((entry) => <a className="header-search-result" href={`${base}${entry.path}`} key={entry.slug} onClick={() => setOpen(false)}><strong>{entry.title}</strong><span>{entry.kind === 'article' ? 'Article' : 'Build guide'}{entry.tags.length ? ` · ${entry.tags.join(' · ')}` : ''}</span></a>)}
      {entries && !results.length && <p className="header-search-empty">No matches. Try another gem, tag, or topic.</p>}
      {results.length > 8 && <a className="header-search-more" href={`${base}?q=${encodeURIComponent(query)}#search`}>View all {results.length} results →</a>}
    </div>}
  </div>;
}
