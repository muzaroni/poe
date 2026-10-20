import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'src', 'data', 'gem-vendors');
const versionResponse = await fetch('https://repoe-fork.github.io/exported-version.txt', { signal: AbortSignal.timeout(15000) });
if (!versionResponse.ok) throw new Error(`Could not read the current game version: ${versionResponse.status}`);
const gameVersion = (await versionResponse.text()).trim();
const league = /^(\d+\.\d+)(?:\.|$)/.exec(gameVersion)?.[1];
if (!league) throw new Error(`Unexpected game version: ${gameVersion}`);

await mkdir(directory, { recursive: true });
const target = path.join(directory, `${league}.json`);
try {
  const cached = JSON.parse(await readFile(target, 'utf8'));
  if (cached.league === league && Array.isArray(cached.gems) && cached.gems.length > 0) {
    console.log(`Gem vendor prices for ${league} are already cached (${cached.gems.length} gems).`);
    process.exit(0);
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const endpoint = `https://api.poelevellingplanner.com/get/poe/gems?poe_version=${encodeURIComponent(league)}`;
const response = await fetch(endpoint, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Gem vendor API returned ${response.status} for ${league}`);
const rows = await response.json();
if (!Array.isArray(rows) || rows.length < 100) throw new Error(`Gem vendor API returned too few gems for ${league}`);
if (rows.some(row => row.POE_VERSION !== league)) throw new Error(`Gem vendor API returned data from a different league`);

const gems = rows.map(row => ({
  name: String(row.gemName ?? '').trim(),
  requiredLevel: Number.isInteger(row.level_req) && row.level_req >= 0 ? row.level_req : null,
  cost: Number.isInteger(row.Cost) && row.Cost >= 0 ? row.Cost : null,
  currency: typeof row.Currency === 'string' && row.Currency.trim() ? row.Currency.trim() : null,
})).filter(row => row.name);
if (gems.length < 100 || new Set(gems.map(row => row.name)).size !== gems.length) throw new Error(`Gem vendor API returned invalid or duplicate gem names for ${league}`);
gems.sort((a, b) => a.name.localeCompare(b.name));

const temporary = `${target}.tmp`;
try {
  await writeFile(temporary, JSON.stringify({ league, gameVersion, source: endpoint, gems }) + '\n');
  await rename(temporary, target);
} catch (error) {
  await rm(temporary, { force: true });
  throw error;
}
const incomplete = gems.filter(gem => gem.cost === null || gem.currency === null).length;
console.log(`Cached ${gems.length} gem vendor prices for ${league} (${incomplete} without a complete price).`);
