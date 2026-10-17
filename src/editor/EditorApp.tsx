import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import * as Dialog from '@radix-ui/react-dialog';
import { Bold, CheckSquare, ChevronDown, Code2, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListChecks, Plus, Redo2, Save, Undo2, X } from 'lucide-react';
import type { JSONContent } from '@tiptap/core';
import { Button } from '../components/ui/Button';
import { deleteDraft, listDrafts, saveDraft } from './drafts';
import { Callout, Gem, GemSetup, GuideImage, Icon, PobLinks, Regex } from './extensions';
import gems from '../data/gems.json';
import type { Guide } from '../types';
import './editor.css';

const API = 'http://127.0.0.1:4322';
const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/`;
const localDate = () => { const day = new Date(); return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`; };
type Modal = 'gem' | 'link' | 'new' | null;

function newGuide(title: string): Guide {
  const slug = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 70) || 'new-build';
  const sections = ['Overview', 'PoB Links', 'Leveling', ...Array.from({ length: 10 }, (_, i) => `Act ${i + 1} Progression`), 'Transition', 'Endgame'];
  return { slug, title, subtitle: '', league: '', updated: localDate(), content: { type: 'doc', content: sections.flatMap((section) => [
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
  const [query, setQuery] = useState('');
  const [url, setUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [status, setStatus] = useState('Checking local editor…');
  const [localServer, setLocalServer] = useState(false);
  const [draftState, setDraftState] = useState('');
  const [ready, setReady] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
      GuideImage,
      Placeholder.configure({ placeholder: 'Write your guide here…' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Gem, Icon, Regex, PobLinks, GemSetup, Callout,
    ],
    content: guide.content,
    editorProps: {
      attributes: { class: 'tiptap guide-content' },
      handlePaste: (_view, event) => {
        const image = Array.from(event.clipboardData?.files ?? []).find((file) => file.type.startsWith('image/'));
        if (!image) return false;
        void uploadImage(image).then((src) => editor?.chain().focus().insertContent({ type: 'image', attrs: { src, alt: image.name } }).run()).catch((error) => setStatus(error.message));
        return true;
      },
    },
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
      const merged = [...initialGuides.filter((saved) => !drafts.some((draft) => draft.slug === saved.slug)), ...drafts];
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
      saveDraft(guide).then(() => setDraftState('Draft saved automatically')).catch(() => setDraftState('Draft storage unavailable'));
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [guide, ready]);

  function switchGuide(next: Guide) {
    setGuide(next);
    editor?.commands.setContent(next.content, { emitUpdate: false });
    try { localStorage.setItem('poe-active-guide', next.slug); } catch { /* private browsing */ }
    setDraftState('');
  }

  async function discardDraft() {
    await deleteDraft(guide.slug);
    const saved = initialGuides.find((item) => item.slug === guide.slug);
    const next = saved ?? initialGuides[0] ?? newGuide('New build');
    setKnownGuides((current) => current.filter((item) => item.slug !== guide.slug || item.slug === saved?.slug));
    switchGuide(next);
    setStatus(saved ? 'Loaded project version' : 'Removed unsaved guide');
  }

  async function saveToProject() {
    if (!editor) return;
    const payload = { ...guide, content: editor.getJSON(), updated: localDate() };
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

  return <div className="editor-app">
    <div className="editor-topbar">
      <div className="editor-topbar-main"><div className="editor-select"><select aria-label="Choose build" value={guide.slug} onChange={(event) => { const next = knownGuides.find((item) => item.slug === event.target.value); if (next) switchGuide(next); }}><option value={guide.slug}>{guide.title}</option>{knownGuides.filter((item) => item.slug !== guide.slug).map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}</select><ChevronDown size={15} /></div><Button variant="ghost" onClick={() => setModal('new')}><Plus size={16} /> New build</Button></div>
      <div className="editor-topbar-actions"><span className="save-status">{draftState}</span><Button variant="primary" onClick={saveToProject} disabled={!localServer}><Save size={16} /> Save to project</Button></div>
    </div>
    <div className="editor-workspace"><div className="editor-page">
      <div className="editor-meta"><div className="block-eyebrow">BUILD GUIDE</div><input className="editor-title" aria-label="Guide title" value={guide.title} onChange={(event) => setGuide({ ...guide, title: event.target.value })} placeholder="Build title" /><input className="editor-subtitle" aria-label="Guide summary" value={guide.subtitle} onChange={(event) => setGuide({ ...guide, subtitle: event.target.value })} placeholder="One sentence about this build" /><div className="meta-row"><label>League <input value={guide.league} onChange={(event) => setGuide({ ...guide, league: event.target.value })} placeholder="3.28 · Chieftain" /></label><label>Page address <input value={guide.slug} onChange={(event) => setGuide({ ...guide, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></label></div></div>
      <div className="editor-toolbar" role="toolbar" aria-label="Formatting and blocks">
        <button title="Heading 2" aria-label="Heading 2" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></button>
        <button title="Heading 3" aria-label="Heading 3" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 /></button>
        <button title="Bold" aria-label="Bold" onClick={() => editor?.chain().focus().toggleBold().run()}><Bold /></button>
        <button title="Italic" aria-label="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic /></button>
        <button title="Bullet list" aria-label="Bullet list" onClick={() => editor?.chain().focus().toggleBulletList().run()}><List /></button>
        <button title="Checklist" aria-label="Checklist" onClick={() => editor?.chain().focus().toggleTaskList().run()}><CheckSquare /></button>
        <span className="toolbar-divider" />
        <button title="Insert gem" aria-label="Insert gem" className="toolbar-gem" onClick={() => { setQuery(''); setModal('gem'); }}>+ Gem</button>
        <button title="Gem setup" aria-label="Gem setup" onClick={() => insert({ type: 'gemSetup', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Link 1: ' }] }] })}><ListChecks /></button>
        <button title="Callout" aria-label="Callout" onClick={() => insert({ type: 'callout', attrs: { tone: 'note' }, content: [{ type: 'paragraph' }] })}>Note</button>
        <button title="Copyable regex" aria-label="Copyable regex" onClick={() => insert({ type: 'regex', attrs: { label: 'Regex', value: '' } })}><Code2 /></button>
        <button title="PoB links" aria-label="PoB links" onClick={() => insert({ type: 'pobLinks', attrs: { links: [{ label: '', url: '' }] } })}>PoB</button>
        <button title="Image" aria-label="Image" onClick={() => fileInput.current?.click()}><ImagePlus /></button>
        <button title="Link" aria-label="Link" onClick={() => { setUrl(editor?.getAttributes('link').href ?? ''); setModal('link'); }}><Link2 /></button>
        <span className="toolbar-divider" />
        <button title="Undo" aria-label="Undo" onClick={() => editor?.chain().focus().undo().run()}><Undo2 /></button>
        <button title="Redo" aria-label="Redo" onClick={() => editor?.chain().focus().redo().run()}><Redo2 /></button>
      </div>
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => { void pickImage(event.target.files?.[0]); event.target.value = ''; }} />
      <EditorContent editor={editor} className="editor-document" />
    </div><aside className="editor-help"><div className="block-eyebrow">WRITING GUIDE</div><h2>Everything in one place.</h2><p>Click into the page and write normally. Use the toolbar to add gems, checklists, screenshots, regex, and PoB links.</p><div className="help-step"><span>01</span><div><strong>Drafts save as you write</strong><p>Your browser keeps a local copy automatically.</p></div></div><div className="help-step"><span>02</span><div><strong>Save to project</strong><p>Writes your guide and images into this repository.</p></div></div><div className="help-step"><span>03</span><div><strong>Publish</strong><p>Commit and push in GitHub Desktop. GitHub Pages updates after the build finishes.</p></div></div><div className={`editor-status ${localServer ? '' : 'offline'}`}>{status}</div><a href={`${BASE}builds/${guide.slug}/`}>View published guide ↗</a><button className="discard-draft" type="button" onClick={discardDraft}>Discard local draft</button></aside></div>
    <Dialog.Root open={modal !== null} onOpenChange={(open) => { if (!open) setModal(null); }}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content"><Dialog.Close className="dialog-close" aria-label="Close"><X size={18} /></Dialog.Close>
      {modal === 'gem' && <><Dialog.Title>Insert a gem</Dialog.Title><Dialog.Description>Search by name. The correct socket color is applied automatically.</Dialog.Description><input autoFocus className="dialog-input" placeholder="Search 900+ gems…" value={query} onChange={(event) => setQuery(event.target.value)} /><div className="gem-results">{filteredGems.map((gem) => <button key={gem.name} type="button" onClick={() => { insert({ type: 'gem', attrs: { name: gem.name, color: gem.color } }); setModal(null); }}><span className={`gem gem-${gem.color}`}>{gem.name}</span></button>)}</div></>}
      {modal === 'link' && <><Dialog.Title>Add a link</Dialog.Title><Dialog.Description>Apply a URL to selected text.</Dialog.Description><input autoFocus className="dialog-input" placeholder="https://…" value={url} onChange={(event) => setUrl(event.target.value)} /><Button variant="primary" onClick={() => { if (url.trim()) editor?.chain().focus().setLink({ href: url.trim() }).run(); else editor?.chain().focus().unsetLink().run(); setModal(null); }}>Apply link</Button></>}
      {modal === 'new' && <><Dialog.Title>New build guide</Dialog.Title><Dialog.Description>Creates the full outline from leveling through endgame.</Dialog.Description><input autoFocus className="dialog-input" placeholder="Build title" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && newTitle.trim()) { const next = newGuide(newTitle.trim()); setKnownGuides((old) => [...old, next]); switchGuide(next); setNewTitle(''); setModal(null); } }} /><Button variant="primary" onClick={() => { if (!newTitle.trim()) return; const next = newGuide(newTitle.trim()); setKnownGuides((old) => [...old, next]); switchGuide(next); setNewTitle(''); setModal(null); }}>Create build</Button></>}
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}
