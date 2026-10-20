type Reward = { gem: string; act: number; quest: string; npc: string | null; classes: string[] };
type RewardCache = { league: string; rewards: Reward[] };

const caches = import.meta.glob('../data/gem-rewards/*.json', { eager: true, import: 'default' }) as Record<string, RewardCache>;
const byLeague = new Map(Object.values(caches).map(cache => [cache.league, cache.rewards]));
const latestLeague = [...byLeague.keys()].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
const baseClasses: Record<string, string> = Object.fromEntries(([
  ['Witch', ['Necromancer', 'Elementalist', 'Occultist']],
  ['Shadow', ['Assassin', 'Saboteur', 'Trickster']],
  ['Ranger', ['Deadeye', 'Warden', 'Pathfinder']],
  ['Duelist', ['Slayer', 'Gladiator', 'Champion']],
  ['Marauder', ['Juggernaut', 'Berserker', 'Chieftain']],
  ['Templar', ['Inquisitor', 'Hierophant', 'Guardian']],
  ['Scion', ['Ascendant']],
] as [string, string[]][]).flatMap(([characterClass, ascendancies]) => [characterClass, ...ascendancies].map(name => [name.toLowerCase(), characterClass])));

export function gemRewardNpc(name: string, act: number | null, ascendancy = '', league = ''): string | null {
  if (!act) return null;
  const version = /\d+\.\d+/.exec(league)?.[0] ?? latestLeague;
  const characterClass = baseClasses[ascendancy.trim().toLowerCase()];
  const matches = (byLeague.get(version) ?? byLeague.get(latestLeague) ?? []).filter(row =>
    row.gem.toLowerCase() === name.trim().toLowerCase() && row.act === act && (!characterClass || row.classes.includes(characterClass)));
  const npcs = [...new Set(matches.map(row => row.npc).filter((npc): npc is string => !!npc))];
  return npcs.length === 1 ? npcs[0] : null;
}
