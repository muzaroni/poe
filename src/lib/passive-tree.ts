export type SpriteRect = [number, number, number, number, number];
export type PassiveNode = {
  id: number; name: string; stats: string[]; reminder: string[];
  x: number; y: number; group: number; orbit: number; angle: number; gx: number; gy: number; orbitRadius: number;
  out: number[]; ascendancy: string | null; bloodline: boolean;
  kind: 'normal' | 'notable' | 'keystone' | 'mastery' | 'jewel';
  classStart: number | null; ascendancyStart: boolean;
  masteryEffects: { effect: number; stats: string[]; reminderText?: string[] }[];
  inactive: SpriteRect | null; active: SpriteRect | null;
};
export type PassiveTree = {
  version: string; source: string;
  sheets: { file: string; width: number; height: number }[];
  classes: { id: number; name: string; ascendancies: { id: string; name: string }[] }[];
  nodes: PassiveNode[];
};
export type TreeStage = { title: string; version: string; classId: number; ascendancyId: number; nodes: number[]; mastery: Record<string, number> };
export type TreeBuild = { title: string; source?: string; stages: TreeStage[] };
export const treeVersions = ['3.29.1', '3.28.0'] as const;
export function compatibleTree(stageVersion: string, treeVersion: string) {
  return stageVersion.replaceAll('_', '.').split('.').slice(0, 2).join('.') === treeVersion.split('.').slice(0, 2).join('.');
}
export function stageChanges(current?: TreeStage, previous?: TreeStage) {
  const allocated = new Set(current?.nodes ?? []);
  const old = new Set(previous?.nodes ?? []);
  return { allocated, added: new Set(previous ? [...allocated].filter(id => !old.has(id)) : []), removed: new Set([...old].filter(id => !allocated.has(id))) };
}
export function nodeRadius(node: PassiveNode) {
  return node.classStart !== null || node.ascendancyStart ? 95 : node.kind === 'keystone' ? 90 : node.kind === 'notable' ? 62 : node.kind === 'mastery' ? 58 : 40;
}
export function cleanStageTitle(title: string) {
  const clean = title.replace(/\^x[\da-f]{6}|\^[\da-f]/gi, '').replace(/\s*\{\d+\}/g, '').trim();
  return /^\d+$/.test(clean) ? `Level ${clean}` : clean;
}
export async function parsePobStages(input: string): Promise<TreeBuild> {
  let xml = input.trim();
  if (xml.length > 2_000_000) throw new Error('Choose a PoB export smaller than 2 MB.');
  if (!xml.startsWith('<')) {
    if (/^https?:/i.test(xml)) throw new Error('Paste the exported PoB code, or import a PoB XML file. URL imports are not available in this preview.');
    try {
      const bytes = Uint8Array.from(atob(xml.replaceAll('-', '+').replaceAll('_', '/').replace(/\s/g, '')), c => c.charCodeAt(0));
      const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
      const decoder = new TextDecoder();
      xml = ''; let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8_000_000) { await reader.cancel(); throw new Error('Export too large'); }
        xml += decoder.decode(value, { stream: true });
      }
      xml += decoder.decode();
    } catch { throw new Error('Could not read this PoB export. Paste the full export code or choose its XML file.'); }
  }
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror') || document.documentElement.tagName !== 'PathOfBuilding') throw new Error('This is not a valid Path of Building export.');
  const stages = [...document.querySelectorAll('Tree > Spec')].map((spec, index) => {
    const nodes = (spec.getAttribute('nodes') ?? '').split(',').filter(Boolean).map(Number);
    if (nodes.some(n => !Number.isInteger(n) || n < 0)) throw new Error('The export contains invalid passive node IDs.');
    const classId = Number(spec.getAttribute('classId') ?? 0), ascendancyId = Number(spec.getAttribute('ascendClassId') ?? 0);
    if (!Number.isInteger(classId) || classId < 0 || classId > 6 || !Number.isInteger(ascendancyId) || ascendancyId < 0 || ascendancyId > 10) throw new Error('This export has an unsupported class or ascendancy.');
    return {
      title: cleanStageTitle(spec.getAttribute('title') ?? `Stage ${index + 1}`),
      version: (spec.getAttribute('treeVersion') ?? '').replaceAll('_', '.'),
      classId, ascendancyId, nodes,
      mastery: Object.fromEntries([...(spec.getAttribute('masteryEffects') ?? '').matchAll(/\{(\d+),(\d+)\}/g)].map(m => [m[1], Number(m[2])])),
    };
  });
  if (!stages.length) throw new Error('This export has no passive-tree stages.');
  const supported = stages.filter(stage => treeVersions.some(version => compatibleTree(stage.version, version)));
  if (!supported.length) throw new Error('This preview supports PoB trees for 3.28 and 3.29.');
  return { title: 'Imported PoB', stages };
}
