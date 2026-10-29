import type { JSONContent } from '@tiptap/core';
export type PathSelections = Record<string, string>;
export function resolveGemPaths(document: JSONContent, selections: PathSelections): JSONContent {
  const choices = new Map<string, string>();
  const ended = new Set<string>();
  return { ...document, content: (document.content ?? []).filter(node => {
    const a = node.attrs ?? {};
    if (node.type === 'gemPathChoice') { choices.set(a.id, selections[a.id] ?? a.defaultPath ?? a.options?.[0]?.id); ended.delete(a.id); }
    if (node.type === 'gemPathMerge') { ended.add(a.choiceId); }
    if (node.type === 'gemSetup' && a.pathChoice && a.pathId) return !ended.has(a.pathChoice) && choices.get(a.pathChoice) === a.pathId;
    return true;
  }) };
}

// Older guides stored card copy in plain attributes. Keep that copy when opening
// them in the rich-text editor; subsequent saves store normal marked text nodes.
export function prepareGemPathContent(node: JSONContent): JSONContent {
  if (node.type === 'gemPathChoice' && !node.content?.length) {
    const a = node.attrs ?? {};
    const field = (role: string, text: string, optionId = ''): JSONContent => ({
      type: 'gemPathText', attrs: { role, optionId },
      content: text ? [{ type: 'text', text }] : [],
    });
    return { ...node, content: [field('title', a.title ?? 'Choose your leveling path'),
      ...(a.options ?? [{ id: 'a', label: 'Continue current setup', description: '' }, { id: 'b', label: 'Alternative setup', description: '' }]).flatMap((o: { id: string; label: string; description: string }) => [field('label', o.label, o.id), field('description', o.description, o.id)])] };
  }
  return { ...node, ...(node.content ? { content: node.content.map(prepareGemPathContent) } : {}) };
}
export function gemPathField(node: JSONContent, role: string, optionId = ''): JSONContent[] | undefined {
  return node.content?.find(n => n.type === 'gemPathText' && n.attrs?.role === role && (n.attrs?.optionId ?? '') === optionId)?.content;
}
export function gemPathAttributes(node: JSONContent): NonNullable<JSONContent['attrs']> {
  const a = node.attrs ?? {};
  const text = (nodes: JSONContent[] | undefined, fallback: string) => nodes === undefined ? fallback : nodes.map(n => n.text ?? (n.type === 'hardBreak' ? '\n' : '')).join('');
  return { ...a, title: text(gemPathField(node, 'title'), a.title), options: (a.options ?? []).map((o: { id: string; label: string; description: string }) => ({ ...o, label: text(gemPathField(node, 'label', o.id), o.label), description: text(gemPathField(node, 'description', o.id), o.description) })) };
}
