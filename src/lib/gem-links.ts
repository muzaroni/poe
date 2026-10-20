import type { JSONContent } from '@tiptap/core';
import { gemRewardNpc } from './gem-rewards';

type Acquisition = { kind: 'reward' | 'buy' | 'none'; act: number | null; vendor: string | null };

export function acquisitionVendorForAct(act: number | null, kind: 'reward' | 'buy'): string | null {
  if (kind === 'reward') return null;
  if (act === 2) return 'Yeena';
  if (kind === 'buy') return ({ 1: 'Nessa', 3: 'Clarissa', 4: 'Petarus and Vanja' } as Record<number, string>)[act ?? 0] ?? null;
  return null;
}

export function gemAcquisitionGroups(nodes: JSONContent[], act?: number, ascendancy = '', league = '') {
  const reward: { name: string; vendor: string | null; color: string; quantity: number }[] = [], buy: { name: string; vendor: string | null; color: string; quantity: number }[] = [];
  const groups = new Map<string, { name: string; vendor: string | null; color: string; quantity: number; kind: 'reward' | 'buy'; first: boolean }>();
  function visit(node: JSONContent) {
    if (node.type === 'gem' && (node.attrs?.acquisition === 'reward' || node.attrs?.acquisition === 'buy')
      && (act === undefined || node.attrs?.acquisitionAct === act)) {
      const name = String(node.attrs?.name ?? '');
      const key = `${name.toLowerCase()}:${node.attrs.acquisition}`;
      const kind = node.attrs.acquisition as 'reward' | 'buy';
      const existing = groups.get(key);
      if (existing) { existing.quantity += kind === 'buy' ? 1 : 0; existing.first ||= node.attrs?.acquisitionFirst === true; }
      else {
        const acquisitionAct = Number(node.attrs?.acquisitionAct) || null;
        const vendor = String(node.attrs?.acquisitionVendor ?? '').trim() || (kind === 'reward'
          ? gemRewardNpc(name, acquisitionAct, ascendancy, league)
          : acquisitionVendorForAct(acquisitionAct, kind));
        groups.set(key, { name, vendor, color: String(node.attrs?.color ?? 'red'), quantity: 1, kind, first: node.attrs?.acquisitionFirst === true });
      }
    }
    node.content?.forEach(visit);
  }
  nodes.forEach(visit);
  for (const { kind, first, ...gem } of groups.values()) if (first) (kind === 'reward' ? reward : buy).push(gem);
  return { reward, buy };
}

// A gem keeps its acquisition choice in later setups unless the author changes it.
export function carryGemAcquisitions(document: JSONContent): JSONContent {
  const choices = new Map<string, Acquisition[]>();
  const obtained = new Map<string, number | null>();
  const earlierActGems = new Set<string>();
  let actGems = new Set<string>();
  let currentAct: number | null = null;
  function copyNode(node: JSONContent, occurrences: Map<string, number>): JSONContent {
    if (node.type === 'gem') {
      const name = String(node.attrs?.name ?? '').toLowerCase();
      actGems.add(name);
      const index = occurrences.get(name) ?? 0;
      occurrences.set(name, index + 1);
      const explicit = node.attrs?.acquisition;
      const inherited = choices.get(name)?.[index];
      const choice: Acquisition | undefined = explicit === 'reward' || explicit === 'buy' || explicit === 'none'
        ? { kind: explicit, act: Number(node.attrs?.acquisitionAct) || currentAct, vendor: String(node.attrs?.acquisitionVendor ?? '').trim() || (inherited?.kind === explicit ? inherited?.vendor ?? null : null) } : inherited;
      const isAcquisition = choice?.kind === 'reward' || choice?.kind === 'buy';
      const first = isAcquisition && !obtained.has(name) && !earlierActGems.has(name);
      if (first) obtained.set(name, choice.act);
      if (isAcquisition && obtained.has(name)) choice.act = obtained.get(name) ?? null;
      else if (isAcquisition && earlierActGems.has(name)) choice.act = null;
      if (choice) {
        const list = [...(choices.get(name) ?? [])];
        list[index] = choice;
        choices.set(name, list);
      }
      return { ...node, attrs: { ...node.attrs, acquisition: choice?.kind ?? null, acquisitionAct: choice?.act ?? null, acquisitionVendor: choice?.vendor ?? null, acquisitionFirst: first } };
    }
    return { ...node, content: node.content?.map(child => copyNode(child, occurrences)) };
  }
  return { ...document, content: document.content?.map(node => {
    if (node.type === 'heading' && Number(node.attrs?.level) === 2) {
      for (const name of actGems) earlierActGems.add(name);
      actGems = new Set<string>();
      currentAct = Number(/^Act\s+(10|[1-9])\b/i.exec(node.content?.map(child => child.text ?? '').join('') ?? '')?.[1]) || null;
    }
    if (node.type !== 'gemSetup') return node;
    let occurrences = new Map<string, number>();
    return { ...node, content: node.content?.map(child => {
      if (child.type === 'heading') occurrences = new Map<string, number>();
      return copyNode(child, occurrences);
    }) };
  }) };
}

// Keep the original document intact: punctuation describes the link relationships.
export function gemLinkGroups(node: JSONContent) {
  if (node.type !== 'paragraph' || !node.content?.some((child) => child.type === 'gem')) return null;
  let title = 'Gems';
  const groups: JSONContent[][][] = [[[]]];
  for (const [index, original] of node.content.entries()) {
    let child = original;
    if (index === 0 && child.type === 'text') {
      const label = child.text?.match(/^\s*([^:]{1,40}):\s*/);
      if (label) { title = label[1].trim(); child = { ...child, text: child.text!.slice(label[0].length) }; }
    }
    if (child.type === 'text') {
      // Tiptap combines adjacent text, e.g. " (1) + ", into one node.
      // Read separators within it while retaining annotations and their marks.
      for (const part of (child.text ?? '').split(/([+,])/)) {
        if (part === ',') groups.push([[]]);
        else if (part === '+') groups.at(-1)!.push([]);
        else if (part.trim()) groups.at(-1)!.at(-1)!.push({ ...child, text: part });
      }
    } else groups.at(-1)!.at(-1)!.push(child);
  }
  return { title, groups: groups.map((group) => group.filter((row) => row.length)).filter((group) => group.length) };
}


// "or" between gem nodes offers alternatives for the same socket.
export function gemSocketOptions(row: JSONContent[]): JSONContent[][] {
  const options: JSONContent[][] = [[]];
  for (const [index, item] of row.entries()) {
    const separator = item.type === 'text' && options.at(-1)!.some(node => node.type === 'gem')
      && row.slice(index + 1).some(node => node.type === 'gem') ? item.text?.match(/\s*\bor\b\s*/i) : null;
    if (separator) {
      const before = item.text!.slice(0, separator.index);
      const after = item.text!.slice(separator.index! + separator[0].length);
      if (before.trim()) options.at(-1)!.push({ ...item, text: before });
      options.push([]);
      if (after.trim()) options.at(-1)!.push({ ...item, text: after });
    } else options.at(-1)!.push(item);
  }
  return options;
}

export type SetupGem = { name: string; color: string; annotation: string; ref?: string; socket?: number; alternative?: boolean };
export type SetupRow = { paragraph: JSONContent; key: string; title: string; gems: SetupGem[]; connections: string };
export type GemSetupBaseline = { title: string; content: JSONContent[] };
export type SetupChange = { title: string; added: SetupGem[]; removed: SetupGem[]; linksChanged: boolean };
export function setupRows(content: JSONContent[]): SetupRow[] {
  const rows: SetupRow[] = [], occurrences = new Map<string, number>();
  function visit(node: JSONContent) {
    const setup = gemLinkGroups(node);
    if (!setup) { node.content?.forEach(visit); return; }
    const label = setup.title.toLowerCase().trim(), occurrence = occurrences.get(label) ?? 0;
    occurrences.set(label, occurrence + 1);
    let socket = 0;
    const groups = setup.groups.map(group => group.map(row => {
      const options = gemSocketOptions(row), socketIndex = socket++;
      return options.flatMap(option => {
        const annotation = option.filter(item => item.type === 'text').map(item => item.text ?? '').join('').trim();
        return option.filter(item => item.type === 'gem').map(item => ({ name: String(item.attrs?.name ?? ''), color: String(item.attrs?.color ?? 'red'), annotation, socket: socketIndex, alternative: options.length > 1 }));
      });
    }));
    rows.push({ paragraph: node, key: `${label}:${occurrence}`, title: setup.title, gems: groups.flat(2), connections: groups.map(group => group.map(options => options.map(gem => gem.name.toLowerCase()).sort().join('|')).sort().join('+')).sort().join(',') });
  }
  content.forEach(visit); return rows;
}
export function compareGemSetups(current: JSONContent[], previous: JSONContent[]): SetupChange[] {
  const before = setupRows(previous), after = setupRows(current), changes: SetupChange[] = [];
  const identity = (gem: SetupGem) => `${gem.name.toLowerCase()}|${gem.annotation}`;
  function subtract(items: SetupGem[], other: SetupGem[]) {
    const remaining = other.map(identity);
    return items.filter(gem => { const i = remaining.indexOf(identity(gem)); if (i < 0) return true; remaining.splice(i, 1); return false; });
  }
  for (const key of new Set([...after.map(row => row.key), ...before.map(row => row.key)])) {
    const old = before.find(row => row.key === key), next = after.find(row => row.key === key);
    const added = subtract(next?.gems ?? [], old?.gems ?? []), removed = subtract(old?.gems ?? [], next?.gems ?? []);
    const linksChanged = !added.length && !removed.length && old?.connections !== next?.connections;
    if (added.length || removed.length || linksChanged) changes.push({ title: next?.title ?? old!.title, added, removed, linksChanged });
  }
  return changes;
}

export type InlineGemChange = { added?: boolean; replaces?: SetupGem; movedFrom?: string };
export type GemMove = { gem: SetupGem; to: string };
export type InlineSetupChanges = { gems: InlineGemChange[]; removed: SetupGem[]; movedOut: GemMove[]; linksChanged: boolean };
export function inlineGemChanges(current: JSONContent[], previous: JSONContent[], overrides?: GemChangeOverrides | null) {
  const before = setupRows(previous), after = setupRows(current);
  const rows = new Map<JSONContent, InlineSetupChanges>();
  const identity = (gem: SetupGem) => `${gem.name.toLowerCase()}|${gem.annotation}`;
  const pool = before.flatMap(row => row.gems.map((gem, index) => ({ gem: { ...gem, ref: gemReference(row, index) }, row, used: false })));
  const states = after.map(row => ({ row, hints: row.gems.map(() => ({} as InlineGemChange)), pending: [] as number[], manual: new Set<number>() }));
  const movedOut = new Map<string, GemMove[]>();
  // Explicit author choices claim their source gems before automatic matching.
  for (const state of states) state.row.gems.forEach((gem, index) => {
    const choice = overrides?.current?.[gemReference(state.row, index)];
    if (!choice) return;
    if (choice.kind === 'new') { state.hints[index] = { added: true }; state.manual.add(index); return; }
    if (choice.kind === 'none') {
      const candidates = pool.filter(entry => !entry.used && entry.row.key === state.row.key && entry.gem.name.toLowerCase() === gem.name.toLowerCase());
      const old = candidates.find(entry => identity(entry.gem) === identity(gem)) ?? candidates[0];
      if (old) old.used = true;
      state.manual.add(index); return;
    }
    if (choice.kind !== 'swap' && choice.kind !== 'moved') return;
    const source = pool.find(entry => !entry.used && entry.gem.ref === choice.from);
    if (!source || (choice.kind === 'moved' && (source.gem.name.toLowerCase() !== gem.name.toLowerCase() || source.row.key === state.row.key))) return;
    source.used = true; state.manual.add(index);
    if (choice.kind === 'swap') state.hints[index] = { replaces: source.gem };
    else {
      state.hints[index] = { movedFrom: source.row.title };
      movedOut.set(source.row.key, [...(movedOut.get(source.row.key) ?? []), { gem: source.gem, to: state.row.title }]);
    }
  });
  // Preserve exact occurrences in their original setups before looking for moves.
  for (const state of states) state.row.gems.forEach((gem, index) => {
    if (state.manual.has(index)) return;
    const match = pool.find(entry => !entry.used && entry.row.key === state.row.key && identity(entry.gem) === identity(gem));
    if (match) match.used = true; else state.pending.push(index);
  });
  // A level annotation change within the same setup is an update, not a move.
  for (const state of states) for (const index of state.pending) {
    const gem = state.row.gems[index];
    const match = pool.find(entry => !entry.used && entry.row.key === state.row.key && entry.gem.name.toLowerCase() === gem.name.toLowerCase());
    if (match) { match.used = true; state.hints[index] = { replaces: match.gem }; }
  }
  // Match moves globally before treating different gems as replacements.
  for (const state of states) for (const index of state.pending) {
    if (state.hints[index].replaces) continue;
    const gem = state.row.gems[index];
    const candidates = pool.filter(entry => !entry.used && entry.row.key !== state.row.key && entry.gem.name.toLowerCase() === gem.name.toLowerCase());
    const match = candidates.find(entry => identity(entry.gem) === identity(gem)) ?? candidates[0];
    if (!match) continue;
    match.used = true; state.hints[index] = { movedFrom: match.row.title };
    movedOut.set(match.row.key, [...(movedOut.get(match.row.key) ?? []), { gem: match.gem, to: state.row.title }]);
  }
  for (const state of states) {
    for (const index of state.pending) {
      if (state.hints[index].replaces || state.hints[index].movedFrom) continue;
      const gem = state.row.gems[index];
      const match = pool.find(entry => !entry.used && entry.row.key === state.row.key
        && (!(gem.alternative || entry.gem.alternative) || entry.gem.socket === gem.socket));
      if (match) { match.used = true; state.hints[index] = { replaces: match.gem }; }
      else state.hints[index] = { added: true };
    }
    const removed = pool.filter(entry => !entry.used && entry.row.key === state.row.key).map(entry => entry.gem);
    const old = before.find(row => row.key === state.row.key);
    rows.set(state.row.paragraph, { gems: state.hints, removed: removed.filter(gem => overrides?.removed?.[gem.ref!] !== 'hide'), movedOut: movedOut.get(state.row.key) ?? [],
      linksChanged: !!old && !state.pending.length && !state.manual.size && !removed.length && !(movedOut.get(state.row.key)?.length) && old.connections !== state.row.connections });
  }
  return { rows, removedSetups: before.filter(row => !after.some(next => next.key === row.key)).map(row => ({ ...row,
    gems: pool.filter(entry => !entry.used && entry.row.key === row.key && overrides?.removed?.[entry.gem.ref!] !== 'hide').map(entry => entry.gem), movedOut: movedOut.get(row.key) ?? [],
  })) };
}

export type GemChangeChoice = { kind: 'new' } | { kind: 'none' } | { kind: 'swap'; from: string } | { kind: 'moved'; from: string };
export type GemChangeOverrides = { current?: Record<string, GemChangeChoice>; removed?: Record<string, 'hide'>; stages?: Record<string, GemChangeOverrides> };
export function gemReference(row: SetupRow, index: number): string {
  const name = row.gems[index].name.toLowerCase();
  const occurrence = row.gems.slice(0, index).filter(gem => gem.name.toLowerCase() === name).length;
  return JSON.stringify([row.key, name, occurrence]);
}
export function setupGemReferences(content: JSONContent[]) {
  return setupRows(content).flatMap(row => row.gems.map((gem, index) => ({ index, ref: gemReference(row, index), title: row.title, rowKey: row.key, gem })));
}

export function gemProgressionStages(content: JSONContent[], baseline?: GemSetupBaseline | null, overrides?: GemChangeOverrides | null) {
  const hasHeadings = content.some(node => node.type === 'heading');
  const latest = new Map<string, JSONContent>();
  function remember(blocks: JSONContent[]) {
    for (const row of setupRows(blocks)) latest.set(row.key, row.paragraph);
  }
  // An earlier block may itself contain several stages. Carry its final links forward.
  let previousBlocks: JSONContent[] = [];
  for (const node of baseline?.content ?? []) {
    if (node.type === 'heading') { remember(previousBlocks); previousBlocks = []; }
    else previousBlocks.push(node);
  }
  remember(previousBlocks);
  const sections: { title: string; content: JSONContent[] }[] = [];
  for (const node of content) {
    if (node.type === 'heading') sections.push({ title: node.content?.map(child => child.text ?? '').join('') || 'Stage', content: [node] });
    else { if (!sections.length) sections.push({ title: 'Starting links', content: [] }); sections.at(-1)!.content.push(node); }
  }
  const occurrences = new Map<string, number>();
  return sections.map(section => {
    const label = section.title.toLowerCase().trim(), occurrence = occurrences.get(label) ?? 0;
    occurrences.set(label, occurrence + 1);
    const key = `${label}:${occurrence}`;
    const previous = [...latest.values()];
    const comparable = previous;
    const stageOverrides = hasHeadings ? overrides?.stages?.[key] : overrides;
    const changes = previous.length ? inlineGemChanges(section.content, comparable, stageOverrides) : null;
    if (hasHeadings && changes) changes.removedSetups = [];
    remember(section.content);
    return { ...section, key, baseline: previous.length ? { title: 'Previous stage', content: comparable } : null, overrides: stageOverrides, changes };
  });
}
