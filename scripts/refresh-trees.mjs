import { mkdir, writeFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import path from 'node:path';

const root = new URL('../public/data/trees/', import.meta.url);
const versions = ['3.28.0', '3.29.1'];
const zoom = '0.3835';
const angles16 = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response;
}
for (const version of versions) {
  const source = `https://raw.githubusercontent.com/grindinggear/skilltree-export/${version}/`;
  const data = await (await get(`${source}data.json`)).json();
  const folder = new URL(`${version}/`, root);
  await mkdir(folder, { recursive: true });
  const sheets = [];
  const sheetLookup = new Map();
  const families = {};
  for (const family of ['normalInactive', 'normalActive', 'notableInactive', 'notableActive', 'keystoneInactive', 'keystoneActive', 'masteryInactive', 'masteryActiveSelected']) {
    const sprite = data.sprites[family]?.[zoom];
    if (!sprite) continue;
    const filename = path.basename(new URL(sprite.filename).pathname);
    if (!sheetLookup.has(filename)) {
      const image = await get(`${source}assets/${filename}`);
      await writeFile(new URL(filename, folder), Buffer.from(await image.arrayBuffer()));
      sheetLookup.set(filename, sheets.length);
      sheets.push({ file: filename, width: sprite.w, height: sprite.h });
    }
    families[family] = { sheet: sheetLookup.get(filename), coords: sprite.coords };
  }
  function icon(node, active) {
    const family = node.isMastery ? active ? 'masteryActiveSelected' : 'masteryInactive' : `${node.isKeystone ? 'keystone' : node.isNotable ? 'notable' : 'normal'}${active ? 'Active' : 'Inactive'}`;
    const sprite = families[family];
    const key = node.isMastery ? active ? node.activeIcon : node.inactiveIcon : node.icon;
    const rect = sprite?.coords[key];
    return rect ? [sprite.sheet, rect.x, rect.y, rect.w, rect.h] : null;
  }
  const nodes = Object.entries(data.nodes).flatMap(([id, node]) => {
    const group = data.groups[node.group];
    if (!group || node.isProxy || !Number.isFinite(node.orbitIndex)) return [];
    const count = data.constants.skillsPerOrbit[node.orbit];
    const angle = (count === 16 ? angles16[node.orbitIndex] : node.orbitIndex * 360 / count) * Math.PI / 180;
    const radius = data.constants.orbitRadii[node.orbit];
    const name = node.classStartIndex != null ? data.classes[node.classStartIndex]?.name.toUpperCase() ?? node.name : node.name;
    return [{ id: Number(id), name: name ?? '', stats: node.stats ?? [], reminder: node.reminderText ?? [],
      x: group.x + Math.sin(angle) * radius, y: group.y - Math.cos(angle) * radius,
      group: node.group, orbit: node.orbit, angle, gx: group.x, gy: group.y, orbitRadius: radius,
      out: (node.out ?? []).map(Number), ascendancy: node.ascendancyName ?? null, bloodline: !!node.isBloodline,
      kind: node.isMastery ? 'mastery' : node.isKeystone ? 'keystone' : node.isJewelSocket ? 'jewel' : node.isNotable ? 'notable' : 'normal',
      classStart: node.classStartIndex ?? null, ascendancyStart: !!node.isAscendancyStart,
      masteryEffects: node.masteryEffects ?? [], inactive: icon(node, false), active: icon(node, true) }];
  });
  const result = { version, source: `https://github.com/grindinggear/skilltree-export/tree/${version}`, sheets, classes: data.classes.map((c, id) => ({ id, name: c.name, ascendancies: c.ascendancies.map(a => ({ id: a.id, name: a.name })) })), nodes };
  await writeFile(new URL('tree.json', folder), JSON.stringify(result));
  console.log(`${version}: ${nodes.length} nodes, ${sheets.length} local spritesheets`);
}

// Keep the guide's existing PoB stages tied to their declared tree version.
const code = (await (await get('https://pobb.in/Mte0VuKLso3C/raw')).text()).trim();
const xml = inflateSync(Buffer.from(code, 'base64url')).toString('utf8');
const decode = value => value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const stages = [...xml.matchAll(/<Spec\b([^>]*)>/g)].map(([_, attributes], index) => {
  const a = Object.fromEntries([...attributes.matchAll(/([\w]+)="([^"]*)"/g)].map(m => [m[1], decode(m[2])]));
  const title = (a.title ?? `Stage ${index + 1}`).replace(/\^x[\da-f]{6}|\^[\da-f]/gi, '').replace(/\s*\{\d+\}/g, '').trim();
  return { title: /^\d+$/.test(title) ? `Level ${title}` : title, version: a.treeVersion.replace('_', '.'), classId: Number(a.classId), ascendancyId: Number(a.ascendClassId), nodes: a.nodes.split(',').filter(Boolean).map(Number), mastery: Object.fromEntries([...a.masteryEffects.matchAll(/\{(\d+),(\d+)\}/g)].map(m => [m[1], Number(m[2])])) };
});
await writeFile(new URL('sunder-rf-stages.json', root), JSON.stringify({ title: 'Sunder into RF', source: 'https://pobb.in/Mte0VuKLso3C', stages }));
await writeFile(new URL('SOURCES.txt', root), 'Passive tree data and artwork: Grinding Gear Games, https://github.com/grindinggear/skilltree-export\nSnapshots pinned to 3.28.0 and 3.29.1 tags.\nExample stages: https://pobb.in/Mte0VuKLso3C\n');
console.log(`Imported ${stages.length} real PoB stages.`);
