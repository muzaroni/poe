import { nodeRadius, type PassiveNode, type TreeStage } from './passive-tree';
import { markerPositions, type TreeCamera, type TreeSize, type TreeMarker } from './tree-snapshot';

type DrawOptions = {
  camera: TreeCamera; size: TreeSize; nodes: PassiveNode[]; edges: PassiveNode[][]; sprites: HTMLImageElement[];
  allocated: Set<number>; emphasized?: Set<number>; inherited?: Set<number>; progression?: Set<number> | null; added?: Set<number>; removed?: Set<number>; matchIds?: Set<number>;
  selected?: number | null; hoverId?: number; stage?: TreeStage; previous?: TreeStage; classId: number; markers?: TreeMarker[];
};
export function drawPassiveTree(element: HTMLCanvasElement, options: DrawOptions) {
  const ctx = element.getContext('2d'); if (!ctx) return;
  const { camera, size, nodes, edges, sprites, allocated, added = new Set<number>(), removed = new Set<number>(), matchIds = new Set<number>(), selected, hoverId, stage, previous, classId, markers = [], emphasized = new Set<number>(), inherited = new Set<number>(), progression = null } = options;
  if (size.width <= 0 || size.height <= 0) return;
  element.width = Math.round(size.width * size.dpr); element.height = Math.round(size.height * size.dpr);
  ctx.scale(size.dpr, size.dpr); ctx.fillStyle = '#080b10'; ctx.fillRect(0, 0, size.width, size.height);
const sx = (x: number) => (x - camera.x) * camera.scale + size.width / 2;
const sy = (y: number) => (y - camera.y) * camera.scale + size.height / 2;
const active = (n: PassiveNode) => allocated.has(n.id) || (stage && n.classStart === stage.classId);
for (const [a, b] of edges) {
  const on = active(a) && active(b), old = previous && (removed.has(a.id) || removed.has(b.id)) && previous.nodes.includes(a.id) && previous.nodes.includes(b.id);
  const later = on && progression !== null && (!progression.has(a.id) || !progression.has(b.id));
  const retained = inherited.has(a.id) && inherited.has(b.id);
  ctx.strokeStyle = old && !on ? '#ef7a78' : later && !added.has(a.id) && !added.has(b.id) ? '#413b2d' : on && retained ? '#88764b' : on ? added.has(a.id) || added.has(b.id) ? '#70e79b' : '#d8bd75' : old ? '#ef7a78' : '#1b222b';
  ctx.lineWidth = on || old ? 2 : 1; ctx.setLineDash(old ? [4, 3] : []);
  ctx.beginPath();
  if (a.group === b.group && a.orbit === b.orbit && a.orbitRadius > 0) {
    let difference = b.angle - a.angle;
    while (difference > Math.PI) difference -= Math.PI * 2;
    while (difference < -Math.PI) difference += Math.PI * 2;
    ctx.arc(sx(a.gx), sy(a.gy), a.orbitRadius * camera.scale, a.angle - Math.PI / 2, a.angle + difference - Math.PI / 2, difference < 0);
  } else { ctx.moveTo(sx(a.x), sy(a.y)); ctx.lineTo(sx(b.x), sy(b.y)); }
  ctx.stroke();
}
ctx.setLineDash([]);
const drawOrder = [...nodes.filter(n => !active(n)), ...nodes.filter(active)];
for (const node of drawOrder) {
  const x = sx(node.x), y = sy(node.y), radius = Math.max(1.3, nodeRadius(node) * camera.scale);
  if (x + radius < 0 || y + radius < 0 || x - radius > size.width || y - radius > size.height) continue;
  const on = active(node), isAdded = added.has(node.id), isRemoved = removed.has(node.id), found = matchIds.has(node.id), focused = selected === node.id || hoverId === node.id || emphasized.has(node.id);
  const later = on && progression !== null && !progression.has(node.id);
  ctx.save();
  if (later && !focused && !isAdded && !isRemoved) ctx.globalAlpha = .24;
  else if (on && inherited.has(node.id) && !focused) ctx.globalAlpha = .62;
  const color = isRemoved ? '#ef7a78' : focused ? '#fff3bd' : found ? '#79b8ff' : isAdded ? '#70e79b' : isRemoved ? '#ef7a78' : on ? '#e7ca83' : node.kind === 'keystone' ? '#514837' : '#2e3741';
  if (on || found || isRemoved || focused) {
    ctx.fillStyle = found ? '#79b8ff24' : isRemoved ? '#ef7a7828' : '#e7ca8320';
    ctx.beginPath(); ctx.arc(x, y, radius + 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#10151c'; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  const icon = on ? node.active ?? node.inactive : node.inactive;
  if (icon && radius > 2.5 && sprites[icon[0]]?.naturalWidth) {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, Math.max(1, radius - .5), 0, Math.PI * 2); ctx.clip();
    ctx.globalAlpha *= on || focused || found || isRemoved ? 1 : .28;
    ctx.drawImage(sprites[icon[0]], icon[1], icon[2], icon[3], icon[4], x - radius, y - radius, radius * 2, radius * 2); ctx.restore();
  }
  ctx.strokeStyle = color; ctx.lineWidth = focused || found || on ? 1.8 : .8;
  ctx.setLineDash(isRemoved ? [3, 3] : []);
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  if (node.classStart !== null && camera.scale > .035) {
    ctx.font = '600 11px "Reddit Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = node.classStart === classId ? '#e7ca83' : '#84909d';
    ctx.fillText(node.name, x, y + radius + 13);
  }
  ctx.restore();
  if (emphasized.has(node.id)) {
    ctx.strokeStyle = '#fff3bd'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(x, y, radius + 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
}
  for (const marker of markerPositions(markers, nodes, camera, size)) {
    if (marker.x < -15 || marker.y < -15 || marker.x > size.width + 15 || marker.y > size.height + 15) continue;
    ctx.save();
    ctx.fillStyle = '#142863'; ctx.strokeStyle = '#8398ff'; ctx.lineWidth = 1;
    ctx.shadowColor = '#000b'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.beginPath(); ctx.roundRect(marker.x - 12, marker.y - 12, 24, 24, 4); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '700 17px "Reddit Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(marker.number), marker.x, marker.y + .5); ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }
}
