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
