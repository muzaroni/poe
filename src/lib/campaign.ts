import type { TreeMarker, TreeSnapshotData } from './tree-snapshot';
import type { PassiveTree } from './passive-tree';
import { normalizeSnapshot } from './tree-snapshot';
import type { JSONContent } from '@tiptap/core';
import { plainText } from './guide';
import { carryGemAcquisitions, gemProgressionStages, setupRows } from './gem-links';

export function campaignMarkers(markers: TreeMarker[], act: number) {
  let currentAct = 1;
  return markers.flatMap((marker, index) => {
    const divider = /^Act (10|[1-9])$/i.exec(marker.actDivider ?? '');
    if (/^Maps$/i.test(marker.actDivider ?? '')) currentAct = 11;
    if (divider) currentAct = Number(divider[1]);
    return currentAct === act ? [{ ...marker, displayNumber: index + 1 }] : [];
  });
}

export type CampaignAscendancySnapshot = { snapshot: TreeSnapshotData; act: number };
export function guideAscendancySnapshots(document: JSONContent): CampaignAscendancySnapshot[] {
  const snapshots: CampaignAscendancySnapshot[] = [];
  let act = 4;
  for (const node of document.content ?? []) {
    if (node.type === 'heading' && Number(node.attrs?.level) === 2) {
      const heading = /^Act\s+(10|[1-9])(?:\s*[-–]\s*(10|[1-9]))?\b/i.exec(plainText(node).trim());
      if (heading) act = Number(heading[2] ?? heading[1]);
      else if (/^Maps\b/i.test(plainText(node).trim())) act = 11;
    } else if (node.type === 'passiveTree' && node.attrs?.snapshot?.view === 'ascendancy') {
      snapshots.push({ snapshot: normalizeSnapshot(node.attrs.snapshot), act });
    }
  }
  return snapshots;
}

export function campaignAscendancySteps(tree: PassiveTree, snapshot: TreeSnapshotData, guideSnapshots: CampaignAscendancySnapshot[] = []) {
  const ascendancy = tree.classes.find(value => value.id === snapshot.classId)?.ascendancies[snapshot.ascendancyId - 1]?.id;
  if (!ascendancy) return [];
  const nodes = tree.nodes.filter(node => node.ascendancy === ascendancy);
  const byId = new Map(nodes.map(node => [node.id, node]));
  const matchingGuides = guideSnapshots.filter(source => source.snapshot.classId === snapshot.classId && source.snapshot.ascendancyId === snapshot.ascendancyId);
  if (matchingGuides.length) {
    const steps: { node: typeof nodes[number]; act: number; lab: string; action: 'allocate' | 'refund' }[] = [];
    // The campaign snapshot is a final overview and may already contain Normal Lab nodes.
    // Only successive written Ascendancy trees define the campaign progression.
    let previous = new Set<number>();
    for (const source of matchingGuides) {
      const current = new Set(source.snapshot.nodes.filter(id => byId.get(id)?.kind === 'notable'));
      const lab = source.snapshot.title || `Act ${source.act} ascendancy`;
      for (const id of previous) if (!current.has(id)) {
        const node = byId.get(id);
        if (node) steps.push({ node, act: source.act, lab, action: 'refund' });
      }
      for (const id of current) if (!previous.has(id)) {
        const node = byId.get(id);
        if (node) steps.push({ node, act: source.act, lab, action: 'allocate' });
      }
      previous = current;
    }
    return steps;
  }
  const notables = snapshot.nodes.map(id => byId.get(id)).filter((node): node is NonNullable<typeof node> => !!node && node.kind === 'notable');
  return notables.map((node, index) => ({ node, act: index < 2 ? 4 : index < 4 ? 9 : 10, lab: index < 2 ? 'Normal Lab' : index < 4 ? 'Cruel Lab' : 'Merciless Lab', action: 'allocate' as const }));
}

export type CampaignGemStage = { title: string; rows: JSONContent[]; acquisitionNodes: JSONContent[]; sourceAct?: number; carried?: boolean };

// Keep every setup in guide order, while carrying unchanged links into each stage.
export function guideGemProgressionByAct(document: JSONContent): Record<string, CampaignGemStage[]> {
  const result: Record<string, CampaignGemStage[]> = {};
  let sectionActs: number[] = [];
  let sectionSetups: { node: JSONContent; title: string }[] = [];
  let sectionHeading = '';
  let carried: JSONContent[] = [];
  let sourceAct = 0;
  function finishSection() {
    const stages: CampaignGemStage[] = [];
    if (sectionSetups.length) {
      const latest = new Map(setupRows(carried).map(row => [row.key, row.paragraph]));
      let baselineBlocks: JSONContent[] = [];
      function remember(blocks: JSONContent[]) {
        const rows = setupRows(blocks);
        if (!rows.length) return;
        const ordered = new Map(rows.map(row => [row.key, row.paragraph]));
        for (const [key, paragraph] of latest) if (!ordered.has(key)) ordered.set(key, paragraph);
        latest.clear();
        for (const [key, paragraph] of ordered) latest.set(key, paragraph);
      }
      for (const { node: setup, title } of sectionSetups) {
        baselineBlocks = [];
        for (const node of setup.attrs?.previousSetup?.content ?? []) {
          if (node.type === 'heading') { remember(baselineBlocks); baselineBlocks = []; }
          else baselineBlocks.push(node);
        }
        remember(baselineBlocks);
        for (const stage of gemProgressionStages(setup.content ?? [], setup.attrs?.previousSetup)) {
          remember(stage.content);
          if (setupRows(stage.content).length) stages.push({ title: stage.title === 'Starting links' ? title || 'Gem links' : stage.title, rows: [...latest.values()], acquisitionNodes: stage.content });
        }
      }
      carried = [...latest.values()];
      sourceAct = sectionActs[0] ?? sourceAct;
    }
    for (const act of sectionActs) if (carried.length) result[act] = stages.length && act === sectionActs[0] ? stages.map(stage => ({ ...stage, sourceAct })) : [{ title: 'Current gem links', rows: carried, acquisitionNodes: [], sourceAct, carried: true }];
    sectionSetups = [];
    sectionHeading = '';
  }
  for (const node of carryGemAcquisitions(document).content ?? []) {
    if (node.type === 'heading' && Number(node.attrs?.level) === 2) {
      finishSection();
      const heading = /^Act\s+(10|[1-9])(?:\s*[-–]\s*(10|[1-9]))?\b/i.exec(plainText(node).trim());
      if (/^Maps\b/i.test(plainText(node).trim())) { sectionActs = [11]; continue; }
      if (!heading) { sectionActs = []; continue; }
      const first = Number(heading[1]), last = Number(heading[2] ?? heading[1]);
      sectionActs = first <= last ? Array.from({ length: last - first + 1 }, (_, index) => first + index) : [];
    } else if (node.type === 'gemPathMerge') { finishSection(); carried = []; }
    else if (node.type === 'heading' && Number(node.attrs?.level) === 3 && sectionActs.length) sectionHeading = plainText(node).trim();
    else if (node.type === 'gemSetup' && sectionActs.length) sectionSetups.push({ node, title: sectionHeading });
  }
  finishSection();
  let previous: CampaignGemStage | undefined;
  for (let act = 1; act <= 11; act++) {
    if (result[act]?.length) previous = result[act].at(-1);
    else if (previous) result[act] = [{ title: 'Current gem links', rows: previous.rows, acquisitionNodes: [], sourceAct: previous.sourceAct, carried: true }];
  }
  return result;
}

// The final stage remains useful to callers that need the end-of-act links.
export function guideGemLinksByAct(document: JSONContent): Record<string, JSONContent[]> {
  return Object.fromEntries(Object.entries(guideGemProgressionByAct(document)).map(([act, stages]) => [act, stages.at(-1)?.rows ?? []]));
}

export type GuideRegex = { label: string; value: string };
export function guideRegexes(document: JSONContent): GuideRegex[] {
  return (document.content ?? []).filter(node => node.type === 'regex' && typeof node.attrs?.value === 'string' && node.attrs.value).map(node => ({ label: String(node.attrs?.label ?? 'Regex'), value: String(node.attrs!.value) }));
}
