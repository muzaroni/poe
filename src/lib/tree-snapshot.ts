import type { PassiveNode, PassiveTree, TreeStage } from './passive-tree';

export type TreeMarker = { nodeId: number; note: string; actDivider?: string; displayNumber?: number; nodeIds?: number[]; positionX?: number; positionY?: number; offsetX?: number; offsetY?: number };
export type TreeFrame = { x: number; y: number; width: number; height: number };
export type TreeRespec = { title: string; version: string; classId: number; ascendancyId: number; nodes: number[]; mastery: Record<string, number>; note: string };
export type TreeSnapshotData = {
  title: string; version: string; classId: number; ascendancyId: number;
  respec?: TreeRespec; nodes: number[]; inheritedNodes?: number[]; mastery: Record<string, number>; markers: TreeMarker[];
  ascendancyNumbering?: 'automatic' | 'manual'; campaignMode?: boolean; campaignGems?: Record<string, string>; campaignRegex?: { label: string; value: string }; width: number; height: number; view: 'tree' | 'ascendancy'; frame: TreeFrame | null;
};
export type TreeCamera = { x: number; y: number; scale: number };
export type TreeSize = { width: number; height: number; dpr: number };
export function normalizeSnapshot(value: Partial<TreeSnapshotData> = {}): TreeSnapshotData {
  const bounded = (n: unknown, fallback: number, min: number, max: number) => Number.isFinite(n) ? Math.min(max, Math.max(min, Number(n))) : fallback;
  const nodes = [...new Set((Array.isArray(value.nodes) ? value.nodes : []).filter(id => Number.isInteger(id) && id >= 0))].slice(0, 6000);
  const markers = (Array.isArray(value.markers) ? value.markers : []).filter((m, index, all) => Number.isInteger(m.nodeId) && m.nodeId >= 0 && all.findIndex(other => other.nodeId === m.nodeId) === index).slice(0, 50).map(m => ({ nodeId: m.nodeId, note: String(m.note ?? '').slice(0, 1000), actDivider: typeof m.actDivider === 'string' ? m.actDivider.trim().slice(0, 60) || undefined : undefined, positionX: Number.isFinite(m.positionX) && Number.isFinite(m.positionY) ? m.positionX : undefined, positionY: Number.isFinite(m.positionX) && Number.isFinite(m.positionY) ? m.positionY : undefined, nodeIds: Array.isArray(m.nodeIds) ? [...new Set(m.nodeIds.filter(id => Number.isInteger(id) && id >= 0))].slice(0, 500) : undefined, offsetX: Number.isFinite(m.offsetX) ? Math.max(-5000, Math.min(5000, m.offsetX!)) : undefined, offsetY: Number.isFinite(m.offsetY) ? Math.max(-5000, Math.min(5000, m.offsetY!)) : undefined }));
  const f = value.frame;
  const frame = f && [f.x, f.y, f.width, f.height].every(Number.isFinite) && f.width > 0 && f.height > 0 ? { x: f.x, y: f.y, width: f.width, height: f.height } : null;
  return {
    title: String(value.title ?? 'Passive tree').slice(0, 160), version: typeof value.version === 'string' ? value.version : '3.29.1',
    classId: bounded(value.classId, 1, 0, 6), ascendancyId: bounded(value.ascendancyId, 3, 0, 10), nodes,
    mastery: value.mastery && typeof value.mastery === 'object' ? Object.fromEntries(Object.entries(value.mastery).filter(([id, effect]) => /^\d+$/.test(id) && Number.isInteger(effect))) : {},
    inheritedNodes: [...new Set((Array.isArray(value.inheritedNodes) ? value.inheritedNodes : []).filter(id => Number.isInteger(id) && id >= 0))].slice(0, 6000),
    respec: value.respec && typeof value.respec === 'object' ? {
      title: String(value.respec.title ?? 'Before respec').slice(0, 160), version: String(value.respec.version ?? value.version ?? '3.29.1'),
      classId: bounded(value.respec.classId, 1, 0, 6), ascendancyId: bounded(value.respec.ascendancyId, 0, 0, 10),
      nodes: [...new Set((Array.isArray(value.respec.nodes) ? value.respec.nodes : []).filter(id => Number.isInteger(id) && id >= 0))].slice(0, 6000),
      mastery: Object.fromEntries(Object.entries(value.respec.mastery ?? {}).filter(([id, effect]) => /^\d+$/.test(id) && Number.isInteger(effect))), note: String(value.respec.note ?? '').slice(0, 2000),
    } : undefined,
    ascendancyNumbering: value.ascendancyNumbering === 'manual' ? 'manual' : undefined,
    campaignMode: value.campaignMode === true || undefined,
    campaignGems: value.campaignGems && typeof value.campaignGems === 'object' ? Object.fromEntries(Object.entries(value.campaignGems).filter(([act, links]) => /^(?:10|[1-9])$/.test(act) && typeof links === 'string').map(([act, links]) => [act, links.slice(0, 3000)])) : undefined,
    campaignRegex: value.campaignRegex && typeof value.campaignRegex.value === 'string' && value.campaignRegex.value.trim() ? { label: String(value.campaignRegex.label ?? 'Regex').slice(0, 160), value: value.campaignRegex.value.slice(0, 3000) } : undefined,
    markers, frame, view: value.view === 'ascendancy' ? 'ascendancy' : 'tree',
    width: bounded(value.width, 480, 240, 1000), height: bounded(value.height, 240, 120, 1200),
  };
}
export function snapshotStage(data: TreeSnapshotData): TreeStage {
  return { title: data.title, version: data.version, classId: data.classId, ascendancyId: data.ascendancyId, nodes: data.nodes, mastery: data.mastery };
}
export function snapshotNodes(tree: PassiveTree, data: TreeSnapshotData) {
  const ascendancy = tree.classes.find(c => c.id === data.classId)?.ascendancies[data.ascendancyId - 1]?.id;
  return tree.nodes.filter(n => !n.bloodline && (data.view === 'tree' ? !n.ascendancy : n.ascendancy === ascendancy));
}
export function frameNodes(nodes: PassiveNode[]): TreeFrame | null {
  if (!nodes.length) return null;
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const left = Math.min(...xs) - 210, right = Math.max(...xs) + 210, top = Math.min(...ys) - 210, bottom = Math.max(...ys) + 210;
  return { x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top };
}
export function cameraForFrame(frame: TreeFrame, size: TreeSize, padding = 16): TreeCamera {
  return { x: frame.x, y: frame.y, scale: Math.max(.001, Math.min((size.width - padding * 2) / frame.width, (size.height - padding * 2) / frame.height)) };
}
export function cropViewport(size: TreeSize, width: number, height: number) {
  const aspect = width / height, cropWidth = Math.max(1, Math.min(size.width - 20, (size.height - 20) * aspect));
  return { x: (size.width - cropWidth) / 2, y: (size.height - cropWidth / aspect) / 2, width: cropWidth, height: cropWidth / aspect };
}
export function captureFrame(camera: TreeCamera, size: TreeSize, width: number, height: number): TreeFrame {
  const crop = cropViewport(size, width, height);
  return { x: camera.x, y: camera.y, width: crop.width / camera.scale, height: crop.height / camera.scale };
}
export function treeEdges(nodes: PassiveNode[]) {
  const byId = new Map(nodes.map(n => [n.id, n])), seen = new Set<string>();
  return nodes.flatMap(node => node.out.flatMap(id => {
    const other = byId.get(id), key = [node.id, id].sort((a, b) => a - b).join(':');
    if (!other || seen.has(key)) return [];
    seen.add(key); return [[node, other] as [PassiveNode, PassiveNode]];
  }));
}
export function markerPositions(markers: TreeMarker[], nodes: PassiveNode[], camera: TreeCamera, size: TreeSize) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  return markers.flatMap((marker, index) => {
    const node = byId.get(marker.nodeId);
    if (!node) return [];
    return [{ ...marker, number: marker.displayNumber ?? index + 1, node, x: ((marker.positionX ?? node.x + (marker.offsetX ?? 0)) - camera.x) * camera.scale + size.width / 2 + (marker.positionX === undefined ? -19 : 0), y: ((marker.positionY ?? node.y + (marker.offsetY ?? 0)) - camera.y) * camera.scale + size.height / 2 + (marker.positionY === undefined ? 18 : 0) }];
  });
}

// Walk only allocated connections from the class start, keeping earlier steps visible.
export function progressionNodes(nodes: PassiveNode[], snapshot: TreeSnapshotData, selected: number | null): Set<number> | null {
  const step = snapshot.markers.findIndex(marker => marker.nodeId === selected);
  if (step < 0) return null;
  const allocated = new Set(snapshot.nodes);
  const roots = nodes.filter(node => snapshot.view === 'ascendancy' ? node.ascendancyStart : node.classStart === snapshot.classId);
  roots.forEach(node => allocated.add(node.id));
  const adjacency = new Map<number, number[]>();
  for (const [a, b] of treeEdges(nodes)) {
    if (!allocated.has(a.id) || !allocated.has(b.id)) continue;
    adjacency.set(a.id, [...(adjacency.get(a.id) ?? []), b.id]);
    adjacency.set(b.id, [...(adjacency.get(b.id) ?? []), a.id]);
  }
  const parents = new Map<number, number | null>(roots.map(node => [node.id, null]));
  const queue = roots.map(node => node.id);
  for (let i = 0; i < queue.length; i++) {
    for (const id of adjacency.get(queue[i]) ?? []) {
      if (parents.has(id)) continue;
      parents.set(id, queue[i]); queue.push(id);
    }
  }
  const highlighted = new Set<number>((snapshot.inheritedNodes ?? []).filter(id => allocated.has(id)));
  for (const marker of snapshot.markers.slice(0, step + 1)) {
    for (const destination of stepNodeIds(marker)) {
    let id: number | null = destination;
    highlighted.add(id);
    while (id !== null && parents.has(id)) {
      highlighted.add(id); id = parents.get(id) ?? null;
    }
  }
  }
  return highlighted;
}

// Find the fewest new connections from the existing, connected allocation.
export function shortestAllocationPath(nodes: PassiveNode[], allocated: Set<number>, classId: number, targetId: number): number[] | null {
  const target = nodes.find(node => node.id === targetId);
  if (!target) return null;
  const allowed = nodes.filter(node => !node.bloodline && node.ascendancy === target.ascendancy && (node.classStart === null || node.classStart === classId));
  const roots = allowed.filter(node => target.ascendancy ? node.ascendancyStart : node.classStart === classId);
  const adjacency = new Map<number, number[]>();
  for (const [a, b] of treeEdges(allowed)) {
    adjacency.set(a.id, [...(adjacency.get(a.id) ?? []), b.id]);
    adjacency.set(b.id, [...(adjacency.get(b.id) ?? []), a.id]);
  }
  const byId = new Map(allowed.map(node => [node.id, node]));
  const connected = new Set(roots.map(node => node.id));
  const queue = [...connected];
  for (let i = 0; i < queue.length; i++) {
    if (byId.get(queue[i])?.kind === 'mastery') continue;
    for (const id of adjacency.get(queue[i]) ?? []) {
      if (!allocated.has(id) || connected.has(id)) continue;
      connected.add(id); queue.push(id);
    }
  }
  const parents = new Map<number, number | null>(queue.map(id => [id, null]));
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (current === targetId) {
      const path: number[] = [];
      let id: number | null = current;
      while (id !== null) { path.push(id); id = parents.get(id) ?? null; }
      return path.reverse();
    }
    if (byId.get(current)?.kind === 'mastery') continue;
    for (const id of adjacency.get(current) ?? []) {
      if (parents.has(id)) continue;
      parents.set(id, current); queue.push(id);
    }
  }
  return null;
}

// Refund the removed node and any branch it disconnects, within the same tree.
export function unallocateBranch(nodes: PassiveNode[], allocated: Set<number>, classId: number, targetId: number): number[] {
  const target = nodes.find(node => node.id === targetId);
  if (!target || target.classStart !== null || target.ascendancyStart) return [...allocated];
  const domain = nodes.filter(node => !node.bloodline && node.ascendancy === target.ascendancy && (node.classStart === null || node.classStart === classId));
  const domainIds = new Set(domain.map(node => node.id));
  const adjacency = new Map<number, number[]>();
  for (const [a, b] of treeEdges(domain)) {
    adjacency.set(a.id, [...(adjacency.get(a.id) ?? []), b.id]);
    adjacency.set(b.id, [...(adjacency.get(b.id) ?? []), a.id]);
  }
  const roots = domain.filter(node => target.ascendancy ? node.ascendancyStart : node.classStart === classId);
  const reachable = new Set(roots.map(node => node.id));
  const queue = [...reachable], byId = new Map(domain.map(node => [node.id, node]));
  for (let i = 0; i < queue.length; i++) {
    if (byId.get(queue[i])?.kind === 'mastery') continue;
    for (const id of adjacency.get(queue[i]) ?? []) {
      if (id === targetId || !allocated.has(id) || reachable.has(id)) continue;
      reachable.add(id); queue.push(id);
    }
  }
  return [...allocated].filter(id => id !== targetId && (!domainIds.has(id) || reachable.has(id)));
}

export function continueFromSnapshot(current: TreeSnapshotData, previous: TreeSnapshotData): TreeSnapshotData {
  return normalizeSnapshot({ ...current, version: previous.version, classId: previous.classId, ascendancyId: previous.ascendancyId,
    nodes: [...previous.nodes], inheritedNodes: [...previous.nodes], mastery: { ...previous.mastery }, respec: undefined, markers: [], frame: null, view: previous.view });
}

export function stepNodeIds(marker: TreeMarker): number[] {
  return [...new Set([marker.nodeId, ...(marker.nodeIds ?? [])])];
}

// Save the label's actual tree coordinates, including legacy screen-space offsets.
export function saveMarkerPositions(markers: TreeMarker[], nodes: PassiveNode[], camera: TreeCamera, size: TreeSize): TreeMarker[] {
  const positions = new Map(markerPositions(markers, nodes, camera, size).map(marker => [marker.nodeId, marker]));
  return markers.map(marker => {
    const position = positions.get(marker.nodeId);
    return position ? { ...marker, positionX: camera.x + (position.x - size.width / 2) / camera.scale,
      positionY: camera.y + (position.y - size.height / 2) / camera.scale, offsetX: undefined, offsetY: undefined } : marker;
  });
}

export function respecBaseline(before: TreeSnapshotData): TreeRespec {
  return { title: before.title, version: before.version, classId: before.classId, ascendancyId: before.ascendancyId, nodes: [...before.nodes], mastery: { ...before.mastery }, note: '' };
}

export function ascendancyStepMarkers(tree: PassiveTree, snapshot: TreeSnapshotData): TreeMarker[] {
  if (snapshot.view !== 'ascendancy' || snapshot.ascendancyNumbering === 'manual') return snapshot.markers;
  const ascendancy = tree.classes.find(c => c.id === snapshot.classId)?.ascendancies[snapshot.ascendancyId - 1]?.id;
  if (!ascendancy) return snapshot.markers;
  const byId = new Map(tree.nodes.map(node => [node.id, node]));
  const existing = new Set(snapshot.markers.flatMap(stepNodeIds));
  const added = snapshot.nodes.flatMap(id => {
    const node = byId.get(id);
    return node?.ascendancy === ascendancy && node.kind === 'notable' && !existing.has(id) ? [{ nodeId: id, note: '' }] : [];
  });
  return [...snapshot.markers, ...added].slice(0, 50);
}
