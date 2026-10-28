/** Only campaign world-area IDs count; maps, hideouts and labs leave the act alone. */
export function campaignActFromLog(line: string): number | null {
  const match = /Generating level\s+\d+\s+area\s+"([12])_(\d+)_[^"]+"/i.exec(line);
  if (!match) return null;
  const part = Number(match[1]);
  const act = Number(match[2]);
  return (part === 1 && act >= 1 && act <= 5) || (part === 2 && act >= 6 && act <= 10) ? act : null;
}
