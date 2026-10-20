import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import type { CampaignAscendancySnapshot, CampaignGemStage, GuideRegex } from '../lib/campaign';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { loadPassiveTree, loadTreeSprites } from '../lib/tree-assets';
import { drawPassiveTree } from '../lib/tree-render';
import { ascendancyStepMarkers, cameraForFrame, frameNodes, markerPositions, normalizeSnapshot, stepNodeIds, progressionNodes, snapshotNodes, snapshotStage, treeEdges, type TreeSnapshotData } from '../lib/tree-snapshot';
import { stageChanges, type PassiveTree } from '../lib/passive-tree';
import '../styles/tree-block.css';

const Viewer = lazy(() => import('./PassiveTreeViewer'));
const Campaign = lazy(() => import('./CampaignView'));

export function TreePicker({ snapshot, previousSnapshot, previousSnapshots, onApply, onCancel }: { snapshot: TreeSnapshotData; previousSnapshot?: TreeSnapshotData; previousSnapshots?: TreeSnapshotData[]; onApply: (value: TreeSnapshotData) => void; onCancel: () => void }) {
  return <Suspense fallback={<p className="tree-block-loading">Loading tree picker…</p>}><Viewer initialSnapshot={snapshot} previousSnapshot={previousSnapshot} previousSnapshots={previousSnapshots} onApply={onApply} onCancel={onCancel} /></Suspense>;
}

export default function TreeBlock({ snapshot: value, guideGemLinks, guideRegexes, guideAscendancy, guideCharacterAscendancy = '', guideLeague = '', guideSlug = '' }: { snapshot: Partial<TreeSnapshotData>; guideGemLinks?: Record<string, CampaignGemStage[]>; guideRegexes?: GuideRegex[]; guideAscendancy?: CampaignAscendancySnapshot[]; guideCharacterAscendancy?: string; guideLeague?: string; guideSlug?: string }) {
  const baseSnapshot = useMemo(() => normalizeSnapshot(value), [value]);
  const [tree, setTree] = useState<PassiveTree | null>(null);
  const snapshot = useMemo(() => tree ? { ...baseSnapshot, markers: ascendancyStepMarkers(tree, baseSnapshot) } : baseSnapshot, [tree, baseSnapshot]);
  const [sprites, setSprites] = useState<HTMLImageElement[]>([]);
  const [error, setError] = useState('');
  const [activeMarker, setActiveMarker] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [near, setNear] = useState(false);
  const wrapper = useRef<HTMLElement>(null);
  const map = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState({ width: snapshot.width, height: snapshot.height, dpr: 1 });
  const nodes = useMemo(() => tree ? snapshotNodes(tree, snapshot) : [], [tree, snapshot]);
  const allocated = useMemo(() => new Set(snapshot.nodes), [snapshot.nodes]);
  const changes = useMemo(() => stageChanges(snapshotStage(snapshot), snapshot.respec), [snapshot]);
  const hasSidebar = !snapshot.campaignMode && (snapshot.markers.length > 0 || !!snapshot.respec || (snapshot.view === 'ascendancy' && snapshot.nodes.length > 0));
  const ascendancyName = tree?.classes.find(c => c.id === snapshot.classId)?.ascendancies[snapshot.ascendancyId - 1]?.name;
  const focus = useMemo(() => {
    const ids = snapshot.respec ? new Set([...snapshot.nodes, ...snapshot.respec.nodes]) : snapshot.markers.length ? new Set(snapshot.markers.flatMap(stepNodeIds)) : allocated;
    const destinations = nodes.filter(n => ids.has(n.id));
    const anchors = snapshot.markers.flatMap(marker => {
      const node = nodes.find(n => n.id === marker.nodeId);
      return node ? [{ ...node, x: marker.positionX ?? node.x + (marker.offsetX ?? 0), y: marker.positionY ?? node.y + (marker.offsetY ?? 0) }] : [];
    });
    return [...destinations, ...anchors];
  }, [nodes, snapshot.markers, snapshot.respec, snapshot.nodes, allocated]);
  const frame = snapshot.frame ?? frameNodes(focus);
  const camera = frame ? cameraForFrame(frame, size, snapshot.frame ? 0 : 16) : null;
  const positions = useMemo(() => camera ? markerPositions(snapshot.markers, nodes, camera, size) : [], [snapshot.markers, nodes, camera?.x, camera?.y, camera?.scale, size]);
  const edges = useMemo(() => treeEdges(nodes), [nodes]);
  const missing = tree ? snapshot.nodes.filter(id => !tree.nodes.some(n => n.id === id)).length : 0;
  const configured = snapshot.nodes.length > 0 || snapshot.markers.length > 0 || !!snapshot.respec?.nodes.length;

  useEffect(() => {
    if (!wrapper.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setNear(true); observer.disconnect(); } }, { rootMargin: '250px' });
    observer.observe(wrapper.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!near || !configured) return;
    let cancelled = false;
    setTree(null); setError(''); setSprites([]);
    loadPassiveTree(snapshot.version).then(async data => {
      if (cancelled) return; setTree(data);
      const images = await loadTreeSprites(data);
      if (!cancelled) setSprites(images);
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [near, configured, snapshot.version]);
  useEffect(() => {
    if (!map.current) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height, dpr: Math.min(window.devicePixelRatio || 1, 2) }));
    observer.observe(map.current); return () => observer.disconnect();
  }, [configured]);
  useEffect(() => {
    if (!canvas.current || !tree || !camera) return;
    drawPassiveTree(canvas.current, { camera, size, nodes, edges, sprites, allocated, added: snapshot.respec ? changes.added : undefined, removed: snapshot.respec ? changes.removed : undefined, previous: snapshot.respec, stage: snapshotStage(snapshot), selected: activeMarker, emphasized: new Set(snapshot.markers.filter(m => m.nodeId === activeMarker).flatMap(stepNodeIds)), progression: progressionNodes(nodes, snapshot, activeMarker), inherited: new Set(snapshot.respec?.nodes ?? snapshot.inheritedNodes ?? []), classId: snapshot.classId, markers: snapshot.campaignMode ? [] : snapshot.markers });
  }, [tree, nodes, edges, sprites, allocated, camera?.x, camera?.y, camera?.scale, size, snapshot, activeMarker]);
  useEffect(() => {
    if (expanded) dialog.current?.showModal();
    else if (dialog.current?.open) { dialog.current.close(); expandButton.current?.focus(); }
  }, [expanded]);
  useEffect(() => {
    if (!expanded || !snapshot.campaignMode) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [expanded, snapshot.campaignMode]);

  return <section ref={wrapper} className={`tree-block${hasSidebar ? ' tree-block-with-steps' : ''}`} style={{ width: snapshot.campaignMode ? Math.max(snapshot.width, 800) : hasSidebar ? snapshot.width + 360 : snapshot.width, maxWidth: '100%', '--tree-snapshot-width': `${snapshot.campaignMode ? Math.max(snapshot.width, 800) : snapshot.width}px` } as CSSProperties} aria-label={snapshot.title || 'Passive tree snapshot'}>
    <header className="tree-block-heading"><strong>{snapshot.title || 'Passive tree'}</strong><span>{snapshot.version.split('.').slice(0, 2).join('.')}</span>{snapshot.campaignMode && <span>{snapshot.markers.length} steps · 10 acts</span>}{configured && <button ref={expandButton} type="button" onClick={() => setExpanded(true)}>{snapshot.campaignMode ? 'Open campaign view ↗' : 'Expand tree ↗'}</button>}</header>
    <div className="tree-block-body">
    {configured ? <div className="tree-block-map" ref={map} style={{ aspectRatio: snapshot.campaignMode ? '2 / 1' : `${snapshot.width} / ${snapshot.height}` }}>
      <canvas ref={canvas} aria-label={snapshot.campaignMode ? 'Campaign tree overview' : `Focused passive tree with ${snapshot.markers.length} numbered steps`} onClick={event => {
        if (snapshot.campaignMode) { setExpanded(true); return; }
        const rect = event.currentTarget.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
        const marker = positions.find(p => Math.hypot(p.x - x, p.y - y) <= 21);
        if (marker) { event.preventDefault(); setActiveMarker(marker.nodeId); }
      }} />
      {(!tree || !camera) && <p className="tree-block-placeholder" role="status">{error || (tree ? 'No visible nodes in this snapshot.' : 'Loading tree…')}</p>}
    </div> : <div className="tree-block-empty">Choose nodes and numbered destinations to create a focused snapshot.</div>}
    {hasSidebar && <aside className="tree-block-sidebar" aria-label="Tree progression">
    {snapshot.view === 'ascendancy' && ascendancyName && <div className="tree-block-ascendancy-name">{ascendancyName}</div>}
    {snapshot.respec && <div className="tree-block-respec"><strong>Respec</strong><small>Before: {snapshot.respec.title}</small><div><span className="respec-remove">Remove {changes.removed.size}</span><span className="respec-add">Add {changes.added.size}</span></div><small>Dashed red: remove · Solid green: add<br />Dim gold: keep</small>{snapshot.respec.note && <p>{snapshot.respec.note}</p>}</div>}
    {snapshot.markers.length > 0 && <ol className="tree-block-steps" aria-label="Tree steps in order">{snapshot.markers.map((marker, index) => <li key={marker.nodeId} className={marker.nodeId === activeMarker ? 'is-active' : ''}>
      {marker.actDivider && <div className="tree-act-divider">{marker.actDivider}</div>}
      <div className="tree-block-step-content"><button type="button" aria-pressed={marker.nodeId === activeMarker} aria-label={`Step ${index + 1}: ${tree?.nodes.find(n => n.id === marker.nodeId)?.name ?? 'destination'}`} onClick={() => setActiveMarker(marker.nodeId)}>{index + 1}</button>
      <div><strong>{tree?.nodes.find(n => n.id === marker.nodeId)?.name ?? 'Loading destination…'}</strong>{stepNodeIds(marker).length > 1 && <small className="tree-group-count">{stepNodeIds(marker).length} nodes</small>}{marker.note && <p>{marker.note}</p>}{stepNodeIds(marker).map(id => {
        const notable = nodes.find(node => node.id === id);
        return notable?.ascendancy && notable.stats.length > 0 ? <div className="tree-block-ascendancy-info" key={id}>{id !== marker.nodeId && <strong>{notable.name}</strong>}<ul>{notable.stats.map((stat, index) => <li key={index}>{stat}</li>)}</ul></div> : null;
      })}</div></div>
    </li>)}</ol>}
    </aside>}
    </div>
    {missing > 0 && <p className="tree-block-warning">{missing} jewel-added or unavailable nodes are not shown.</p>}
    {mounted && createPortal(<dialog ref={dialog} className={`tree-block-dialog${snapshot.campaignMode ? ' campaign-dialog' : ''}`} aria-label={snapshot.campaignMode ? 'Full campaign view' : 'Expanded passive tree'} onCancel={event => { event.preventDefault(); event.stopPropagation(); setExpanded(false); }} onClick={event => { if (event.target === dialog.current) setExpanded(false); }}>{expanded && <Suspense fallback={<p>Loading viewer…</p>}>{snapshot.campaignMode ? <Campaign snapshot={snapshot} tree={tree} sprites={sprites} guideGemLinks={guideGemLinks} guideRegexes={guideRegexes} guideAscendancy={guideAscendancy} guideCharacterAscendancy={guideCharacterAscendancy} guideLeague={guideLeague} guideSlug={guideSlug} onClose={() => setExpanded(false)} /> : <div><div className="tree-block-dialog-bar"><strong>{snapshot.title}</strong><button type="button" onClick={() => setExpanded(false)}>Close</button></div><Viewer initialSnapshot={snapshot} /></div>}</Suspense>}</dialog>, document.body)}
  </section>;
}
