import { useEffect, useState } from 'react';
import { searchEntries, type SearchEntry } from '../lib/search';
import { buildLabel } from '../lib/build';

export default function ContentLibrary({ entries, base }: { entries: SearchEntry[]; base: string }) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [kind, setKind] = useState('all');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const read = () => { const params = new URLSearchParams(location.search); setQuery(params.get('q') ?? ''); setTag(params.get('tag') ?? ''); setKind(['build', 'article'].includes(params.get('kind') ?? '') ? params.get('kind')! : 'all'); };
    read(); setReady(true); window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const url = new URL(location.href);
    for (const [key, value] of Object.entries({ q: query, tag, kind: kind === 'all' ? '' : kind })) { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); }
    history.replaceState(null, '', url);
  }, [query, tag, kind, ready]);
  const results = searchEntries(entries, query, tag, kind);
  return <section id="search" className="content-search" aria-label="Guide and article library">
    {query && <div className="library-query">Results for “{query}” <button type="button" onClick={() => setQuery('')} aria-label="Clear search query">Clear ×</button></div>}
    {tag && <div className="library-query">Tagged “{tag}” <button type="button" onClick={() => setTag('')} aria-label="Clear tag filter">Clear ×</button></div>}
    <p className="search-count" role="status">{results.length} {results.length === 1 ? 'result' : 'results'}</p>
    <div className="build-grid">{results.map((entry) => <article className="build-card" key={entry.slug}>
      <div className="build-card-top"><span className="league-pill">{buildLabel(entry)}</span><span className="card-arrow" aria-hidden>↗</span></div>
      <h2><a href={`${base}${entry.path}`}>{entry.title}</a></h2><p>{entry.subtitle}</p>
      <div className="build-card-foot"><span>{entry.kind === 'article' ? 'ARTICLE' : 'FULL GUIDE'}</span><a href={`${base}${entry.path}`}>Read {entry.kind === 'article' ? 'article' : 'guide'} →</a></div>
    </article>)}</div>
    {!results.length && <div className="search-empty"><p>No matching guides or articles. Try a different search or clear your filters.</p><button onClick={() => { setQuery(''); setTag(''); setKind('all'); }}>Clear search</button></div>}
  </section>;
}
