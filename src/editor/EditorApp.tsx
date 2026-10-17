import { assetUrl } from '../lib/guide';
import { gemDisplayName } from '../lib/gems';
import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import * as Dialog from '@radix-ui/react-dialog';
import { Bold, CheckSquare, ChevronDown, Code2, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListChecks, Plus, Redo2, Save, Undo2, Underline, X } from 'lucide-react';
import type { JSONContent } from '@tiptap/core';
import { Button } from '../components/ui/Button';
import { deleteDraft, listDrafts, saveDraft } from './drafts';
import { Callout, Gem, GemSetup, GuideImage, Icon, PobLinks, Regex, PassiveTreeBlock } from './extensions';
import TagInput from './TagInput';
import { contentPath } from '../lib/search';
import { buildDetails } from '../lib/build';
import gems from '../data/gems.json';
import type { Guide } from '../types';
import './editor.css';

const currencies = [
  { name: 'Scroll of Wisdom', src: '/images/sunder-rf/wisdom.png' },
  { name: 'Orb of Transmutation', src: '/images/sunder-rf/trans.png' },
  { name: 'Orb of Alteration', src: '/images/sunder-rf/alt.png' },
  { name: 'Orb of Chance', src: '/images/sunder-rf/chance.png' },
  { name: 'Orb of Alchemy', src: '/images/currency/alchemy.png' },
];

const API = 'http://127.0.0.1:4322';
const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/`;
const localDate = () => { const day = new Date(); return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`; };
type Modal = 'gem' | 'link' | 'new' | 'color' | 'cost' | 'delete' | null;

function newGuide(title: string, kind: 'build' | 'article' = 'build'): Guide {
  const slug = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 70) || 'new-build';
  const sections = kind === 'article' ? ['Overview'] : ['Overview', 'PoB Links', 'Leveling', ...Array.from({ length: 10 }, (_, i) => `Act ${i + 1} Progression`), 'Transition', 'Endgame'];
  return { slug, title, kind, tags: [], subtitle: '', league: '', ascendancy: '', updated: localDate(), content: { type: 'doc', content: sections.flatMap((section) => [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: section }] },
    { type: 'paragraph' },
  ]) } };
}

async function uploadImage(file: File): Promise<string> {
  const response = await fetch(`${API}/upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
  if (!response.ok) throw new Error((await response.json()).error ?? 'Upload failed');
  return (await response.json()).src;
}

export default function EditorApp({ initialGuides }: { initialGuides: Guide[] }) {
  const [guide, setGuide] = useState<Guide>(initialGuides[0] ?? newGuide('New build'));
  const [knownGuides, setKnownGuides] = useState<Guide[]>(initialGuides);
  const [modal, setModal] = useState<Modal>(null);
  const [deleting, setDeleting] = useState(false);
  const [, refreshFormatting] = useState(0);
  const [query, setQuery] = useState('');
  const [activeGem, setActiveGem] = useState(0);
  const gemSearch = useRef<HTMLInputElement>(null);
  const gemResults = useRef<HTMLDivElement>(null);
  const returnToWriting = useRef(false);
  function openGemPicker() { setQuery(''); setActiveGem(0); returnToWriting.current = true; setModal('gem'); }
  const [url, setUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<'build' | 'article'>('build');
  const [costAmount, setCostAmount] = useState('1');
  const [costCurrency, setCostCurrency] = useState(currencies[0]);
  const [costShowName, setCostShowName] = useState(false);
  const [textColor, setTextColor] = useState('#b9bdc1');
  const validTextColor = /^#[0-9a-f]{6}$/i.test(textColor.trim());
  const [status, setStatus] = useState('Checking local editor…');
  const [localServer, setLocalServer] = useState(false);
  const [draftState, setDraftState] = useState('');
  const [ready, setReady] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const draftInput = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      TextStyle,
      Color,
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
      GuideImage,
      Placeholder.configure({ placeholder: 'Write your guide here…' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Gem, Icon, Regex, PobLinks, GemSetup, Callout, PassiveTreeBlock,
    ],
    content: guide.content,
    editorProps: {
      attributes: { class: 'tiptap guide-content' },
      handleTextInput: (view, from, to, text) => {
        if (text !== '@' || from !== to || view.composing) return false;
        const position = view.state.doc.resolve(from);
        const before = position.parent.textBetween(0, position.parentOffset, '\n', '\ufffc');
        if (position.parent.type.name === 'codeBlock' || (before && !/\s$/.test(before))) return false;
        openGemPicker(); return true;
      },
      handleKeyDown: (view, event) => {
        if (event.isComposing || view.composing) return false;
        const { selection } = view.state;
        const before = selection.$from.parent.textBetween(0, selection.$from.parentOffset, '\n', '\ufffc');
        const shortcut = (event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyG';
        const mention = event.key === '@' && !event.ctrlKey && !event.metaKey && selection.empty && (!before || /\s$/.test(before)) && selection.$from.parent.type.name !== 'codeBlock';
        if (!shortcut && !mention) return false;
        event.preventDefault(); openGemPicker(); return true;
      },
      handlePaste: (_view, event) => {
        const image = Array.from(event.clipboardData?.files ?? []).find((file) => file.type.startsWith('image/'));
        if (!image) return false;
        void uploadImage(image).then((src) => editor?.chain().focus().insertContent({ type: 'image', attrs: { src, alt: image.name } }).run()).catch((error) => setStatus(error.message));
        return true;
      },
    },
    onSelectionUpdate: () => refreshFormatting((value) => value + 1),
    onUpdate: ({ editor: current }) => setGuide((previous) => ({ ...previous, content: current.getJSON() })),
    immediatelyRender: false,
  });

  useEffect(() => {
    fetch(`${API}/health`).then((response) => {
      setLocalServer(response.ok);
      setStatus(response.ok ? 'Local editor ready' : 'Start the local editor to save to project');
    }).catch(() => setStatus('Start the local editor to save to project'));
  }, []);

  useEffect(() => {
    if (!editor) return;
    let cancelled = false;
    listDrafts().then((drafts) => {
      if (cancelled) return;
      const recovered = drafts.map((draft) => {
        const saved = initialGuides.find((item) => item.slug === draft.slug);
        return { ...draft, tags: draft.tags ?? saved?.tags ?? [], kind: draft.kind ?? saved?.kind ?? 'build' as const };
      });
      const merged = [...initialGuides.filter((saved) => !drafts.some((draft) => draft.slug === saved.slug)), ...recovered];
      setKnownGuides(merged);
      const activeSlug = localStorage.getItem('poe-active-guide');
      const selected = merged.find((item) => item.slug === activeSlug) ?? merged.find((item) => item.slug === guide.slug);
      if (selected) {
        setGuide(selected);
        editor.commands.setContent(selected.content, { emitUpdate: false });
        if (drafts.some((item) => item.slug === selected.slug)) setDraftState('Recovered local draft');
      }
      setReady(true);
    }).catch(() => { setDraftState('Draft storage unavailable'); setReady(true); });
    return () => { cancelled = true; };
  }, [editor]);

  useEffect(() => {
    if (!ready) return;
    const timeout = window.setTimeout(() => {
      saveDraft(guide).then(() => setDraftState('Draft saved in this browser')).catch(() => setDraftState('Draft storage unavailable'));
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [guide, ready]);

  function switchGuide(next: Guide, preserveCurrent = true) {
    if (preserveCurrent && ready && guide.slug !== next.slug) {
      const outgoing = { ...guide, content: editor?.getJSON() ?? guide.content };
      setKnownGuides((current) => [...current.filter((item) => item.slug !== outgoing.slug), outgoing]);
      void saveDraft(outgoing).catch(() => setDraftState('Draft storage unavailable'));
    }
    setGuide(next);
    editor?.commands.setContent(next.content, { emitUpdate: false });
    try { localStorage.setItem('poe-active-guide', next.slug); } catch { /* private browsing */ }
    setDraftState('');
  }

  function downloadDraft() {
    if (!editor || !ready) return;
    const payload = { ...guide, content: editor.getJSON() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `${guide.slug}-draft.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Draft downloaded. Import it in the local editor, then Save to project.');
  }

  async function importDraft(file?: File) {
    if (!file || !editor || !ready) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('Draft file is too large (maximum 8 MB).');
      const draft = JSON.parse(await file.text());
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug ?? '') || typeof draft.title !== 'string' || !draft.title.trim() || draft.content?.type !== 'doc' || !Array.isArray(draft.content.content)) throw new Error('Choose a guide draft JSON file.');
      if (draft.kind != null && !['build', 'article'].includes(draft.kind)) throw new Error('Unknown content type.');
      if (draft.tags != null && (!Array.isArray(draft.tags) || draft.tags.some((tag: unknown) => typeof tag !== 'string'))) throw new Error('Invalid draft tags.');
      // Keep the current version available as a download before replacing it.
      downloadDraft();
      const imported: Guide = { ...draft, subtitle: draft.subtitle ?? '', league: draft.league ?? '', updated: draft.updated ?? localDate() };
      await saveDraft(imported);
      setKnownGuides((current) => [...current.filter((item) => item.slug !== imported.slug), imported]);
      switchGuide(imported);
      setStatus('Draft imported. Review it, then click Save to project. Your previous guide was downloaded as a backup.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not import draft'); }
  }

  async function discardDraft() {
    await deleteDraft(guide.slug);
    const saved = initialGuides.find((item) => item.slug === guide.slug);
    const next = saved ?? knownGuides.find(item => item.slug !== guide.slug) ?? initialGuides[0] ?? newGuide('New build');
    setKnownGuides((current) => current.filter((item) => item.slug !== guide.slug || item.slug === saved?.slug));
    switchGuide(next, false);
    setStatus(saved ? 'Loaded project version' : 'Removed unsaved guide');
  }

  async function deletePage() {
    if (!editor || !localServer || deleting) return;
    const outgoing = { ...guide, content: editor.getJSON() };
    setDeleting(true); setReady(false); editor.setEditable(false);
    try {
      // Remove the browser copy before file watchers can refresh the editor.
      await deleteDraft(outgoing.slug);
      const response = await fetch(`${API}/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(outgoing) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not delete page');
      const remaining = knownGuides.filter((item) => item.slug !== outgoing.slug);
      setKnownGuides(remaining);
      switchGuide(remaining[0] ?? newGuide('New build'), false);
      setModal(null);
      setStatus(`Page deleted locally. Backup: ${result.backup}. Push to GitHub to remove the published page.`);
    } catch (error) {
      await saveDraft(outgoing).catch(() => {});
      setStatus(error instanceof Error ? error.message : 'Could not delete page');
    } finally {
      setDeleting(false); setReady(true); editor.setEditable(true);
    }
  }

  async function saveToProject() {
    if (!editor) return;
    const payload = { ...guide, ...buildDetails(guide), content: editor.getJSON(), updated: localDate() };
    setStatus('Saving to project…');
    try {
      const response = await fetch(`${API}/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Save failed');
      setGuide(payload);
      setKnownGuides((current) => [...current.filter((item) => item.slug !== payload.slug), payload]);
      setStatus('Saved to project. Commit and push in GitHub Desktop to publish.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not save'); }
  }

  async function pickImage(file?: File) {
    if (!file || !editor) return;
    try {
      const src = await uploadImage(file);
      editor.chain().focus().insertContent({ type: 'image', attrs: { src, alt: file.name.replace(/\.[^.]+$/, '') } }).run();
      setStatus('Image added. Save to project when ready.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Image upload failed'); }
  }

  function insert(node: JSONContent) { editor?.chain().focus().insertContent(node).run(); }
  const filteredGems = gems.filter((gem) => gem.name.toLowerCase().includes(query.toLowerCase())).slice(0, 35);

  function selectGem(gem: (typeof gems)[number]) {
    editor?.chain().focus().insertContent([{ type: 'gem', attrs: { name: gem.name, color: gem.color } }, { type: 'text', text: ' ' }]).run();
    setModal(null);
  }
  useEffect(() => {
    if (modal === 'gem') gemResults.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeGem, query, modal]);

  const guideOptions = [...new Map([...knownGuides, guide].map((item) => [item.slug, item])).values()];
  const optionLabel = (item: Guide) => {
    const sameTitle = guideOptions.filter((entry) => entry.title.trim().toLowerCase() === item.title.trim().toLowerCase()).length > 1;
    return sameTitle ? `${item.title} — /${item.slug}${initialGuides.some((saved) => saved.slug === item.slug) ? ' (project)' : ' (browser draft)'}` : item.title;
  };

  return <div className="editor-app">
    <div className="editor-controls">
    <div className="editor-topbar">
      <div className="editor-topbar-main"><div className="editor-select"><select aria-label="Choose guide or article" value={guide.slug} onChange={(event) => { const next = knownGuides.find((item) => item.slug === event.target.value); if (next) switchGuide(next); }}>{guideOptions.map((item) => <option key={item.slug} value={item.slug}>{optionLabel(item)}</option>)}</select><ChevronDown size={15} /></div><Button variant="ghost" onClick={() => setModal('new')}><Plus size={16} /> New content</Button></div>
      <div className="editor-topbar-actions"><span className="save-status">{draftState}</span><Button variant="secondary" disabled={!ready} onClick={downloadDraft}>Download draft</Button><Button variant="secondary" disabled={!ready} onClick={() => draftInput.current?.click()}>Import draft</Button><input ref={draftInput} type="file" accept=".json,application/json" hidden onChange={(event) => { void importDraft(event.target.files?.[0]); event.target.value = ''; }} /><Button className="ui-button-danger" variant="secondary" disabled={!localServer || !ready || deleting} onClick={() => setModal('delete')}>Delete page</Button><Button variant="primary" onClick={saveToProject} disabled={!localServer || deleting}><Save size={16} /> Save to project</Button></div>
    </div>
      <div className="editor-toolbar" role="toolbar" aria-label="Formatting and blocks" onMouseDown={(event) => { if ((event.target as Element).closest('button')) event.preventDefault(); }}>
        <button title="Heading 2" aria-label="Heading 2" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></button>
        <button title="Heading 3" aria-label="Heading 3" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 /></button>
        <button title="Bold (Ctrl+B)" aria-label="Bold" aria-pressed={editor?.isActive('bold') ?? false} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold /></button>
        <button title="Italic (Ctrl+I)" aria-label="Italic" aria-pressed={editor?.isActive('italic') ?? false} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic /></button>
        <button title="Underline (Ctrl+U)" aria-label="Underline" aria-pressed={editor?.isActive('underline') ?? false} onClick={() => editor?.chain().focus().toggleUnderline().run()}><Underline /></button>
        <button title="Text color" aria-label="Text color" onClick={() => { setTextColor(editor?.getAttributes('textStyle').color ?? '#b9bdc1'); setModal('color'); }}><span className="text-color-icon">A</span></button>
        <button title="Bullet list" aria-label="Bullet list" onClick={() => editor?.chain().focus().toggleBulletList().run()}><List /></button>
        <button title="Checklist" aria-label="Checklist" onClick={() => editor?.chain().focus().toggleTaskList().run()}><CheckSquare /></button>
        <span className="toolbar-divider" />
        <button title="Insert gem (@ or Ctrl+Shift+G)" aria-label="Insert gem" className="toolbar-gem" onClick={openGemPicker}>+ Gem</button>
        <button title="Gem links" aria-label="Gem links" onClick={() => insert({ type: 'gemSetup', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Link 1: ' }] }] })}><ListChecks /></button>
        <button className="toolbar-cost" title="Insert currency cost" aria-label="Insert currency cost" onClick={() => setModal('cost')}>Cost</button>
        <button className="toolbar-note" title="Callout" aria-label="Callout" onClick={() => insert({ type: 'callout', attrs: { tone: 'note' }, content: [{ type: 'paragraph' }] })}>Note</button>
        <button className="toolbar-important" title="Important block" aria-label="Important block" onClick={() => insert({ type: 'callout', attrs: { tone: 'important' }, content: [{ type: 'paragraph' }] })}>Important</button>
        <button title="Copyable regex" aria-label="Copyable regex" onClick={() => insert({ type: 'regex', attrs: { label: 'Regex', value: '' } })}><Code2 /></button>
        <button className="toolbar-pob" title="PoB links" aria-label="PoB links" onClick={() => insert({ type: 'pobLinks', attrs: { links: [{ label: '', url: '' }] } })}>PoB</button>
        <button title="Insert passive tree snapshot" aria-label="Insert passive tree snapshot" className="toolbar-tree" onClick={() => insert({ type: 'passiveTree', attrs: { snapshot: { version: guide.league.startsWith('3.28') ? '3.28.0' : '3.29.1', title: 'Passive tree', width: 480, height: 240 } } })}>Tree</button>
        <button title="Image" aria-label="Image" onClick={() => fileInput.current?.click()}><ImagePlus /></button>
        <button title="Link" aria-label="Link" onClick={() => { setUrl(editor?.getAttributes('link').href ?? ''); setModal('link'); }}><Link2 /></button>
        <span className="toolbar-divider" />
        <button title="Undo" aria-label="Undo" onClick={() => editor?.chain().focus().undo().run()}><Undo2 /></button>
        <button title="Redo" aria-label="Redo" onClick={() => editor?.chain().focus().redo().run()}><Redo2 /></button>
      </div>
    </div>
    <div className="editor-workspace"><div className="editor-utility"><span role="status" className={`editor-status ${localServer ? '' : 'offline'}`}>{status}</span><a href={`${BASE}${contentPath(guide)}`}>View page ↗</a><button className="discard-draft" type="button" onClick={discardDraft}>Discard local draft</button></div><div className="editor-page">
      <div className="editor-meta"><div className="block-eyebrow">{guide.kind === 'article' ? 'ARTICLE' : 'BUILD GUIDE'}</div><input className="editor-title" aria-label="Guide title" value={guide.title} onChange={(event) => setGuide({ ...guide, title: event.target.value })} placeholder="Build title" /><input className="editor-subtitle" aria-label="Guide summary" value={guide.subtitle} onChange={(event) => setGuide({ ...guide, subtitle: event.target.value })} placeholder="One sentence about this build" /><div className="meta-row"><label>Content type<select value={guide.kind ?? 'build'} onChange={(event) => setGuide({ ...guide, kind: event.target.value as 'build' | 'article' })}><option value="build">Build guide</option><option value="article">Article</option></select></label>{guide.kind !== 'article' && <><label>League number<input inputMode="decimal" value={buildDetails(guide).league} onChange={(event) => setGuide({ ...guide, ...buildDetails(guide), league: event.target.value })} placeholder="e.g. 3.28" /></label><label>Ascendancy<input value={buildDetails(guide).ascendancy} onChange={(event) => setGuide({ ...guide, ...buildDetails(guide), ascendancy: event.target.value })} placeholder="e.g. Chieftain" /></label></>}<label>Page address <input value={guide.slug} onChange={(event) => setGuide({ ...guide, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></label></div><TagInput tags={guide.tags ?? []} onChange={(tags) => setGuide((current) => ({ ...current, tags }))} /></div>
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => { void pickImage(event.target.files?.[0]); event.target.value = ''; }} />
      <EditorContent editor={editor} className="editor-document" />
    </div></div>
    <Dialog.Root open={modal !== null} onOpenChange={(open) => { if (!open && !deleting) setModal(null); }}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content" onOpenAutoFocus={(event) => { if (modal === 'gem') { event.preventDefault(); gemSearch.current?.focus(); } }} onCloseAutoFocus={(event) => { if (returnToWriting.current) { event.preventDefault(); returnToWriting.current = false; editor?.commands.focus(); } }}><Dialog.Close className="dialog-close" aria-label="Close" disabled={deleting}><X size={18} /></Dialog.Close>
      {modal === 'delete' && <><Dialog.Title>Delete this page?</Dialog.Title><Dialog.Description>This removes “{guide.title}” (/{guide.slug}) from your local project and this browser's drafts. The published page stays online until you push to GitHub. A recovery copy is kept in the project's .deleted-pages folder.</Dialog.Description><div className="text-color-actions"><Button variant="secondary" disabled={deleting} onClick={() => setModal(null)}>Cancel</Button><Button className="ui-button-danger" variant="secondary" disabled={deleting} onClick={() => void deletePage()}>{deleting ? 'Deleting…' : 'Delete page'}</Button></div></>}
      {modal === 'cost' && <><Dialog.Title>Insert currency cost</Dialog.Title><Dialog.Description>Choose a currency and amount. Insert beside a gem or in a total-cost line. You can edit the amount as normal text afterward.</Dialog.Description><div className="currency-presets" role="group" aria-label="Currency">{currencies.map((currency) => <button type="button" key={currency.src} aria-pressed={costCurrency.src === currency.src} onClick={() => setCostCurrency(currency)}><img src={assetUrl(currency.src)} alt="" />{currency.name}</button>)}</div><label htmlFor="cost-amount">Amount</label><input id="cost-amount" className="dialog-input" placeholder="1, 1–2, or 3+" value={costAmount} onChange={(event) => setCostAmount(event.target.value)} /><label className="currency-name-option"><input type="checkbox" checked={costShowName} onChange={(event) => setCostShowName(event.target.checked)} /> Include currency name</label><div className="currency-preview" aria-label="Cost preview">{costAmount} <img className="inline-icon" src={assetUrl(costCurrency.src)} alt={costCurrency.name} />{costShowName && <> {costCurrency.name}</>}</div><Button variant="primary" disabled={!costAmount.trim()} onClick={() => { editor?.chain().focus().insertContent([{ type: 'text', text: `${costAmount.trim()} ` }, { type: 'icon', attrs: { src: costCurrency.src, name: costCurrency.name } }, { type: 'text', text: costShowName ? ` ${costCurrency.name} ` : ' ' }]).run(); setModal(null); }}>Insert cost</Button></>}
      {modal === 'color' && <><Dialog.Title>Text color</Dialog.Title><Dialog.Description>Select text to recolor it, or choose a color for what you type next.</Dialog.Description><div className="text-color-presets" role="group" aria-label="Color presets">{[{ name: 'Red', color: '#ff6655' }, { name: 'Blue', color: '#58a6ff' }, { name: 'Green', color: '#65ed7f' }, { name: 'Unique', color: '#975b07' }].map((preset) => <button key={preset.name} type="button" style={{ color: preset.color }} onClick={() => { setTextColor(preset.color); editor?.chain().focus().setColor(preset.color).run(); setModal(null); }}><span style={{ backgroundColor: preset.color }} aria-hidden="true" />{preset.name}</button>)}</div><div className="text-color-picker"><label htmlFor="text-color">Choose a color</label><input id="text-color" type="color" value={validTextColor ? textColor.trim() : "#b9bdc1"} onChange={(event) => setTextColor(event.target.value)} /><label htmlFor="text-color-hex">Hex code</label><input id="text-color-hex" className="text-color-hex" type="text" placeholder="#975b07" spellCheck={false} value={textColor} aria-invalid={!validTextColor} onChange={(event) => setTextColor(event.target.value)} /></div><div className="text-color-actions"><Button variant="primary" disabled={!validTextColor} onClick={() => { editor?.chain().focus().setColor(textColor.trim()).run(); setModal(null); }}>Apply color</Button><Button variant="secondary" onClick={() => { editor?.chain().focus().unsetColor().run(); setModal(null); }}>Reset to default</Button></div></>}
      {modal === 'gem' && <><Dialog.Title>Insert a gem</Dialog.Title><Dialog.Description>Type to search. Use ↑/↓ to choose, Enter to insert, or Escape to cancel. Open while writing with @ or Ctrl+Shift+G.</Dialog.Description><input ref={gemSearch} autoFocus className="dialog-input" aria-label="Search gems" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="gem-search-results" aria-activedescendant={filteredGems.length ? `gem-result-${activeGem}` : undefined} placeholder="Search gems…" value={query} onChange={(event) => { setQuery(event.target.value); setActiveGem(0); }} onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (filteredGems.length) setActiveGem((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + filteredGems.length) % filteredGems.length);
        } else if (event.key === 'Enter') { event.preventDefault(); if (filteredGems[activeGem]) selectGem(filteredGems[activeGem]); }
      }} /><div ref={gemResults} id="gem-search-results" role="listbox" aria-label="Matching gems" className="gem-results">{filteredGems.map((gem, index) => <button id={`gem-result-${index}`} role="option" aria-selected={index === activeGem} key={gem.name} type="button" onMouseEnter={() => setActiveGem(index)} onClick={() => selectGem(gem)}><span className={`gem gem-${gem.color}`}>{gemDisplayName(gem.name)}</span></button>)}</div>{!filteredGems.length && <p role="status">No matching gems.</p>}</>}

      {modal === 'link' && <><Dialog.Title>Add a link</Dialog.Title><Dialog.Description>Apply a URL to selected text.</Dialog.Description><input autoFocus className="dialog-input" placeholder="https://…" value={url} onChange={(event) => setUrl(event.target.value)} /><Button variant="primary" onClick={() => { if (url.trim()) editor?.chain().focus().setLink({ href: url.trim() }).run(); else editor?.chain().focus().unsetLink().run(); setModal(null); }}>Apply link</Button></>}
      {modal === 'new' && <><Dialog.Title>New guide or article</Dialog.Title><Dialog.Description>Build guides start with a campaign outline. Articles start with a blank overview.</Dialog.Description><label htmlFor="new-content-kind">Content type</label><select id="new-content-kind" className="dialog-input" value={newKind} onChange={(event) => setNewKind(event.target.value as 'build' | 'article')}><option value="build">Build guide</option><option value="article">Article</option></select><input autoFocus className="dialog-input" placeholder="Title" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && newTitle.trim()) { const next = newGuide(newTitle.trim(), newKind); setKnownGuides((old) => [...old, next]); switchGuide(next); setNewTitle(''); setModal(null); } }} /><Button variant="primary" onClick={() => { if (!newTitle.trim()) return; const next = newGuide(newTitle.trim(), newKind); setKnownGuides((old) => [...old, next]); switchGuide(next); setNewTitle(''); setModal(null); }}>Create page</Button></>}
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}
