import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = 'https://repoe-fork.github.io/';
async function get(file, json = true) {
  const response = await fetch(source + file);
  if (!response.ok) throw new Error(`${file}: ${response.status}`);
  return json ? response.json() : (await response.text()).trim();
}
const [raw, items, version] = await Promise.all([get('gems.json'), get('base_items.json'), get('exported-version.txt', false)]);
const directory = path.join(root, 'public', 'data', 'gems');
const iconDirectory = path.join(root, 'public', 'images', 'gems');
await mkdir(directory, { recursive: true });
await mkdir(iconDirectory, { recursive: true });
const catalogue = [];
const icons = new Map();
const seen = new Set();
for (const gem of Object.values(raw)) {
  const name = gem.display_name;
  const color = { r: 'red', g: 'green', b: 'blue' }[gem.color];
  if (!name || !color || gem.base_item?.release_state !== 'released' || seen.has(name) || name.startsWith('[') || name.startsWith('...')) continue;
  seen.add(name);
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const dds = items[gem.base_item.id]?.visual_identity?.dds_file;
  const iconName = dds ? path.basename(dds, '.dds') + '.png' : null;
  const icon = iconName ? `/images/gems/${iconName}` : null;
  if (dds) icons.set(iconName, 'https://web.poecdn.com/image/' + dds.replace(/\.dds$/, '.png'));
  const tags = (gem.tags ?? []).filter(tag => !['intelligence', 'strength', 'dexterity', 'grants_active_skill', 'support'].includes(tag)).map(tag => tag === 'area' ? 'AoE' : tag.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()));
  const description = gem.active_skill?.description || gem.support_gem?.support_text || '';
  const levels = {};
  for (const [number, level] of Object.entries(gem.per_level ?? {})) {
    if (+number > (gem.base_item.max_level ?? 20)) continue;
    const stats = { ...gem.static?.stat_text, ...level.stat_text };
    const fields = [];
    const merged = { ...gem.static };
    for (const [key, value] of Object.entries(level)) if (value != null) merged[key] = value;
    for (const [key, label] of [['Mana', 'Mana cost'], ['Life', 'Life cost'], ['ManaPerMinute', 'Mana / second'], ['ES', 'Energy shield cost']]) {
      const value = level.costs?.[key] ?? gem.static?.costs?.[key];
      if (value != null && value !== 0) fields.push([label, String(key === 'ManaPerMinute' ? value / 60 : value)]);
    }
    if (merged.cooldown != null && merged.cooldown > 0) fields.push(['Cooldown', `${(merged.cooldown / 1000).toFixed(2)} seconds`]);
    if (gem.cast_time != null && !gem.is_support && !gem.active_skill?.types?.includes('Attack')) fields.push(['Cast time', gem.cast_time === 0 ? 'Instant' : `${(gem.cast_time / 1000).toFixed(2)} seconds`]);
    if (merged.damage_effectiveness != null) fields.push(['Added damage effectiveness', `${100 + merged.damage_effectiveness}%`]);
    if (gem.active_skill?.types?.includes('Attack') && merged.damage_multiplier != null) fields.push(['Attack damage', `${Number((100 + merged.damage_multiplier / 100).toFixed(2))}% of base`]);
    if (gem.static?.attack_speed_multiplier != null) fields.push(['Attack speed', `${100 + gem.static.attack_speed_multiplier}% of base`]);
    if (merged.stored_uses > 1) fields.push(['Stored uses', String(merged.stored_uses)]);
    if (gem.static?.crit_chance) fields.push(['Critical strike chance', `${gem.static.crit_chance / 100}%`]);
    if (merged.cost_multiplier != null) fields.push(['Cost & reservation multiplier', `${merged.cost_multiplier}%`]);
    for (const [resource, value] of Object.entries(level.reservations ?? gem.static?.reservations ?? {})) {
      if (value != null && value !== 0) fields.push([`${resource.replace(/_percent$/, '').replace(/_/g, ' ')} reservation`, `${value}${resource.includes('percent') ? '%' : ''}`]);
    }
    const requirements = { ...gem.static?.stat_requirements };
    for (const [key, value] of Object.entries(level.stat_requirements ?? {})) if (value != null) requirements[key] = value;
    levels[number] = { requiredLevel: level.required_level ?? gem.static?.required_level, requirements, fields, stats: Object.values(stats).filter(value => typeof value === 'string' && value).flatMap(value => value.split('\n')) };
  }
  const quality = (gem.static?.quality_stats ?? []).map(item => {
    let text = item.stat ?? '';
    for (const [key, value] of Object.entries(item.stats ?? {})) text = text.replaceAll(`{${key}}`, String(Number((value / 1000 * 20).toFixed(3))));
    return text;
  }).filter(text => text && !text.includes('{'));
  const info = { id, name, color, icon, tags, description, support: !!gem.is_support, maxLevel: gem.base_item.max_level ?? 20, version };
  catalogue.push(info);
  await writeFile(path.join(directory, `${id}.json`), JSON.stringify({ ...info, levels, quality }));
}
const pending = [...icons];
let cursor = 0;
let failed = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (cursor < pending.length) {
    const [filename, url] = pending[cursor++];
    const target = path.join(iconDirectory, filename);
    try { await readFile(target); continue; } catch { /* fetch missing icon */ }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Icon unavailable');
      await writeFile(target, Buffer.from(await response.arrayBuffer()));
    } catch { failed++; for (const info of catalogue) if (info.icon === `/images/gems/${filename}`) info.icon = null; }
  }
}));
// Keep failed icons out of both the lightweight index and full cards.
for (const info of catalogue.filter(info => !info.icon)) {
  const target = path.join(directory, `${info.id}.json`);
  const detail = JSON.parse(await readFile(target, 'utf8'));
  detail.icon = null;
  await writeFile(target, JSON.stringify(detail));
}
catalogue.sort((a, b) => a.name.localeCompare(b.name));
await writeFile(path.join(directory, 'index.json'), JSON.stringify(catalogue));
console.log(`Saved ${catalogue.length} gems, ${icons.size - failed} icons. Data version ${version}. ${failed} unavailable icons use a fallback.`);
