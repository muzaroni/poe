import { setupRows, type GemSetupBaseline } from '../lib/gem-links';
import GemChangeControls from './GemChangeControls';
import GemSetupChanges from '../components/GemSetupChanges';
import type { JSONContent } from '@tiptap/core';
import TreeBlockEditor from './TreeBlockEditor';
import { gemDisplayName } from '../lib/gems';
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { ArrowDown, ArrowUp, X, Plus } from 'lucide-react';
import Image from '@tiptap/extension-image';
import { assetUrl } from '../lib/guide';
import { useEffect, useState } from 'react';
import GuideDocument from '../components/GuideDocument';
import { gemVendorCostAt, type GemVendorCost } from '../lib/gem-vendor';
import { acquisitionVendorForAct, carryGemAcquisitions } from '../lib/gem-links';
import { gemRewardNpc } from '../lib/gem-rewards';

const acquisitionDocuments = new WeakMap<object, JSONContent>();

function GemEditorView({ node, editor, getPos, updateAttributes }: NodeViewProps) {
  const [price, setPrice] = useState<GemVendorCost | null>(null);
  const [inheritedAcquisition, setInheritedAcquisition] = useState<'reward' | 'buy' | null>(null);
  const position = getPos();
  const resolved = typeof position === 'number' ? editor.state.doc.resolve(position) : null;
  const inGemSetup = resolved ? Array.from({ length: resolved.depth + 1 }, (_, depth) => resolved.node(depth).type.name).includes('gemSetup') : false;
  function currentAct(): number | null {
    if (typeof position !== 'number') return null;
    let act: number | null = null;
    editor.state.doc.forEach((item, offset) => {
      if (offset >= position) return;
      if (item.type.name !== 'heading' || item.attrs.level !== 2) return;
      const match = /^Act\s+(10|[1-9])\b/i.exec(item.textContent.trim());
      act = match ? Number(match[1]) : null;
    });
    return act;
  }
  useEffect(() => {
    function refresh() {
      const position = getPos();
      if (typeof position !== 'number') return;
      const resolved = editor.state.doc.resolve(position);
      let normalized = acquisitionDocuments.get(editor.state.doc);
      if (!normalized) {
        normalized = carryGemAcquisitions(editor.getJSON());
        acquisitionDocuments.set(editor.state.doc, normalized);
      }
      let effective: JSONContent | undefined = normalized;
      for (let depth = 0; depth <= resolved.depth; depth++) effective = effective?.content?.[resolved.index(depth)];
      const acquisition = effective?.attrs?.acquisition;
      setInheritedAcquisition(acquisition === 'reward' || acquisition === 'buy' ? acquisition : null);
      if (resolved.parent.type.name !== 'paragraph') { setPrice(null); return; }
      setPrice(gemVendorCostAt(resolved.parent.toJSON().content ?? [], resolved.index(), editor.view.dom.dataset.guideLeague ?? ''));
    }
    editor.on('update', refresh);
    editor.view.dom.addEventListener('gem-vendor-league', refresh);
    refresh();
    return () => { editor.off('update', refresh); editor.view.dom.removeEventListener('gem-vendor-league', refresh); };
  }, [editor, getPos, node.attrs.name]);
  const explicitAcquisition = node.attrs.acquisition === 'reward' || node.attrs.acquisition === 'buy' ? node.attrs.acquisition as 'reward' | 'buy' : null;
  const acquisitionAct = Number(node.attrs.acquisitionAct) || currentAct();
  const suggestedNpc = explicitAcquisition === 'reward'
    ? gemRewardNpc(node.attrs.name, acquisitionAct, editor.view.dom.dataset.guideAscendancy ?? '', editor.view.dom.dataset.guideLeague ?? '')
    : explicitAcquisition === 'buy' ? acquisitionVendorForAct(acquisitionAct, 'buy') : null;
  return <NodeViewWrapper as="span" contentEditable={false}><button type="button" className={`gem gem-${node.attrs.color}`} data-gem-info={node.attrs.name} aria-haspopup="dialog" aria-label={`${gemDisplayName(node.attrs.name)}: gem details`}>{gemDisplayName(node.attrs.name)}</button>{inGemSetup && <select className="gem-acquisition-select" aria-label={`How to get ${gemDisplayName(node.attrs.name)} in this setup`} title="R reward · B buy · — clear · R/B carry previous choice" value={node.attrs.acquisition === 'none' ? 'none' : node.attrs.acquisition ?? inheritedAcquisition ?? ''} onChange={event => updateAttributes({ acquisition: event.target.value || null, acquisitionAct: event.target.value === 'reward' || event.target.value === 'buy' ? currentAct() : null, acquisitionVendor: null })}><option value="">R/B</option><option value="reward">R</option><option value="buy">B</option><option value="none">—</option></select>}{inGemSetup && explicitAcquisition && <input key={`${node.attrs.name}-${explicitAcquisition}`} className="gem-acquisition-vendor" aria-label={`${explicitAcquisition === 'reward' ? 'Reward NPC' : 'Vendor'} for ${gemDisplayName(node.attrs.name)}`} title="NPC name; leave blank to use the suggested name" placeholder={suggestedNpc ?? 'NPC name'} defaultValue={node.attrs.acquisitionVendor ?? ''} onBlur={event => { const vendor = event.currentTarget.value.trim(); if (vendor !== (node.attrs.acquisitionVendor ?? '')) updateAttributes({ acquisitionVendor: vendor || null }); }} />}{price && <> - {price.cost} <img className="inline-icon" src={assetUrl(price.icon)} alt={price.currency} title={price.currency} /></>}</NodeViewWrapper>;
}

export const Gem = Node.create({
  name: 'gem', group: 'inline', inline: true, atom: true,
  addAttributes() { return { name: { default: '' }, color: { default: 'red' }, acquisition: { default: null, parseHTML: element => element.getAttribute('data-acquisition'), renderHTML: attrs => attrs.acquisition ? { 'data-acquisition': attrs.acquisition } : {} }, acquisitionAct: { default: null, parseHTML: element => { const value = Number(element.getAttribute('data-acquisition-act')); return value >= 1 && value <= 10 ? value : null; }, renderHTML: attrs => attrs.acquisitionAct ? { 'data-acquisition-act': attrs.acquisitionAct } : {} }, acquisitionVendor: { default: null, parseHTML: element => element.getAttribute('data-acquisition-vendor'), renderHTML: attrs => attrs.acquisitionVendor ? { 'data-acquisition-vendor': attrs.acquisitionVendor } : {} } }; },
  parseHTML() { return [{ tag: 'span[data-gem]' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes, { 'data-gem': '', class: `gem gem-${HTMLAttributes.color}` }), HTMLAttributes.name]; },
  addNodeView() { return ReactNodeViewRenderer(GemEditorView); },
});

export const Icon = Node.create({
  name: 'icon', group: 'inline', inline: true, atom: true,
  addAttributes() { return { src: { default: '' }, name: { default: '' } }; },
  parseHTML() { return [{ tag: 'img[data-guide-icon]' }]; },
  renderHTML({ HTMLAttributes }) { return ['img', mergeAttributes(HTMLAttributes, { 'data-guide-icon': '', class: 'inline-icon' })]; },
  addNodeView() { return ReactNodeViewRenderer(({ node }: NodeViewProps) => <NodeViewWrapper as="span" contentEditable={false}><img className="inline-icon" src={assetUrl(node.attrs.src)} alt={node.attrs.name ?? ''} title={node.attrs.name || undefined} /></NodeViewWrapper>); },
});

function ImageView({ node, updateAttributes }: NodeViewProps) {
  const width = node.attrs.widthPercent == null ? null : Math.max(10, Math.min(100, Number(node.attrs.widthPercent) || 100));
  const caption = node.attrs.caption ?? (node.attrs.alt === 'Guide screenshot' ? '' : node.attrs.alt ?? '');
  return <NodeViewWrapper className="editor-figure" contentEditable={false}>
    <img className="editor-image" src={assetUrl(node.attrs.src)} alt={node.attrs.alt || ''} style={width == null ? undefined : { width: `${width}%`, height: 'auto' }} />
    <div className="image-controls">
      <label>Caption<input type="text" aria-label="Image caption" placeholder="Add a caption…" value={caption} onChange={(event) => updateAttributes({ caption: event.target.value })} /></label>
      <div className="image-width-controls"><label>Image width<input type="range" aria-label="Image width" min="10" max="100" step="5" value={width ?? 100} onChange={(event) => updateAttributes({ widthPercent: Number(event.target.value) })} /></label><output>{width == null ? 'Original' : `${width}%`}</output><button type="button" onClick={() => updateAttributes({ widthPercent: null })}>Reset size</button></div>
    </div>
  </NodeViewWrapper>;
}

export const GuideImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: { default: null, parseHTML: (element) => element.getAttribute('data-caption'), renderHTML: (attributes) => attributes.caption == null ? {} : { 'data-caption': attributes.caption } },
      widthPercent: { default: null, parseHTML: (element) => element.hasAttribute('data-width-percent') ? Number(element.getAttribute('data-width-percent')) : null, renderHTML: (attributes) => attributes.widthPercent == null ? {} : { 'data-width-percent': attributes.widthPercent, style: `width: ${Math.max(10, Math.min(100, Number(attributes.widthPercent) || 100))}%; height: auto;` } },
    };
  },
  addNodeView() { return ReactNodeViewRenderer(ImageView); },
});

function RegexView({ node, updateAttributes, selected }: NodeViewProps) {
  return <NodeViewWrapper className={`editor-special regex-editor ${selected ? 'is-selected' : ''}`}>
    <div className="block-eyebrow">COPYABLE REGEX</div>
    <input aria-label="Regex title" value={node.attrs.label ?? ''} onChange={(e) => updateAttributes({ label: e.target.value })} placeholder="Title" />
    <textarea aria-label="Regex text" value={node.attrs.value ?? ''} onChange={(e) => updateAttributes({ value: e.target.value })} placeholder="Paste regex here" rows={2} />
  </NodeViewWrapper>;
}
export const Regex = Node.create({
  name: 'regex', group: 'block', atom: true, draggable: true,
  addAttributes() { return { label: { default: 'Regex' }, value: { default: '' } }; },
  parseHTML() { return [{ tag: 'div[data-regex]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-regex': '' })]; },
  addNodeView() { return ReactNodeViewRenderer(RegexView); },
});

function PobView({ node, updateAttributes }: NodeViewProps) {
  type PobLink = { label: string; url: string };
  // Keep typing synchronous; node-view attribute updates can arrive after React's input event.
  const [links, setLinks] = useState<PobLink[]>(() => node.attrs.links ?? []);
  useEffect(() => { setLinks(node.attrs.links ?? []); }, [node.attrs.links]);
  function saveLinks(next: PobLink[]) { setLinks(next); updateAttributes({ links: next }); }
  function update(index: number, key: 'label' | 'url', value: string) {
    saveLinks(links.map((link, i) => i === index ? { ...link, [key]: value } : link));
  }
  function move(index: number, direction: -1 | 1) {
    const next = [...links];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    saveLinks(next);
  }
  return <NodeViewWrapper className="editor-special pob-editor" contentEditable={false}>
    {links.map((link, index) => <div className="pob-editor-row" key={index}>
      <input aria-label={`PoB ${index + 1} label`} value={link.label} onChange={(e) => update(index, 'label', e.target.value)} placeholder="Label" />
      <input aria-label={`PoB ${index + 1} URL`} value={link.url} onChange={(e) => update(index, 'url', e.target.value)} placeholder="https://pobb.in/..." />
      <button type="button" aria-label={`Move PoB link ${index + 1} up`} title="Move up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button>
      <button type="button" aria-label={`Move PoB link ${index + 1} down`} title="Move down" disabled={index === links.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button>
      <button type="button" aria-label={`Remove PoB link ${index + 1}`} title="Remove link" onClick={() => saveLinks(links.filter((_, i) => i !== index))}><X size={16} /></button>
    </div>)}
    <button type="button" className="editor-add-link" onClick={() => saveLinks([...links, { label: '', url: '' }])}><Plus size={15} /> Add PoB link</button>
  </NodeViewWrapper>;
}
export const PobLinks = Node.create({
  name: 'pobLinks', group: 'block', atom: true, draggable: true,
  addAttributes() { return { links: { default: [] } }; },
  parseHTML() { return [{ tag: 'div[data-pob-links]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-pob-links': '' })]; },
  addNodeView() { return ReactNodeViewRenderer(PobView); },
});

function GemSetupEditor({ node, editor, getPos, updateAttributes }: NodeViewProps) {
  const [editing, setEditing] = useState(!JSON.stringify(node.toJSON()).includes('"type":"gem"'));
  const [, refreshPreview] = useState(0);
  useEffect(() => {
    const refresh = () => refreshPreview(value => value + 1);
    editor.on('update', refresh);
    return () => { editor.off('update', refresh); };
  }, [editor]);
  function earlierSetups() {
    const sources: { title: string; position: number }[] = [];
    const position = getPos(); let heading = 'Earlier setup';
    editor.state.doc.descendants((candidate, pos) => {
      if (typeof position !== 'number' || pos >= position) return false;
      if (candidate.type.name === 'heading') heading = candidate.textContent;
      if (candidate.type.name === 'gemSetup') {
        const rows = setupRows(candidate.toJSON().content ?? []);
        if (rows.length) sources.push({ position: pos, title: `${heading} · ${rows.map(row => row.title).join(', ')}` });
        return false;
      }
    });
    return sources;
  }
  const [sources, setSources] = useState(earlierSetups);
  const [sourcePosition, setSourcePosition] = useState<number | ''>(() => sources.at(-1)?.position ?? '');
  useEffect(() => {
    if (!editing) return;
    const refresh = () => {
      const next = earlierSetups(); setSources(next);
      setSourcePosition(current => next.some(source => source.position === current) ? current : next.at(-1)?.position ?? '');
    };
    editor.on('update', refresh); refresh();
    return () => { editor.off('update', refresh); };
  }, [editor, getPos, editing]);
  function refreshSources() {
    const next = earlierSetups(); setSources(next);
    if (!next.some(source => source.position === sourcePosition)) setSourcePosition(next.at(-1)?.position ?? '');
  }
  function compareSetup() {
    const source = sources.find(item => item.position === sourcePosition), position = getPos();
    const before = source ? editor.state.doc.nodeAt(source.position) : null;
    if (!source || !before || before.type.name !== 'gemSetup' || typeof position !== 'number' || source.position >= position) return;
    updateAttributes({ previousSetup: { title: source.title, content: JSON.parse(JSON.stringify(before.toJSON().content ?? [])) }, changeOverrides: null });
  }
  function continueSetup() {
    const source = sources.find(item => item.position === sourcePosition), position = getPos();
    const before = source ? editor.state.doc.nodeAt(source.position) : null;
    if (!source || !before || before.type.name !== 'gemSetup' || typeof position !== 'number' || source.position >= position) return;
    const content = JSON.parse(JSON.stringify(before.toJSON().content ?? [])) as JSONContent[];
    const baseline: GemSetupBaseline = { title: source.title, content };
    editor.commands.command(({ tr }) => {
      tr.replaceWith(position, position + node.nodeSize, node.type.create({ ...node.attrs, previousSetup: baseline, changeOverrides: null }, before.content));
      return true;
    });
    setEditing(false);
  }
  const normalized = carryGemAcquisitions(editor.getJSON());
  let previewNode = node.toJSON();
  editor.state.doc.forEach((_candidate, offset, index) => {
    if (offset === getPos()) previewNode = normalized.content?.[index] ?? previewNode;
  });
  return <NodeViewWrapper className="gem-setup-editor">
    <div className="gem-setup-controls" contentEditable={false}><span className="block-eyebrow">GEM LINKS</span><button type="button" onClick={() => setEditing(!editing)}>{editing ? 'Preview setup' : 'Edit setup'}</button></div>
    <div className="gem-setup-continuation" contentEditable={false} hidden={!editing}>
      <label>Continue from<select aria-label="Previous gem links" value={sourcePosition} disabled={!sources.length} onFocus={refreshSources} onChange={event => setSourcePosition(Number(event.target.value))}>{!sources.length && <option value="">No earlier gem links</option>}{sources.map((source, index) => <option key={source.position} value={source.position}>{index + 1}. {source.title}</option>)}</select></label>
      <button type="button" disabled={!sources.length} onClick={continueSetup}>Continue gem links</button><button type="button" disabled={!sources.length} onClick={compareSetup} title="Compare the existing setup without replacing its gems">Compare only</button>
      {node.attrs.previousSetup && <button type="button" onClick={() => updateAttributes({ previousSetup: null, changeOverrides: null })}>Remove comparison</button>}
    </div>
    {editing && <GemChangeControls content={node.toJSON().content ?? []} baseline={node.attrs.previousSetup} value={node.attrs.changeOverrides} onChange={value => updateAttributes({ changeOverrides: value })} />}
    <div contentEditable={false} hidden={editing} className="gem-setup-preview"><fieldset disabled><GuideDocument content={{ type: 'doc', content: [previewNode] }} slug="editor-gem-preview" league={editor.view.dom.dataset.guideLeague ?? ''} ascendancy={editor.view.dom.dataset.guideAscendancy ?? ''} normalized /></fieldset></div>
    <div hidden={!editing} className="gem-setup-source"><p contentEditable={false} className="gem-setup-hint">Use + for linked gems, “or” for alternatives, and commas for independent gems. Choose R (reward) or B (buy) beside a gem; the choice carries into later setups. Enter an NPC name when the suggested one differs, or choose — to clear it. Add headings for level stages and keep labels such as Link 1: or Utility: consistent. Each stage tracks changes from the latest links; omitted setups stay unchanged.</p><NodeViewContent /><div contentEditable={false}><GemSetupChanges content={node.toJSON().content ?? []} baseline={node.attrs.previousSetup} overrides={node.attrs.changeOverrides} /></div></div>
  </NodeViewWrapper>;
}

export const GemSetup = Node.create({
  name: 'gemSetup', group: 'block', content: 'block+', defining: true,
  addAttributes() { return { changeOverrides: { default: null, parseHTML: element => { try { return JSON.parse(element.getAttribute('data-gem-change-overrides') ?? 'null'); } catch { return null; } }, renderHTML: attrs => attrs.changeOverrides ? { 'data-gem-change-overrides': JSON.stringify(attrs.changeOverrides) } : {} }, previousSetup: { default: null, parseHTML: element => { try { return JSON.parse(element.getAttribute('data-previous-setup') ?? 'null'); } catch { return null; } }, renderHTML: attrs => attrs.previousSetup ? { 'data-previous-setup': JSON.stringify(attrs.previousSetup) } : {} } }; },
  parseHTML() { return [{ tag: 'section[data-gem-setup]' }]; },
  renderHTML({ HTMLAttributes }) { return ['section', mergeAttributes(HTMLAttributes, { 'data-gem-setup': '', class: 'gem-setup' }), 0]; },
  addNodeView() { return ReactNodeViewRenderer(GemSetupEditor); },
});

export const Callout = Node.create({
  name: 'callout', group: 'block', content: 'block+', defining: true,
  addAttributes() { return { tone: { default: 'note' } }; },
  parseHTML() { return [{ tag: 'aside[data-callout]' }]; },
  renderHTML({ HTMLAttributes }) { return ['aside', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0]; },
  addNodeView() { return ReactNodeViewRenderer(({ node }: NodeViewProps) => <NodeViewWrapper className={`callout ${node.attrs.tone === 'important' ? 'callout-important' : ''}`}><NodeViewContent /></NodeViewWrapper>); },
});

export const PassiveTreeBlock = Node.create({
  name: 'passiveTree', group: 'block', atom: true, draggable: false,
  addAttributes() { return { snapshot: { default: {}, parseHTML: element => { try { return JSON.parse(element.getAttribute('data-snapshot') ?? '{}'); } catch { return {}; } }, renderHTML: attributes => ({ 'data-snapshot': JSON.stringify(attributes.snapshot) }) } }; },
  parseHTML() { return [{ tag: 'section[data-passive-tree]' }]; },
  renderHTML({ HTMLAttributes }) { return ['section', mergeAttributes(HTMLAttributes, { 'data-passive-tree': '' })]; },
  addNodeView() { return ReactNodeViewRenderer(TreeBlockEditor); },
});
