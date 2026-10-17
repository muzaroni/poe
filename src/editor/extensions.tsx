import { gemDisplayName } from '../lib/gems';
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { X, Plus } from 'lucide-react';
import Image from '@tiptap/extension-image';
import { assetUrl } from '../lib/guide';
import { useState } from 'react';
import GuideDocument from '../components/GuideDocument';

export const Gem = Node.create({
  name: 'gem', group: 'inline', inline: true, atom: true,
  addAttributes() { return { name: { default: '' }, color: { default: 'red' } }; },
  parseHTML() { return [{ tag: 'span[data-gem]' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes, { 'data-gem': '', class: `gem gem-${HTMLAttributes.color}` }), HTMLAttributes.name]; },
  addNodeView() { return ReactNodeViewRenderer(({ node }: NodeViewProps) => <NodeViewWrapper as="span" className={`gem gem-${node.attrs.color}`} contentEditable={false}><button type="button" className={`gem gem-${node.attrs.color}`} data-gem-info={node.attrs.name} aria-haspopup="dialog" aria-label={`${gemDisplayName(node.attrs.name)}: gem details`}>{gemDisplayName(node.attrs.name)}</button></NodeViewWrapper>); },
});

export const Icon = Node.create({
  name: 'icon', group: 'inline', inline: true, atom: true,
  addAttributes() { return { src: { default: '' }, name: { default: '' } }; },
  parseHTML() { return [{ tag: 'img[data-guide-icon]' }]; },
  renderHTML({ HTMLAttributes }) { return ['img', mergeAttributes(HTMLAttributes, { 'data-guide-icon': '', class: 'inline-icon' })]; },
  addNodeView() { return ReactNodeViewRenderer(({ node }: NodeViewProps) => <NodeViewWrapper as="span" contentEditable={false}><img className="inline-icon" src={assetUrl(node.attrs.src)} alt={node.attrs.name ?? ''} title={node.attrs.name || undefined} /></NodeViewWrapper>); },
});

export const GuideImage = Image.extend({
  addNodeView() { return ReactNodeViewRenderer(({ node }: NodeViewProps) => <NodeViewWrapper className="editor-figure" contentEditable={false}><img className="editor-image" src={assetUrl(node.attrs.src)} alt={node.attrs.alt || 'Guide screenshot'} /><span>{node.attrs.alt || 'Guide screenshot'}</span></NodeViewWrapper>); },
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
  const links = (node.attrs.links ?? []) as { label: string; url: string }[];
  function update(index: number, key: 'label' | 'url', value: string) {
    updateAttributes({ links: links.map((link, i) => i === index ? { ...link, [key]: value } : link) });
  }
  return <NodeViewWrapper className="editor-special pob-editor">
    <div className="block-eyebrow">PATH OF BUILDING LINKS</div>
    {links.map((link, index) => <div className="pob-editor-row" key={index}>
      <input aria-label={`PoB ${index + 1} label`} value={link.label} onChange={(e) => update(index, 'label', e.target.value)} placeholder="Label" />
      <input aria-label={`PoB ${index + 1} URL`} value={link.url} onChange={(e) => update(index, 'url', e.target.value)} placeholder="https://pobb.in/..." />
      <button type="button" aria-label="Remove link" onClick={() => updateAttributes({ links: links.filter((_, i) => i !== index) })}><X size={16} /></button>
    </div>)}
    <button type="button" className="editor-add-link" onClick={() => updateAttributes({ links: [...links, { label: '', url: '' }] })}><Plus size={15} /> Add PoB link</button>
  </NodeViewWrapper>;
}
export const PobLinks = Node.create({
  name: 'pobLinks', group: 'block', atom: true, draggable: true,
  addAttributes() { return { links: { default: [] } }; },
  parseHTML() { return [{ tag: 'div[data-pob-links]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-pob-links': '' })]; },
  addNodeView() { return ReactNodeViewRenderer(PobView); },
});

function GemSetupEditor({ node }: NodeViewProps) {
  const [editing, setEditing] = useState(!JSON.stringify(node.toJSON()).includes('"type":"gem"'));
  return <NodeViewWrapper className="gem-setup-editor">
    <div className="gem-setup-controls" contentEditable={false}><span className="block-eyebrow">GEM LINKS</span><button type="button" onClick={() => setEditing(!editing)}>{editing ? 'Preview setup' : 'Edit setup'}</button></div>
    <div contentEditable={false} hidden={editing} className="gem-setup-preview"><fieldset disabled><GuideDocument content={{ type: 'doc', content: [node.toJSON()] }} slug="editor-gem-preview" /></fieldset></div>
    <div hidden={!editing} className="gem-setup-source"><p contentEditable={false} className="gem-setup-hint">Use + for linked gems and commas for independent gems. Add a label such as Main: or Utility: before a setup.</p><NodeViewContent /></div>
  </NodeViewWrapper>;
}

export const GemSetup = Node.create({
  name: 'gemSetup', group: 'block', content: 'block+', defining: true,
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
