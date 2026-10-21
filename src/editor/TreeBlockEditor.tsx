import { createPortal } from 'react-dom';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import TreeBlock, { TreePicker } from '../components/TreeBlock';
import { normalizeSnapshot } from '../lib/tree-snapshot';
import { guideAscendancySnapshots, guideGemProgressionByAct, guideRegexes } from '../lib/campaign';

export default function TreeBlockEditor({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const snapshot = useMemo(() => normalizeSnapshot(node.attrs.snapshot ?? {}), [node.attrs.snapshot]);
  const [editing, setEditing] = useState(false);
  const [guideGemLinks, setGuideGemLinks] = useState(() => guideGemProgressionByAct(editor.getJSON()));
  const [guideRegex, setGuideRegex] = useState(() => guideRegexes(editor.getJSON()));
  const [guideAscendancy, setGuideAscendancy] = useState(() => guideAscendancySnapshots(editor.getJSON()));
  const dialog = useRef<HTMLDialogElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (editing) dialog.current?.showModal();
    else if (dialog.current?.open) { dialog.current.close(); editButton.current?.focus(); }
  }, [editing]);
  useEffect(() => {
    const update = () => { const document = editor.getJSON(); setGuideGemLinks(guideGemProgressionByAct(document)); setGuideRegex(guideRegexes(document)); setGuideAscendancy(guideAscendancySnapshots(document)); };
    editor.on('update', update);
    return () => { editor.off('update', update); };
  }, [editor]);
  const previousSnapshots: ReturnType<typeof normalizeSnapshot>[] = [];
  const position = getPos();
  editor.state.doc.descendants((candidate, pos) => {
    if (typeof position === 'number' && pos >= position) return false;
    if (candidate.type.name === 'passiveTree' && candidate.attrs.snapshot?.nodes?.length) previousSnapshots.push(normalizeSnapshot(candidate.attrs.snapshot));
  });
  return <NodeViewWrapper className="tree-block-editor" contentEditable={false}>
    <div className="tree-block-editor-bar"><span>PASSIVE TREE</span><button ref={editButton} type="button" onClick={() => setEditing(true)}>{snapshot.nodes.length ? 'Edit tree snapshot' : 'Choose nodes & steps'}</button></div>
    <TreeBlock snapshot={snapshot} guideGemLinks={guideGemLinks} guideRegexes={guideRegex} guideAscendancy={guideAscendancy} guideCharacterAscendancy={editor.view.dom.dataset.guideAscendancy ?? ''} guideLeague={editor.view.dom.dataset.guideLeague ?? ''} guideSlug={editor.view.dom.dataset.guideSlug ?? ''} />
    {typeof document !== 'undefined' && createPortal(<dialog ref={dialog} className="tree-block-dialog" aria-label="Edit tree snapshot" onCancel={event => { event.preventDefault(); event.stopPropagation(); setEditing(false); }} onClick={event => { if (event.target === dialog.current) setEditing(false); }}><div>{editing && <TreePicker snapshot={snapshot} previousSnapshots={previousSnapshots} guideGemLinks={guideGemLinks} onApply={value => { updateAttributes({ snapshot: value }); setEditing(false); }} onCancel={() => setEditing(false)} />}</div></dialog>, document.body)}
  </NodeViewWrapper>;
}
