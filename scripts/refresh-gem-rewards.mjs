import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'src', 'data', 'gem-rewards');
const source = 'https://www.poewiki.net/wiki/List_of_quest_rewards';
const api = 'https://www.poewiki.net/w/api.php';
const classes = ['Witch', 'Shadow', 'Ranger', 'Duelist', 'Marauder', 'Templar', 'Scion'];

// These quest pages describe story completion separately from the gem reward hand-in.
const rewardNpcOverrides = {
  'The Siren\'s Cadence': 'Nessa',
  'Mercy Mission': 'Nessa',
  'Lost in Love': 'Maramoa',
};

async function wikiPage(page, prop) {
  const url = new URL(api);
  url.search = new URLSearchParams({ action: 'parse', page, prop, format: 'json' }).toString();
  const response = await fetch(url, { headers: { 'User-Agent': 'MuzaroniGuide/1.0 (gem reward cache)' }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Wiki returned ${response.status} for ${page}`);
  const data = await response.json();
  if (!data.parse?.[prop]?.['*']) throw new Error(`Wiki has no ${prop} for ${page}`);
  return data.parse;
}

function decode(value) {
  return value.replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&(?:amp|quot|apos|nbsp);/g, entity => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[entity]);
}

const versionResponse = await fetch('https://repoe-fork.github.io/exported-version.txt', { signal: AbortSignal.timeout(15000) });
if (!versionResponse.ok) throw new Error(`Could not read current game version: ${versionResponse.status}`);
const gameVersion = (await versionResponse.text()).trim();
const versions = [/(\d+\.\d+)/.exec(gameVersion)?.[1]].filter(Boolean);
for (const file of await readdir(path.join(root, 'src', 'content', 'builds'))) {
  if (!file.endsWith('.json')) continue;
  const guide = JSON.parse(await readFile(path.join(root, 'src', 'content', 'builds', file), 'utf8'));
  const version = /(\d+\.\d+)/.exec(guide.league ?? '')?.[1];
  if (version) versions.push(version);
}
const league = versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
if (!league) throw new Error('Could not determine current league');
await mkdir(directory, { recursive: true });
const target = path.join(directory, `${league}.json`);
try {
  const cached = JSON.parse(await readFile(target, 'utf8'));
  if (cached.league === league && Array.isArray(cached.rewards) && cached.rewards.length > 100) {
    console.log(`Quest reward NPCs for ${league} are already cached (${cached.rewards.length} rewards).`);
    process.exit(0);
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const gemCatalogue = JSON.parse(await readFile(path.join(root, 'src', 'data', 'gems.json'), 'utf8'));
const gemNames = new Set(gemCatalogue.map(gem => gem.name));
const page = await wikiPage('List of quest rewards', 'text');
const table = page.text['*'].match(/<table class="wikitable sortable">[\s\S]*?<\/table>/)?.[0];
if (!table) throw new Error('Quest reward table not found');
const rewards = [];
const quests = new Set();
for (const match of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
  const row = match[1];
  const heading = row.match(/<th[^>]*>([\s\S]*?)<\/th>/)?.[1] ?? '';
  const quest = decode(heading.match(/<a[^>]*title="([^"]+)"[^>]*>/)?.[1] ?? '');
  const act = Number(heading.match(/Act\s*(\d+)/)?.[1]);
  if (!quest || !act) continue;
  const cells = [...row.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)];
  let classIndex = 0;
  for (const cell of cells) {
    const span = Number(cell[1].match(/colspan="(\d+)"/)?.[1] ?? 1);
    const offeredTo = classes.slice(classIndex, classIndex + span);
    classIndex += span;
    for (const anchor of cell[2].matchAll(/<a[^>]*title="([^"]+)"[^>]*>/g)) {
      const gem = decode(anchor[1]);
      if (!gemNames.has(gem)) continue;
      quests.add(quest);
      const existing = rewards.find(row => row.gem === gem && row.act === act && row.quest === quest);
      if (existing) existing.classes = [...new Set([...existing.classes, ...offeredTo])];
      else rewards.push({ gem, act, quest, npc: null, classes: offeredTo });
    }
  }
}
if (rewards.length < 100 || !quests.has('Intruders in Black')) throw new Error(`Unexpected quest reward data: ${rewards.length} gems, ${quests.size} quests`);

const npcByQuest = new Map();
for (const quest of quests) {
  const questPage = await wikiPage(quest, 'wikitext');
  const completion = questPage.wikitext['*'].match(/^\s*\|completion\s*=([^\n]*)/im)?.[1] ?? '';
  const npc = rewardNpcOverrides[quest] ?? completion.match(/Talk to \[\[([^\]|]+)(?:\|[^\]]+)?\]\]/i)?.[1] ?? null;
  npcByQuest.set(quest, npc);
}
for (const reward of rewards) reward.npc = npcByQuest.get(reward.quest) ?? null;
rewards.sort((a, b) => a.act - b.act || a.quest.localeCompare(b.quest) || a.gem.localeCompare(b.gem));
const temporary = `${target}.tmp`;
try {
  await writeFile(temporary, JSON.stringify({ league, source, wikiRevision: page.revid, gameVersion, rewards }) + '\n');
  await rename(temporary, target);
} catch (error) {
  await rm(temporary, { force: true });
  throw error;
}
console.log(`Cached ${rewards.length} gem rewards from ${quests.size} quests for ${league}; ${rewards.filter(row => !row.npc).length} without an NPC.`);
