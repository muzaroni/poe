import { loadPassiveTree, loadTreeSprites, treeBase } from '../lib/tree-assets';
import { drawPassiveTree } from '../lib/tree-render';
import { normalizeSnapshot, respecBaseline, stepNodeIds, progressionNodes, continueFromSnapshot, shortestAllocationPath, unallocateBranch, snapshotStage, cropViewport, saveMarkerPositions, captureFrame, cameraForFrame, markerPositions, type TreeSnapshotData, type TreeRespec, type TreeMarker } from '../lib/tree-snapshot';
import { useEffect, useMemo, useRef, useState } from 'react';
import { compatibleTree, nodeRadius, parsePobStages, stageChanges, treeVersions, type PassiveNode, type PassiveTree, type TreeBuild, type TreeStage } from '../lib/passive-tree';
import '../styles/passive-tree.css';

type Camera = { x: number; y: number; scale: number };
type Size = { width: number; height: number; dpr: number };
const base = treeBase;
const loadTree = loadPassiveTree;
function fit(nodes: PassiveNode[], size: Size): Camera {
  if (!nodes.length) return { x: 0, y: 0, scale: .03 };
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const left = Math.min(...xs) - 250, right = Math.max(...xs) + 250, top = Math.min(...ys) - 250, bottom = Math.max(...ys) + 250;
  return { x: (left + right) / 2, y: (top + bottom) / 2, scale: Math.min(.6, Math.max(.015, Math.min((size.width - 50) / (right - left), (size.height - 50) / (bottom - top)))) };
}
function zoomAt(camera: Camera, factor: number, px: number, py: number, size: Size): Camera {
  const scale = Math.max(.012, Math.min(.85, camera.scale * factor));
  return { scale, x: camera.x + (px - size.width / 2) * (1 / camera.scale - 1 / scale), y: camera.y + (py - size.height / 2) * (1 / camera.scale - 1 / scale) };
}

type ViewerProps = { initialSnapshot?: TreeSnapshotData; previousSnapshot?: TreeSnapshotData; previousSnapshots?: TreeSnapshotData[]; onApply?: (snapshot: TreeSnapshotData) => void; onCancel?: () => void };
export default function PassiveTreeViewer({ initialSnapshot, previousSnapshot, previousSnapshots, onApply, onCancel }: ViewerProps = {}) {
  const initial = useRef(initialSnapshot ? normalizeSnapshot(initialSnapshot) : null).current;
  const sources = previousSnapshots ?? (previousSnapshot ? [previousSnapshot] : []);
  const [sourceIndex, setSourceIndex] = useState(Math.max(0, sources.length - 1));
  const continuationSource = sources[sourceIndex];
  const [snapshotTitle, setSnapshotTitle] = useState(initial?.title ?? 'Passive tree');
  const [snapshotWidth, setSnapshotWidth] = useState(initial?.width ?? 480);
  const [snapshotHeight, setSnapshotHeight] = useState(initial?.height ?? 240);
  const [markers, setMarkers] = useState<TreeMarker[]>(initial?.markers ?? []);
  const [respec, setRespec] = useState<TreeRespec | undefined>(initial?.respec);
  const [inheritedNodes, setInheritedNodes] = useState<number[]>(initial?.inheritedNodes ?? []);
  const inherited = useMemo(() => new Set(respec ? respec.nodes : inheritedNodes), [inheritedNodes, respec]);
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [manualCrop, setManualCrop] = useState(!!initial?.frame);
  const skipFit = useRef(false);
  const initialFrameUsed = useRef(false);
  const [version, setVersion] = useState<string>(initial?.version ?? '3.29.1');
  const [tree, setTree] = useState<PassiveTree | null>(null);
  const [error, setError] = useState('');
  const [sprites, setSprites] = useState<HTMLImageElement[]>([]);
  const [spriteWarning, setSpriteWarning] = useState(false);
  const [example, setExample] = useState<TreeBuild | null>(null);
  const [build, setBuild] = useState<TreeBuild | null>(initial ? { title: initial.title, stages: [snapshotStage(initial)] } : null);
  const [stageIndex, setStageIndex] = useState(0);
  const [compare, setCompare] = useState(true);
  const [classId, setClassId] = useState(initial?.classId ?? 1);
  const [ascendancy, setAscendancy] = useState('Chieftain');
  const [view, setView] = useState<'tree' | 'ascendancy'>(initial?.view ?? 'tree');
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<{ node: PassiveNode; x: number; y: number } | null>(null);
  const [query, setQuery] = useState('');
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: .03 });
  const [size, setSize] = useState<Size>({ width: 900, height: 600, dpr: 1 });
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointer = useRef(new Map<number, { x: number; y: number; startX: number; startY: number }>());
  const moved = useRef(false);
  const markerDrag = useRef<{ pointerId: number; nodeId: number; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const importButton = useRef<HTMLButtonElement>(null);
  const stages = useMemo(() => build?.stages.filter(stage => compatibleTree(stage.version, version)) ?? [], [build, version]);
  const stage: TreeStage | undefined = stages[stageIndex];
  const previous: TreeStage | undefined = respec ? respec : compare && stageIndex > 0 ? stages[stageIndex - 1] : undefined;
  const { allocated, added, removed } = useMemo(() => stageChanges(stage, previous), [stage, previous]);
  const nodes = useMemo(() => tree?.nodes.filter(node => !node.bloodline && (view === 'tree' ? !node.ascendancy : node.ascendancy === ascendancy)) ?? [], [tree, view, ascendancy]);
  const allById = useMemo(() => new Map(tree?.nodes.map(node => [node.id, node]) ?? []), [tree]);
  const byId = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);
  const edges = useMemo(() => {
    const seen = new Set<string>();
    return nodes.flatMap(node => node.out.flatMap(id => {
      const other = byId.get(id), key = [node.id, id].sort((a, b) => a - b).join(':');
      if (!other || seen.has(key)) return [];
      seen.add(key); return [[node, other]];
    }));
  }, [nodes, byId]);
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? nodes.filter(n => `${n.name} ${n.stats.join(' ')}`.toLowerCase().includes(term)) : [];
  }, [nodes, query]);
  const matchIds = useMemo(() => new Set(matches.map(n => n.id)), [matches]);
  const selectedNode = selected == null ? undefined : allById.get(selected);
  const missing = stage?.nodes.filter(id => !allById.has(id)).length ?? 0;
  const currentClass = tree?.classes.find(c => c.id === classId);

  useEffect(() => {
    let cancelled = false;
    setTree(null); setError(''); setSprites([]); setSpriteWarning(false); setSelected(null); setHover(null);
    loadTree(version).then(data => { if (!cancelled) setTree(data); }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [version]);
  useEffect(() => {
    let cancelled = false;
    if (initial) return;
    fetch(`${base}sunder-rf-stages.json`).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { if (!cancelled) setExample(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!tree) return;
    let cancelled = false;
    loadTreeSprites(tree).then(images => { if (!cancelled) { setSprites(images); setSpriteWarning(images.some(image => !image.naturalWidth)); } });
    return () => { cancelled = true; };
  }, [tree, version]);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height, dpr: Math.min(window.devicePixelRatio || 1, 2) }));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!nodes.length) return;
    if (skipFit.current) { skipFit.current = false; return; }
    if (initial?.frame && !initialFrameUsed.current) { const crop = cropViewport(size, snapshotWidth, snapshotHeight); setCamera(cameraForFrame(initial.frame, { ...size, width: crop.width, height: crop.height }, 0)); initialFrameUsed.current = true; return; }
    const relevant = nodes.filter(n => allocated.has(n.id) || removed.has(n.id));
    setCamera(fit(relevant.length ? relevant : nodes, size));
    setHover(null);
  }, [nodes, stage, previous, size.width, size.height]);
  useEffect(() => {
    if (onApply && stage) setMarkers(current => current.every(m => stage.nodes.includes(m.nodeId)) ? current : current.filter(m => stage.nodes.includes(m.nodeId)));
  }, [stage, onApply]);
  useEffect(() => {
    if (!stage || !tree) return;
    setClassId(stage.classId);
    setAscendancy(tree.classes.find(c => c.id === stage.classId)?.ascendancies[stage.ascendancyId - 1]?.id ?? '');
  }, [stage, tree]);
  useEffect(() => {
    if (importing && !dialog.current?.open) dialog.current?.showModal();
    if (!importing && dialog.current?.open) { dialog.current.close(); importButton.current?.focus(); }
  }, [importing]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); const rect = element.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1);
      setCamera(current => zoomAt(current, Math.exp(-Math.max(-300, Math.min(300, delta)) * .002), event.clientX - rect.left, event.clientY - rect.top, size));
      setHover(null);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [size]);

  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext('2d');
    if (!element || !ctx || !tree) return;
    const frame = requestAnimationFrame(() => {
      drawPassiveTree(element, { camera, size, nodes, edges, sprites, allocated, inherited, added, removed, selected,
        emphasized: new Set(markers.filter(m => m.nodeId === (editingStep ?? selected)).flatMap(stepNodeIds)),
        progression: !onApply && initial ? progressionNodes(nodes, { ...initial, markers }, selected) : null, hoverId: hover?.node.id, matchIds, stage, previous, classId, markers: stage ? markers : [] });
      if (onApply) {
        const crop = cropViewport(size, snapshotWidth, snapshotHeight);
        ctx.strokeStyle = "#b5c8ee"; ctx.lineWidth = 1; ctx.setLineDash([6, 5]); ctx.strokeRect(crop.x, crop.y, crop.width, crop.height); ctx.setLineDash([]);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [tree, camera, size, edges, nodes, sprites, allocated, inherited, added, removed, selected, hover?.node.id, matchIds, stage, previous, classId, markers, editingStep, onApply, snapshotWidth, snapshotHeight]);

  function local(event: React.PointerEvent<HTMLCanvasElement>) { const rect = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  function hit(point: { x: number; y: number }) {
    let nearest: PassiveNode | null = null, distance = Infinity;
    for (const node of nodes) {
      const x = (node.x - camera.x) * camera.scale + size.width / 2, y = (node.y - camera.y) * camera.scale + size.height / 2;
      const d = Math.hypot(point.x - x, point.y - y);
      if (d < Math.max(7, nodeRadius(node) * camera.scale + 4) && d < distance) { nearest = node; distance = d; }
    }
    return nearest;
  }
  function fitBuild() { const relevant = nodes.filter(n => allocated.has(n.id) || removed.has(n.id)); setCamera(fit(relevant.length ? relevant : nodes, size)); }
  function useBuild(next: TreeBuild) {
    const first = next.stages.find(s => treeVersions.some(v => compatibleTree(s.version, v)))!;
    setRespec(undefined); setMarkers([]); setEditingStep(null); setInheritedNodes([]); setManualCrop(false); setBuild(next); setVersion(treeVersions.find(v => compatibleTree(first.version, v))!); setStageIndex(0); setView('tree'); setQuery(''); setSelected(null);
  }
  function updateCurrent(patch: Partial<TreeStage>) {
    skipFit.current = true;
    setBuild(current => {
      const target = current?.stages.find(s => s === stage);
      if (!current || !target) return { title: snapshotTitle, stages: [{ ...snapshotStage(normalizeSnapshot({ version, classId, ascendancyId: Math.max(0, (currentClass?.ascendancies.findIndex(a => a.id === ascendancy) ?? -1) + 1) })), ...patch }] };
      return { ...current, stages: current.stages.map(s => s === target ? { ...s, ...patch } : s) };
    });
  }
  function allocateNode(node: PassiveNode) {
    if (!onApply || !tree) return false;
    const path = shortestAllocationPath(tree.nodes, allocated, classId, node.id);
    if (!path) { setError('No connecting path is available for this node.'); return false; }
    setError('');
    updateCurrent({ nodes: [...new Set([...(stage?.nodes ?? []), ...path])] });
    return true;
  }
  function toggleNode(node: PassiveNode) {
    if (!onApply || node.classStart !== null || node.ascendancyStart) return;
    if (!allocated.has(node.id)) { allocateNode(node); return; }
    if (!tree) return;
    const remaining = unallocateBranch(tree.nodes, allocated, classId, node.id);
    const kept = new Set(remaining);
    updateCurrent({ nodes: remaining, mastery: Object.fromEntries(Object.entries(stage?.mastery ?? {}).filter(([id]) => kept.has(Number(id)))) });
    const visibleSteps = new Set([...remaining, ...(respec?.nodes ?? [])]);
    setMarkers(current => current.filter(marker => visibleSteps.has(marker.nodeId)).map(marker => ({ ...marker, nodeIds: marker.nodeIds?.filter(id => visibleSteps.has(id)) })));
    setError('');
  }
  function editGroupNode(node: PassiveNode) {
    const marker = markers.find(m => m.nodeId === editingStep);
    if (!marker || !onApply) return;
    if (node.id === marker.nodeId) return;
    const members = stepNodeIds(marker);
    if (members.includes(node.id)) setMarkers(current => current.map(m => m.nodeId === editingStep ? { ...m, nodeIds: members.filter(id => id !== node.id) } : m));
    else if ((respec && removed.has(node.id)) || allocateNode(node)) setMarkers(current => current.map(m => m.nodeId === editingStep ? { ...m, nodeIds: [...members, node.id] } : m));
  }
  function addMarker(node: PassiveNode) {
    if (markers.some(m => m.nodeId === node.id) || markers.length >= 50) return;
    if (!(respec && removed.has(node.id)) && !allocateNode(node)) return;
    setMarkers(current => [...current, { nodeId: node.id, note: '' }]);
  }
  function moveMarker(index: number, offset: number) {
    setMarkers(current => { const next = [...current], other = index + offset; if (other < 0 || other >= next.length) return current; [next[index], next[other]] = [next[other], next[index]]; return next; });
  }
  function applySnapshot() {
    if (!onApply || !stage) return;
    onApply(normalizeSnapshot({ title: snapshotTitle.trim() || 'Passive tree', version, classId: stage.classId, ascendancyId: stage.ascendancyId, nodes: stage.nodes, inheritedNodes, respec, mastery: stage.mastery, markers: saveMarkerPositions(markers, tree?.nodes ?? nodes, camera, size), width: snapshotWidth, height: snapshotHeight, view, frame: manualCrop ? captureFrame(camera, size, snapshotWidth, snapshotHeight) : null }));
  }
  function continuePrevious() {
    if (!continuationSource) return;
    const next = continueFromSnapshot(normalizeSnapshot({ title: snapshotTitle, width: snapshotWidth, height: snapshotHeight }), continuationSource);
    useBuild({ title: next.title, stages: [snapshotStage(next)] });
    setRespec(undefined);
    setInheritedNodes(next.inheritedNodes ?? []); setClassId(next.classId); setView(next.view);
    initialFrameUsed.current = true;
  }
  function compareRespec() {
    if (!continuationSource) return;
    if (stage?.nodes.length && (!compatibleTree(continuationSource.version, version) || continuationSource.classId !== classId)) {
      setError('Choose a Before tree with the same tree version and class.'); return;
    }
    if (!stage?.nodes.length) {
      const next = continueFromSnapshot(normalizeSnapshot({ title: snapshotTitle }), continuationSource);
      useBuild({ title: snapshotTitle, stages: [snapshotStage(next)] });
      setClassId(next.classId); setView(next.view);
    }
    setRespec({ ...respecBaseline(continuationSource), note: respec?.note ?? '' }); setError('');
  }
  async function importPob(value: string) {
    setImportBusy(true); setImportError('');
    try { useBuild(await parsePobStages(value)); setImporting(false); setImportText(''); }
    catch (e) { setImportError(e instanceof Error ? e.message : 'Could not read this PoB.'); }
    finally { setImportBusy(false); }
  }
  function focusNode(node: PassiveNode) { setSelected(node.id); setCamera(current => ({ x: node.x, y: node.y, scale: Math.max(.24, current.scale) })); setHover(null); }
  const pointCount = stage?.nodes.filter(id => { const node = allById.get(id); return node && node.classStart === null && !node.ascendancyStart && !node.ascendancy; }).length ?? 0;

  return <section className="passive-viewer" aria-label="Interactive passive tree viewer">
    {onApply && <div className="tree-authoring">
      <label>Snapshot title<input value={snapshotTitle} onChange={e => setSnapshotTitle(e.target.value)} /></label>
      <label className="tree-continue-source">{respec ? 'Before tree' : 'Continue from'}<select aria-label="Previous tree" value={sources.length ? sourceIndex : ''} disabled={!sources.length} onChange={e => setSourceIndex(Number(e.target.value))}>
        {!sources.length && <option value="">No earlier trees</option>}
        {sources.map((source, index) => <option key={index} value={index}>{source.title || `Tree ${index + 1}`}</option>)}
      </select></label>
      <button type="button" disabled={!continuationSource} onClick={respec ? compareRespec : continuePrevious}>{respec ? 'Set Before' : 'Continue'}</button>
      <span className="tree-inline-count">{pointCount} passives</span>
      <button type="button" className="tree-apply" disabled={!stage || (!stage.nodes.length && !respec?.nodes.length)} onClick={applySnapshot}>Apply to guide</button>
      {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}

    </div>}
    {initial ? <details className="tree-picker-settings"><summary>Tree settings{onApply ? ` · ${snapshotWidth} × ${snapshotHeight}` : ''} · {version.split('.').slice(0, 2).join('.')}</summary>
      {onApply && <div className="tree-respec-controls"><button type="button" disabled={!continuationSource && !respec} aria-pressed={!!respec} onClick={() => respec ? setRespec(undefined) : compareRespec()}>{respec ? 'Disable respec' : 'Enable respec comparison'}</button><span>{respec ? `Before: ${respec.title} · edit the tree to define After` : 'Compare removals and additions against an earlier tree.'}</span></div>}
      {onApply && <div className="tree-size-settings">      <label>Width<select value={snapshotWidth} onChange={e => setSnapshotWidth(Number(e.target.value))}>{[320, 400, 480, 600, 800, 1000].map(n => <option key={n} value={n}>{n}px</option>)}</select></label>
      <label>Height<select value={snapshotHeight} onChange={e => setSnapshotHeight(Number(e.target.value))}>{[160, 200, 240, 300, 360, 420, 480, 600, 720, 900, 1000, 1200].map(n => <option key={n} value={n}>{n}px</option>)}</select></label>
      <button type="button" aria-pressed={!manualCrop} onClick={() => { setManualCrop(false); fitBuild(); }}>Auto frame</button>
      <button type="button" aria-pressed={manualCrop} onClick={() => setManualCrop(true)}>Manual crop</button>
</div>}
      <div className="tree-toolbar">
      <label>Tree version<select value={version} onChange={e => { setVersion(e.target.value); setStageIndex(0); setQuery(''); if (onApply) { setRespec(undefined); setBuild(null); setInheritedNodes([]); setMarkers([]); setManualCrop(false); } }}>{treeVersions.map(v => <option key={v} value={v}>{v}{v === '3.29.1' ? ' · Current' : ' · Guide example'}</option>)}</select></label>
      <label>Class<select value={classId} disabled={!!stage && !onApply} onChange={e => { const id = Number(e.target.value); setClassId(id); setSelected(null); setHover(null); setAscendancy(tree?.classes.find(c => c.id === id)?.ascendancies[0]?.id ?? ''); if (onApply) { updateCurrent({ classId: id, ascendancyId: 1, nodes: [], mastery: {} }); setRespec(undefined); setInheritedNodes([]); setMarkers([]); } }}>{tree?.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Ascendancy<select value={ascendancy} disabled={!!stage && !onApply} onChange={e => { setAscendancy(e.target.value); setSelected(null); setHover(null); if (onApply) updateCurrent({ ascendancyId: (currentClass?.ascendancies.findIndex(a => a.id === e.target.value) ?? -1) + 1 }); }}><option value="">None</option>{currentClass?.ascendancies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      {!initial && <><button type="button" ref={importButton} onClick={() => { setImportError(''); setImporting(true); }}>Import PoB</button>
      <button type="button" disabled={!example} onClick={() => example && useBuild(example)}>Sunder / RF example · 3.28</button></>}
      {build && <button type="button" onClick={() => { setRespec(undefined); setBuild(null); setInheritedNodes([]); setMarkers([]); setStageIndex(0); setSelected(null); }}>Clear build</button>}
    </div>
      {onApply && <p className="tree-picker-help">Click to allocate a path; click allocated nodes to refund. Drag numbers to reposition. Previous paths are dim gold; new paths are bright.</p>}
    </details> : <div className="tree-toolbar">
      <label>Tree version<select value={version} onChange={e => { setVersion(e.target.value); setStageIndex(0); setQuery(''); if (onApply) { setRespec(undefined); setBuild(null); setInheritedNodes([]); setMarkers([]); setManualCrop(false); } }}>{treeVersions.map(v => <option key={v} value={v}>{v}{v === '3.29.1' ? ' · Current' : ' · Guide example'}</option>)}</select></label>
      <label>Class<select value={classId} disabled={!!stage && !onApply} onChange={e => { const id = Number(e.target.value); setClassId(id); setSelected(null); setHover(null); setAscendancy(tree?.classes.find(c => c.id === id)?.ascendancies[0]?.id ?? ''); if (onApply) { updateCurrent({ classId: id, ascendancyId: 1, nodes: [], mastery: {} }); setRespec(undefined); setInheritedNodes([]); setMarkers([]); } }}>{tree?.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Ascendancy<select value={ascendancy} disabled={!!stage && !onApply} onChange={e => { setAscendancy(e.target.value); setSelected(null); setHover(null); if (onApply) updateCurrent({ ascendancyId: (currentClass?.ascendancies.findIndex(a => a.id === e.target.value) ?? -1) + 1 }); }}><option value="">None</option>{currentClass?.ascendancies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      {!initial && <><button type="button" ref={importButton} onClick={() => { setImportError(''); setImporting(true); }}>Import PoB</button>
      <button type="button" disabled={!example} onClick={() => example && useBuild(example)}>Sunder / RF example · 3.28</button></>}
      {build && <button type="button" onClick={() => { setRespec(undefined); setBuild(null); setInheritedNodes([]); setMarkers([]); setStageIndex(0); setSelected(null); }}>Clear build</button>}
    </div>}
    {!initial && <div className="tree-stage-bar">
      {stages.length ? <><label>Stage<select value={stageIndex} onChange={e => { setStageIndex(Number(e.target.value)); setSelected(null); }}>{stages.map((s, i) => <option value={i} key={i}>{s.title}</option>)}</select></label><button type="button" aria-label="Previous stage" disabled={!stageIndex} onClick={() => setStageIndex(i => i - 1)}>←</button><button type="button" aria-label="Next stage" disabled={stageIndex === stages.length - 1} onClick={() => setStageIndex(i => i + 1)}>→</button><label className="tree-compare"><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />Compare previous stage</label><span className="tree-point-count">{pointCount} main-tree passives</span></> : <p>{build ? `This PoB has no ${version.split('.').slice(0, 2).join('.')} stages. Switch tree versions to view its allocations.` : 'Explore the tree, import a PoB, or load the 3.28 guide example to see leveling stages.'}</p>}
    </div>}
    {respec && <div className="tree-respec-summary"><strong className="respec-remove">Remove {removed.size}</strong><strong className="respec-add">Add {added.size}</strong><span>Dim gold: keep · dashed red: remove · solid green: add</span>{onApply ? <label>Refund / respec note<input aria-label="Respec note" value={respec.note} placeholder="e.g. 14 quest refunds, remaining points from gold" onChange={event => setRespec(current => current ? { ...current, note: event.target.value } : current)} /></label> : respec.note && <p>{respec.note}</p>}</div>}
    {onApply && editingStep !== null && <div className="tree-group-editing" role="status">Editing step {markers.findIndex(m => m.nodeId === editingStep) + 1}: click nodes to add or remove them from this step. <button type="button" onClick={() => setEditingStep(null)}>Done selecting nodes</button></div>}
    <div className="tree-layout">
      <div className="tree-map" ref={container}>
        <canvas ref={canvas} draggable={false} onDragStart={event => { event.preventDefault(); event.stopPropagation(); }} tabIndex={0} aria-label={`${version} passive tree. Drag to pan; scroll or pinch to zoom. Use arrow keys to pan, plus and minus to zoom, Home to fit. Search nodes to inspect them using the keyboard.`}
          onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.focus({ preventScroll: true }); e.currentTarget.setPointerCapture(e.pointerId); const point = local(e); pointer.current.set(e.pointerId, { ...point, startX: point.x, startY: point.y }); moved.current = pointer.current.size > 1;
            if (pointer.current.size > 1) markerDrag.current = null;
            else if (onApply) {
              const marker = markerPositions(stage ? markers : [], nodes, camera, size).find(m => Math.abs(point.x - m.x) <= 17 && Math.abs(point.y - m.y) <= 17);
              markerDrag.current = marker ? { pointerId: e.pointerId, nodeId: marker.nodeId, startX: point.x, startY: point.y, offsetX: camera.x + (marker.x - size.width / 2) / camera.scale, offsetY: camera.y + (marker.y - size.height / 2) / camera.scale } : null;
            }
            setHover(null); }}
          onPointerMove={e => {
            const point = local(e), old = pointer.current.get(e.pointerId);
            if (!old) { if (e.pointerType !== 'touch') { const node = hit(point); setHover(node ? { node, ...point } : null); } return; }
            const others = [...pointer.current.entries()].filter(([id]) => id !== e.pointerId);
            pointer.current.set(e.pointerId, { ...old, ...point });
            if (Math.hypot(point.x - old.startX, point.y - old.startY) > 4) moved.current = true;
            const dragging = markerDrag.current;
            if (dragging?.pointerId === e.pointerId && !others.length) {
              if (moved.current) setMarkers(current => current.map(marker => marker.nodeId === dragging.nodeId ? { ...marker,
                positionX: dragging.offsetX + (point.x - dragging.startX) / camera.scale,
                positionY: dragging.offsetY + (point.y - dragging.startY) / camera.scale, offsetX: undefined, offsetY: undefined } : marker));
              return;
            }
            if (others.length) {
              const other = others[0][1], distance = Math.hypot(old.x - other.x, old.y - other.y), next = Math.hypot(point.x - other.x, point.y - other.y);
              if (distance > 0) setCamera(c => zoomAt(c, next / distance, (point.x + other.x) / 2, (point.y + other.y) / 2, size));
            } else setCamera(c => ({ ...c, x: c.x - (point.x - old.x) / c.scale, y: c.y - (point.y - old.y) / c.scale }));
          }}
          onPointerUp={e => { if (markerDrag.current?.pointerId === e.pointerId) markerDrag.current = null; if (pointer.current.has(e.pointerId) && !moved.current) { const point = local(e), marker = markerPositions(stage ? markers : [], nodes, camera, size).find(m => Math.hypot(point.x - m.x, point.y - m.y) <= 18); if (marker) { const destination = allById.get(marker.nodeId); if (destination && !(respec && removed.has(destination.id))) allocateNode(destination); setSelected(marker.nodeId); pointer.current.delete(e.pointerId); return; } const node = hit(point); if (node) { setSelected(node.id); if (editingStep !== null) editGroupNode(node); else toggleNode(node); } else setSelected(null); } pointer.current.delete(e.pointerId); }}
          onLostPointerCapture={e => { if (markerDrag.current?.pointerId === e.pointerId) markerDrag.current = null; pointer.current.delete(e.pointerId); }}
          onPointerCancel={e => { markerDrag.current = null; pointer.current.delete(e.pointerId); moved.current = true; }} onPointerLeave={() => setHover(null)}
          onKeyDown={e => {
            const delta = 70 / camera.scale;
            if (e.key.startsWith('Arrow')) { e.preventDefault(); setCamera(c => ({ ...c, x: c.x + (e.key === 'ArrowRight' ? delta : e.key === 'ArrowLeft' ? -delta : 0), y: c.y + (e.key === 'ArrowDown' ? delta : e.key === 'ArrowUp' ? -delta : 0) })); }
            else if (['+', '=', '-'].includes(e.key)) { e.preventDefault(); setCamera(c => zoomAt(c, e.key === '-' ? .8 : 1.25, size.width / 2, size.height / 2, size)); }
            else if (e.key === 'Home') { e.preventDefault(); fitBuild(); }
            else if (e.key === 'Escape') { setSelected(null); setHover(null); }
          }} />
        {!tree && <div className="tree-loading" role="status">{error || `Loading tree ${version}…`}{error && <button type="button" onClick={() => { setError(''); loadTree(version).then(setTree).catch(e => setError(e.message)); }}>Try again</button>}</div>}
        <div className="tree-map-controls"><button type="button" aria-pressed={view === 'tree'} onClick={() => { setView('tree'); setSelected(null); setHover(null); }}>Passive tree</button><button type="button" aria-pressed={view === 'ascendancy'} disabled={!ascendancy} onClick={() => { setView('ascendancy'); setSelected(null); setHover(null); }}>Ascendancy</button><button type="button" aria-label="Zoom in" onClick={() => setCamera(c => zoomAt(c, 1.3, size.width / 2, size.height / 2, size))}>+</button><button type="button" aria-label="Zoom out" onClick={() => setCamera(c => zoomAt(c, 1 / 1.3, size.width / 2, size.height / 2, size))}>−</button><button type="button" onClick={fitBuild}>{stage ? 'Fit build' : 'Fit tree'}</button><button type="button" onClick={() => setCamera(fit(nodes, size))}>Overview</button></div>
        {hover && !pointer.current.size && <div className="tree-hover" role="tooltip" style={{ left: Math.max(8, Math.min(hover.x + 14, size.width - 248)), top: hover.y > size.height - 130 ? Math.max(55, hover.y - 105) : hover.y + 14 }}><strong>{hover.node.name}</strong><span>{hover.node.stats.slice(0, 2).join(' · ') || (hover.node.kind === 'mastery' ? 'Mastery · click to inspect effects' : 'Class starting point')}</span><small>Click for node details</small></div>}
        <div className="tree-map-hint">Drag to pan · Scroll / pinch to zoom · Click to inspect</div>
      </div>
      <aside className="tree-inspector" aria-label="Node details">
        {onApply && markers.length > 0 && <label className="tree-group-select">Assign nodes to step<select aria-label="Assign nodes to step" value={editingStep ?? ''} onChange={event => setEditingStep(event.target.value === '' ? null : Number(event.target.value))}>
          <option value="">Normal allocation</option>{markers.map((marker, index) => <option key={marker.nodeId} value={marker.nodeId}>Step {index + 1}: {allById.get(marker.nodeId)?.name ?? marker.nodeId}</option>)}
        </select></label>}

        <label className="tree-search-label">Find a passive<input type="search" placeholder="Name or stat…" value={query} onChange={e => setQuery(e.target.value)} /></label>
        {query.trim() && <div className="tree-search-results"><p role="status">{matches.length} matching passives</p>{matches.slice(0, 12).map(n => <button type="button" key={n.id} onClick={() => { focusNode(n); if (editingStep !== null) editGroupNode(n); else if (!(respec && removed.has(n.id))) allocateNode(n); }}>{n.name}<small>{n.kind}</small></button>)}{matches.length > 12 && <p>Showing first 12. Refine your search.</p>}</div>}
        {selectedNode ? <div className="tree-node-detail" aria-live="polite"><span className="tree-node-kind">{selectedNode.kind} · #{selectedNode.id}</span><h3>{selectedNode.name}</h3>{onApply && <div className="tree-selection-actions"><button type="button" disabled={selectedNode.classStart !== null || selectedNode.ascendancyStart} onClick={() => toggleNode(selectedNode)}>{allocated.has(selectedNode.id) ? 'Deselect node' : 'Allocate path'}</button><button type="button" disabled={markers.some(m => m.nodeId === selectedNode.id) || markers.length >= 50} onClick={() => addMarker(selectedNode)}>Add step marker</button></div>}<p className={`tree-node-status ${removed.has(selectedNode.id) ? 'is-removed' : added.has(selectedNode.id) ? 'is-added' : ''}`}>{removed.has(selectedNode.id) ? 'Removed since previous stage' : added.has(selectedNode.id) ? 'Added in this stage' : allocated.has(selectedNode.id) ? 'Allocated in this stage' : 'Not allocated'}</p><ul>{selectedNode.stats.map((stat, i) => <li key={i}>{stat}</li>)}</ul>{selectedNode.reminder.map((r, i) => <p className="tree-reminder" key={i}>{r}</p>)}{selectedNode.masteryEffects.length > 0 && <div className="tree-mastery-effects"><h4>Mastery effects</h4>{selectedNode.masteryEffects.map(effect => <div key={effect.effect} className={stage?.mastery[selectedNode.id] === effect.effect ? 'is-selected' : ''}>{stage?.mastery[selectedNode.id] === effect.effect && <strong>Selected in this stage</strong>}{effect.stats.map((stat, i) => <p key={i}>{stat}</p>)}{onApply && <button type="button" onClick={() => updateCurrent({ nodes: [...new Set([...(stage?.nodes ?? []), selectedNode.id])], mastery: { ...stage?.mastery, [selectedNode.id]: effect.effect } })}>Use this effect</button>}</div>)}</div>}<button type="button" onClick={() => focusNode(selectedNode)}>Center on node</button></div> : <div className="tree-inspector-empty"><h3>Inspect a passive</h3><p>Click a node for its stats, or search above to find one.</p><p>{onApply ? 'Click a destination to allocate its shortest connecting path. The numbered markers explain which destination to take first.' : 'This is a read-only viewer. Clicking does not allocate points.'}</p></div>}
      </aside>
    </div>
    {!!stage && !!markers.length && <div className="tree-step-list"><h3>Take these in order</h3>{markers.map((marker, index) => <div className="tree-step-row" key={marker.nodeId}><button type="button" className="tree-step-number" aria-label={`Show step ${index + 1}: ${allById.get(marker.nodeId)?.name ?? marker.nodeId}`} onClick={() => { const node = allById.get(marker.nodeId); if (node) { if (!(respec && removed.has(node.id))) allocateNode(node); if (node.ascendancy) { setAscendancy(node.ascendancy); setView('ascendancy'); } else setView('tree'); focusNode(node); } }}>{index + 1}</button><div><strong>{allById.get(marker.nodeId)?.name ?? `Node ${marker.nodeId}`}</strong><small>{stepNodeIds(marker).length} {stepNodeIds(marker).length === 1 ? 'node' : 'nodes'}</small>{onApply ? <input aria-label={`Step ${index + 1} note`} placeholder="Optional instruction…" value={marker.note} onChange={e => setMarkers(current => current.map((m, i) => i === index ? { ...m, note: e.target.value } : m))} /> : marker.note && <p>{marker.note}</p>}</div>{onApply && <><button type="button" aria-pressed={editingStep === marker.nodeId} aria-label={`Choose nodes for step ${index + 1}`} onClick={() => { setEditingStep(editingStep === marker.nodeId ? null : marker.nodeId); const node = allById.get(marker.nodeId); if (node) focusNode(node); }}>{editingStep === marker.nodeId ? 'Done' : 'Choose nodes'}</button><button type="button" aria-label={`Move step ${index + 1} up`} disabled={index === 0} onClick={() => moveMarker(index, -1)}>↑</button><button type="button" aria-label={`Move step ${index + 1} down`} disabled={index === markers.length - 1} onClick={() => moveMarker(index, 1)}>↓</button><button type="button" aria-label={`Reset step ${index + 1} position`} disabled={!marker.offsetX && !marker.offsetY && marker.positionX === undefined} onClick={() => setMarkers(current => current.map((m, i) => i === index ? { ...m, offsetX: undefined, offsetY: undefined, positionX: undefined, positionY: undefined } : m))}>Reset position</button><button type="button" aria-label={`Remove step ${index + 1}`} onClick={() => { if (editingStep === marker.nodeId) setEditingStep(null); setMarkers(current => current.filter((_, i) => i !== index)); }}>Remove</button></>}</div>)}</div>}
    {onApply && tree && error && <p className="tree-warning" role="alert">{error}</p>}
    <div className="tree-legend"><span className="legend-allocated">Allocated</span>{previous && <><span className="legend-added">Added: +{added.size}</span><span className="legend-removed">Removed: −{removed.size}</span></>}<span className="legend-found">Search match</span><span>Tree {version}</span></div>
    {!!missing && <p className="tree-warning">{missing} allocated node IDs are not in this base-tree export. Jewel-added nodes and item modifications are not rendered.</p>}
    {spriteWarning && <p className="tree-warning">Some artwork could not load. Node positions and statistics are still available.</p>}
    <p className="tree-source">Official GGG tree data and artwork · <a href={`https://github.com/grindinggear/skilltree-export/tree/${version}`} target="_blank" rel="noopener noreferrer">Source {version}</a>{build?.source && <> · <a href={build.source} target="_blank" rel="noopener noreferrer">Example PoB</a></>} · No item calculations or jewel transformations.</p>
    <dialog ref={dialog} className="tree-import-dialog" onCancel={e => { e.preventDefault(); e.stopPropagation(); if (!importBusy) setImporting(false); }} onClick={e => { if (e.target === dialog.current && !importBusy) setImporting(false); }} aria-labelledby="tree-import-title"><div><h2 id="tree-import-title">Import passive-tree stages</h2><p>Paste a Path of Building export code, or select its XML file. Supports 3.28 and 3.29. {onApply ? 'Choose a stage, then Apply to guide to keep it in this snapshot.' : 'This preview keeps imports only until you reload.'}</p><label>PoB export<textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="Paste PoB export code or XML…" rows={5} /></label><label>Or choose a file<input type="file" accept=".xml,.txt" disabled={importBusy} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; if (file.size > 2_000_000) { setImportError('Choose a file smaller than 2 MB.'); return; } await importPob(await file.text()); }} /></label>{importError && <p className="tree-warning" role="alert">{importError}</p>}<div className="tree-import-actions"><button type="button" disabled={importBusy} onClick={() => setImporting(false)}>Cancel</button><button type="button" disabled={!importText.trim() || importBusy} onClick={() => void importPob(importText)}>{importBusy ? 'Importing…' : 'Import stages'}</button></div></div></dialog>
  </section>;
}
