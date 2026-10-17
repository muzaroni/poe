import type { Guide } from '../types';

type BuildMetadata = Pick<Guide, 'league' | 'ascendancy' | 'kind'>;

export function buildDetails(guide: BuildMetadata) {
  const [league, ...legacyAscendancy] = guide.league.split('·');
  return { league: league.trim(), ascendancy: guide.ascendancy ?? legacyAscendancy.join('·').trim() };
}

export function buildLabel(guide: BuildMetadata) {
  if (guide.kind === 'article') return 'Article';
  const { league, ascendancy } = buildDetails(guide);
  return [league, ascendancy].filter(Boolean).join(' · ') || 'Build guide';
}

const ascendancyColors: Record<string, string> = Object.fromEntries([
  ['red', ['Juggernaut', 'Berserker', 'Chieftain']],
  ['green', ['Deadeye', 'Warden', 'Pathfinder']],
  ['blue', ['Necromancer', 'Elementalist', 'Occultist']],
  ['red-green', ['Slayer', 'Gladiator', 'Champion']],
  ['blue-red', ['Inquisitor', 'Hierophant', 'Guardian']],
  ['blue-green', ['Assassin', 'Saboteur', 'Trickster']],
  ['white', ['Ascendant', 'Reliquarian', 'Luminary']],
].flatMap(([color, names]) => (names as string[]).map((name) => [name.toLowerCase(), color as string])));

export function ascendancyBadgeClass(guide: BuildMetadata): string {
  if (guide.kind === 'article') return '';
  const color = ascendancyColors[buildDetails(guide).ascendancy.trim().toLowerCase()];
  return color ? `ascendancy-${color}` : '';
}

const portraitNames = new Set(['ascendant', 'assassin', 'berserker', 'champion', 'chieftain', 'deadeye', 'elementalist', 'gladiator', 'guardian', 'hierophant', 'inquisitor', 'juggernaut', 'necromancer', 'occultist', 'pathfinder', 'saboteur', 'slayer', 'trickster', 'warden']);

export function ascendancyPortrait(guide: BuildMetadata) {
  if (guide.kind === 'article') return null;
  const name = buildDetails(guide).ascendancy.trim().toLowerCase();
  return portraitNames.has(name) ? `images/ascendancies/${name}.png` : null;
}
