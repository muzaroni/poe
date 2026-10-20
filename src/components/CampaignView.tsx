import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/core';
import { campaignAscendancySteps, campaignMarkers, type CampaignAscendancySnapshot, type CampaignGemStage, type GuideRegex } from '../lib/campaign';
import { assetUrl, plainText } from '../lib/guide';
import { gemDisplayName } from '../lib/gems';
import { gemLinkGroups, gemSocketOptions } from '../lib/gem-links';
import { gemRequiredLevel } from '../lib/gem-vendor';
import { drawPassiveTree } from '../lib/tree-render';
import { cameraForFrame, frameNodes, markerPositions, progressionNodes, snapshotNodes, snapshotStage, stepNodeIds, treeEdges, type TreeSnapshotData } from '../lib/tree-snapshot';
import { nodeRadius, type PassiveNode, type PassiveTree } from '../lib/passive-tree';
import RegexCopyButton from './RegexCopyButton';
import GemAcquisitionSummary from './GemAcquisitionSummary';
import '../styles/campaign.css';

type Props = { snapshot: TreeSnapshotData; tree: PassiveTree | null; sprites: HTMLImageElement[]; guideGemLinks?: Record<string, CampaignGemStage[]>; guideRegexes?: GuideRegex[]; guideAscendancy?: CampaignAscendancySnapshot[]; guideCharacterAscendancy?: string; guideLeague?: string; guideSlug?: string; onClose: () => void };
const acts = Array.from({ length: 10 }, (_, index) => index + 1);
const emptyAscendancy: CampaignAscendancySnapshot[] = [];

function AscendancyIcon({ node, sprites }: { node: PassiveNode; sprites: HTMLImageElement[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const icon = node.active ?? node.inactive;
    if (!element || !icon) return;
    const image = sprites[icon[0]];
    if (!image?.naturalWidth) return;
    const context = element.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, 36, 36);
    context.save();
    context.beginPath(); context.arc(18, 18, 17, 0, Math.PI * 2); context.clip();
    context.drawImage(image, icon[1], icon[2], icon[3], icon[4], 1, 1, 34, 34);
    context.restore();
  }, [node, sprites]);
  return <canvas className="campaign-ascendancy-icon" ref={canvas} width="36" height="36" aria-hidden="true" />;
}

function GemInline({ node, league }: { node: JSONContent; league: string }) {
  if (node.type === 'gem') {
    const name = String(node.attrs?.name ?? '');
    const level = gemRequiredLevel(name, league);
    return <><span className={`gem gem-${node.attrs?.color ?? 'red'}`}>{gemDisplayName(name)}</span>{level !== null && <span className="campaign-gem-level" title={`Requires level ${level}`}> [{level}]</span>}</>;
  }
  if (node.type === 'icon') return <img className="inline-icon" src={assetUrl(String(node.attrs?.src ?? ''))} alt={String(node.attrs?.name ?? '')} />;
  let value: ReactNode = node.text ?? '';
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') value = <strong>{value}</strong>;
    if (mark.type === 'italic') value = <em>{value}</em>;
    if (mark.type === 'textStyle' && mark.attrs?.color) value = <span style={{ color: String(mark.attrs.color) }}>{value}</span>;
  }
  return <>{value}</>;
}

function CampaignGemRow({ node, league, checked, onToggle }: { node: JSONContent; league: string; checked: boolean; onToggle: (checked: boolean) => void }) {
  const setup = gemLinkGroups(node);
  if (!setup) return null;
  return <label className={`campaign-gem-row${checked ? ' is-done' : ''}`}><input type="checkbox" checked={checked} onChange={event => onToggle(event.target.checked)} aria-label={`Mark ${setup.title} gem links complete`} /><strong>{setup.title}</strong><span>{setup.groups.map((group, groupIndex) => <span key={groupIndex}>{groupIndex > 0 && <span className="campaign-gem-separator">, </span>}{group.map((row, rowIndex) => <span key={rowIndex}>{rowIndex > 0 && <span className="campaign-gem-separator"> + </span>}{gemSocketOptions(row).map((option, optionIndex) => <span key={optionIndex}>{optionIndex > 0 && <span className="campaign-gem-separator"> or </span>}{option.map((item, itemIndex) => <GemInline key={itemIndex} node={item} league={league} />)}</span>)}</span>)}</span>)}</span></label>;
}

function zoomAt(camera: { x: number; y: number; scale: number }, factor: number, x: number, y: number, size: { width: number; height: number }) {
  const scale = Math.max(.008, Math.min(.85, camera.scale * factor));
  return { scale, x: camera.x + (x - size.width / 2) * (1 / camera.scale - 1 / scale), y: camera.y + (y - size.height / 2) * (1 / camera.scale - 1 / scale) };
}

export default function CampaignView({ snapshot, tree, sprites, guideGemLinks, guideRegexes = [], guideAscendancy = emptyAscendancy, guideCharacterAscendancy = '', guideLeague = '', guideSlug = '', onClose }: Props) {
  const [act, setAct] = useState(1);
  const [treeView, setTreeView] = useState<'tree' | 'ascendancy'>('tree');
  const [selected, setSelected] = useState<number | null>(null);
  const [inspected, setInspected] = useState<number | null>(null);
  const [regexIndex, setRegexIndex] = useState(0);
  const [size, setSize] = useState({ width: 900, height: 600, dpr: 1 });
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: .03 });
  const [sideScale, setSideScale] = useState(1);
  const [checkedGems, setCheckedGems] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(`poe-campaign-gems:${guideSlug}`) ?? '{}'); } catch { return {}; }
  });
  const map = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const side = useRef<HTMLElement>(null);
  const sideContent = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const ignoreClick = useRef(false);
  const pendingFocus = useRef<number | null>(null);
  const nodes = useMemo(() => tree ? snapshotNodes(tree, { ...snapshot, view: treeView }) : [], [tree, snapshot, treeView]);
  const edges = useMemo(() => treeEdges(nodes), [nodes]);
  const allocated = useMemo(() => new Set([...snapshot.nodes, ...guideAscendancy.filter(source => source.snapshot.classId === snapshot.classId && source.snapshot.ascendancyId === snapshot.ascendancyId).flatMap(source => source.snapshot.nodes)]), [snapshot, guideAscendancy]);
  const actMarkers = useMemo(() => campaignMarkers(snapshot.markers, act), [snapshot.markers, act]);
  const markers = useMemo(() => actMarkers.filter(marker => nodes.some(node => node.id === marker.nodeId)), [actMarkers, nodes]);
  const ascendancySteps = useMemo(() => tree ? campaignAscendancySteps(tree, snapshot, guideAscendancy) : [], [tree, snapshot, guideAscendancy]);
  const actAscendancy = ascendancySteps.filter(step => step.act === act);
  const actAscendancySnapshot = guideAscendancy.find(source => source.act === act && source.snapshot.classId === snapshot.classId && source.snapshot.ascendancyId === snapshot.ascendancyId);
  const completedMarkers = useMemo(() => acts.slice(0, act).flatMap(number => campaignMarkers(snapshot.markers, number)), [snapshot.markers, act]);
  const progressId = selected && markers.some(marker => marker.nodeId === selected) ? selected : completedMarkers.at(-1)?.nodeId ?? null;
  const progression = useMemo(() => {
    if (treeView !== 'ascendancy') return progressId === null ? null : progressionNodes(nodes, snapshot, progressId);
    const byId = new Map(nodes.map(node => [node.id, node]));
    const parents = new Map<number, number | null>();
    const queue = nodes.filter(node => node.ascendancyStart);
    queue.forEach(node => parents.set(node.id, null));
    for (let index = 0; index < queue.length; index++) {
      for (const id of queue[index].out) {
        const next = byId.get(id);
        if (!next || !allocated.has(id) || parents.has(id)) continue;
        parents.set(id, queue[index].id);
        queue.push(next);
      }
    }
    const visible = new Set<number>(queue.filter(node => node.ascendancyStart).map(node => node.id));
    const refunded = new Set(ascendancySteps.filter(value => value.action === 'refund' && value.act <= act).map(value => value.node.id));
    for (const step of ascendancySteps.filter(value => value.action === 'allocate' && value.act <= act && !refunded.has(value.node.id))) {
      let id: number | null = step.node.id;
      while (id !== null && !visible.has(id)) { visible.add(id); id = parents.get(id) ?? null; }
    }
    return visible;
  }, [treeView, nodes, allocated, ascendancySteps, act, snapshot, progressId]);
  const frame = useMemo(() => frameNodes(nodes.filter(node => allocated.has(node.id))) ?? frameNodes(nodes), [nodes, allocated]);
  const fittedCamera = useMemo(() => frame ? cameraForFrame(frame, size, 70) : { x: 0, y: 0, scale: .03 }, [frame, size]);
  const positions = useMemo(() => markerPositions(markers, nodes, camera, size), [markers, nodes, camera, size]);
  const inspectedNode = inspected === null ? null : nodes.find(node => node.id === inspected) ?? null;
  const masteryEffect = inspectedNode?.masteryEffects.find(effect => effect.effect === snapshot.mastery[inspectedNode.id]);
  const regexes = guideRegexes.length ? guideRegexes : snapshot.campaignRegex ? [snapshot.campaignRegex] : [];
  const regex = regexes[Math.min(regexIndex, regexes.length - 1)];
  function focusNode(id: number, view: 'tree' | 'ascendancy' = treeView) {
    const node = tree?.nodes.find(value => value.id === id);
    if (!node) return;
    setTreeView(view);
    setSelected(id);
    setInspected(id);
    pendingFocus.current = id;
    setCamera(current => ({ x: node.x, y: node.y, scale: Math.max(view === 'ascendancy' ? .16 : .24, current.scale) }));
  }
  function inspectAt(x: number, y: number) {
    const marker = positions.find(position => Math.hypot(position.x - x, position.y - y) < 22);
    if (marker) { focusNode(marker.nodeId); return; }
    let nearest: typeof inspectedNode = null, distance = Infinity;
    for (const node of nodes) {
      const px = (node.x - camera.x) * camera.scale + size.width / 2;
      const py = (node.y - camera.y) * camera.scale + size.height / 2;
      const delta = Math.hypot(px - x, py - y);
      if (delta < Math.max(9, nodeRadius(node) * camera.scale + 5) && delta < distance) { nearest = node; distance = delta; }
    }
    setInspected(nearest?.id ?? null);
  }

  useEffect(() => {
    if (!map.current) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height, dpr: Math.min(window.devicePixelRatio || 1, 2) }));
    observer.observe(map.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!side.current || !sideContent.current) return;
    const measure = () => {
      if (!side.current || !sideContent.current) return;
      setSideScale(Math.min(1, side.current.clientHeight / Math.max(1, sideContent.current.scrollHeight)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(side.current);
    observer.observe(sideContent.current);
    measure();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const target = tree?.nodes.find(node => node.id === pendingFocus.current);
    pendingFocus.current = null;
    setCamera(target ? { x: target.x, y: target.y, scale: Math.max(treeView === 'ascendancy' ? .16 : .24, fittedCamera.scale) } : fittedCamera);
  }, [fittedCamera, tree, treeView]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      setCamera(current => zoomAt(current, Math.exp(-Math.max(-300, Math.min(300, event.deltaY)) * .002), event.clientX - rect.left, event.clientY - rect.top, size));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [size]);
  useEffect(() => {
    if (!canvas.current || !tree) return;
    drawPassiveTree(canvas.current, { camera, size, nodes, edges, sprites, allocated, progression, selected: inspected ?? selected, emphasized: new Set(markers.filter(marker => marker.nodeId === selected).flatMap(stepNodeIds)), stage: snapshotStage(snapshot), classId: snapshot.classId, markers });
  }, [tree, camera, size, nodes, edges, sprites, allocated, progression, selected, inspected, markers, snapshot]);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowRight' && act < 10) { event.preventDefault(); setAct(act + 1); setSelected(null); }
      if (event.key === 'ArrowLeft' && act > 1) { event.preventDefault(); setAct(act - 1); setSelected(null); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [act]);

  const gemLines = (snapshot.campaignGems?.[act] ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const guideStages = guideGemLinks?.[act] ?? [];
  function toggleGemRow(key: string, checked: boolean) {
    setCheckedGems(current => {
      const next = { ...current, [key]: checked };
      try { localStorage.setItem(`poe-campaign-gems:${guideSlug}`, JSON.stringify(next)); } catch { /* private browsing */ }
      return next;
    });
  }
  function chooseAct(next: number) { setAct(next); setSelected(null); setInspected(null); }
  return <div className="campaign-view" aria-label="Full campaign view">
    <header className="campaign-header"><div><strong>{snapshot.title}</strong><span>Full campaign · Tree {snapshot.version}</span></div><div className="campaign-header-actions"><button type="button" disabled={act === 1} onClick={() => chooseAct(act - 1)}>← Previous</button><button type="button" disabled={act === 10} onClick={() => chooseAct(act + 1)}>Next →</button><button type="button" onClick={onClose}>Close</button></div></header>
    <nav className="campaign-acts" aria-label="Choose campaign act">{acts.map(number => <button type="button" key={number} className={number === act ? 'is-current' : ''} aria-current={number === act ? 'step' : undefined} onClick={() => chooseAct(number)}>Act {number}{campaignMarkers(snapshot.markers, number).length > 0 && <small>{campaignMarkers(snapshot.markers, number).length}</small>}{guideAscendancy.some(source => source.act === number && source.snapshot.classId === snapshot.classId && source.snapshot.ascendancyId === snapshot.ascendancyId) && <small className="campaign-act-lab">Lab</small>}</button>)}</nav>
    {regex && <div className="campaign-regex"><span>REGEX</span>{regexes.length > 1 ? <select aria-label="Choose regex" value={regexIndex} onChange={event => setRegexIndex(Number(event.target.value))}>{regexes.map((item, index) => <option key={index} value={index}>{item.label}</option>)}</select> : <strong title={regex.label}>{regex.label}</strong>}<code title={regex.value}>{regex.value}</code><RegexCopyButton label={regex.label} value={regex.value} /></div>}
    <div className="campaign-main"><div className="campaign-map" ref={map}><canvas ref={canvas} aria-label={`${treeView === 'tree' ? 'Full passive' : 'Ascendancy'} tree with Act ${act} markers. Click any node to inspect it; drag to pan and scroll to zoom.`} onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); pointer.current = { x: event.clientX, y: event.clientY, moved: false }; }} onPointerMove={event => { const previous = pointer.current; if (!previous) return; const dx = event.clientX - previous.x, dy = event.clientY - previous.y; if (Math.abs(dx) + Math.abs(dy) > 2) previous.moved = true; pointer.current = { x: event.clientX, y: event.clientY, moved: previous.moved }; if (previous.moved) setCamera(current => ({ ...current, x: current.x - dx / current.scale, y: current.y - dy / current.scale })); }} onPointerUp={event => { ignoreClick.current = !!pointer.current?.moved; pointer.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { pointer.current = null; }} onClick={event => { if (ignoreClick.current) { ignoreClick.current = false; return; } const rect = event.currentTarget.getBoundingClientRect(); inspectAt(event.clientX - rect.left, event.clientY - rect.top); }} /><div className="campaign-map-controls"><button type="button" aria-pressed={treeView === 'tree'} onClick={() => { setTreeView('tree'); setSelected(null); setInspected(null); }}>Passive tree</button><button type="button" aria-pressed={treeView === 'ascendancy'} disabled={!ascendancySteps.length} onClick={() => { setTreeView('ascendancy'); setSelected(null); setInspected(null); }}>Ascendancy</button><button type="button" onClick={() => setCamera(fittedCamera)}>Fit tree</button><button type="button" aria-label="Zoom in" onClick={() => setCamera(current => zoomAt(current, 1.3, size.width / 2, size.height / 2, size))}>+</button><button type="button" aria-label="Zoom out" onClick={() => setCamera(current => zoomAt(current, 1 / 1.3, size.width / 2, size.height / 2, size))}>−</button></div>{inspectedNode && <div className="campaign-node-detail"><button type="button" aria-label="Close passive details" onClick={() => setInspected(null)}>×</button><small>{inspectedNode.kind} · #{inspectedNode.id}</small><strong>{inspectedNode.name}</strong>{inspectedNode.stats.map((stat, index) => <p key={index}>{stat}</p>)}{masteryEffect && <div className="campaign-mastery-detail"><b>Selected mastery effect</b>{masteryEffect.stats.map((stat, index) => <p key={index}>{stat}</p>)}</div>}</div>}{!tree && <p>Loading passive tree…</p>}</div>
      <aside className="campaign-side" ref={side}><div className="campaign-side-content" ref={sideContent} style={{ transform: `scale(${sideScale})` }}><section className="campaign-steps"><h2>Act {act} tree steps <span>{actMarkers.length}</span></h2><div className="campaign-step-scroll">{actMarkers.length ? actMarkers.map(marker => <button type="button" key={marker.nodeId} className={marker.nodeId === selected ? 'is-selected' : ''} onClick={() => focusNode(marker.nodeId, tree?.nodes.find(node => node.id === marker.nodeId)?.ascendancy ? 'ascendancy' : 'tree')}><b>{marker.displayNumber}</b><span><strong>{tree?.nodes.find(node => node.id === marker.nodeId)?.name ?? `Node ${marker.nodeId}`}</strong>{marker.note && <small>{marker.note}</small>}</span></button>) : <p>No tree steps assigned to this act yet.</p>}</div></section>
        {(actAscendancySnapshot || actAscendancy.length > 0) && <section className="campaign-ascendancy"><h2>{actAscendancySnapshot?.snapshot.title ?? actAscendancy[0].lab}<button type="button" onClick={() => { setTreeView('ascendancy'); setSelected(null); setInspected(null); }}>View tree</button></h2><div className="campaign-step-scroll">{actAscendancy.length ? actAscendancy.map(step => <button type="button" key={`${step.action}-${step.node.id}`} className={`${step.node.id === selected ? 'is-selected ' : ''}${step.action === 'refund' ? 'is-refund' : ''}`} onClick={() => focusNode(step.node.id, 'ascendancy')}><b>{step.action === 'refund' ? 'Refund' : 'Take'}</b><AscendancyIcon node={step.node} sprites={sprites} /><span><strong>{step.node.name}</strong><small>{step.node.stats.join(' · ')}</small></span></button>) : <p>No notable changes in this tree.</p>}</div></section>}
        <section className="campaign-gems"><h2>Act {act} gem links</h2>{guideStages.length ? guideStages.map((stage, stageIndex) => <div className="campaign-gem-stage" key={`${stageIndex}:${stage.title}`}><h3><span className="campaign-stage-number">{String(stageIndex + 1).padStart(2, '0')}</span>{stage.title}</h3><GemAcquisitionSummary nodes={stage.acquisitionNodes} ascendancy={guideCharacterAscendancy} league={guideLeague} /><div className="campaign-gem-list">{stage.rows.map((row, index) => { const key = stageIndex === guideStages.length - 1 ? `${act}:${index}:${plainText(row)}` : `${act}:stage${stageIndex}:${index}:${plainText(row)}`; return <CampaignGemRow key={key} node={row} league={guideLeague || snapshot.version} checked={!!checkedGems[key]} onToggle={checked => toggleGemRow(key, checked)} />; })}</div></div>) : gemLines.length ? <div className="campaign-gem-list">{gemLines.map((line, index) => { const key = `${act}:raw:${index}:${line}`; return <label key={key} className={`campaign-gem-row is-raw${checkedGems[key] ? ' is-done' : ''}`}><input type="checkbox" checked={!!checkedGems[key]} onChange={event => toggleGemRow(key, event.target.checked)} aria-label={`Mark ${line} complete`} /><span>{line}</span></label>; })}</div> : <p>No gem links added for this act yet.</p>}</section></div></aside>
    </div>
  </div>;
}
