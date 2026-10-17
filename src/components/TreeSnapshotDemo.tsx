import { useEffect, useRef, useState } from 'react';
import TreeBlock, { TreePicker } from './TreeBlock';
import { normalizeSnapshot, type TreeSnapshotData } from '../lib/tree-snapshot';

function SnapshotEditor({ snapshot, previousSnapshot, previousSnapshots, onChange }: { snapshot: TreeSnapshotData; previousSnapshot?: TreeSnapshotData; previousSnapshots?: TreeSnapshotData[]; onChange: (value: TreeSnapshotData) => void }) {
  const [editing, setEditing] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (editing) dialog.current?.showModal(); else dialog.current?.close(); }, [editing]);
  return <>
    <button className="snapshot-demo-edit" type="button" onClick={() => setEditing(true)}>Edit {snapshot.title}</button>
    <TreeBlock snapshot={snapshot} />
    <dialog ref={dialog} className="tree-block-dialog" aria-label="Edit demo snapshot" onCancel={event => { event.preventDefault(); setEditing(false); }} onClick={event => { if (event.target === dialog.current) setEditing(false); }}><div>{editing && <TreePicker snapshot={snapshot} previousSnapshot={previousSnapshot} previousSnapshots={previousSnapshots} onApply={value => { onChange(value); setEditing(false); }} onCancel={() => setEditing(false)} />}</div></dialog>
  </>;
}

export default function TreeSnapshotDemo({ initial, respecBefore, respecAfter }: { initial: TreeSnapshotData; respecBefore?: TreeSnapshotData; respecAfter?: TreeSnapshotData }) {
  const [respecDemo, setRespecDemo] = useState(respecAfter);
  const [first, setFirst] = useState(initial);
  const [second, setSecond] = useState(() => normalizeSnapshot({ ...initial, title: 'Act 2 Tree', nodes: [], inheritedNodes: [], mastery: {}, markers: [], frame: null }));
  const [third, setThird] = useState(() => normalizeSnapshot({ ...initial, title: 'Act 3 Tree', nodes: [], inheritedNodes: [], mastery: {}, markers: [], frame: null }));
  return <>
    <SnapshotEditor snapshot={first} onChange={setFirst} />
    <h2>Act 2 progression</h2>
    <p>Choose an earlier tree in Continue from, then click Continue to carry its paths into this act.</p>
    <SnapshotEditor snapshot={second} previousSnapshot={first} onChange={setSecond} />
    <h2>Act 3 progression</h2>
    <p>The source dropdown includes every earlier tree with allocated nodes.</p>
    <SnapshotEditor snapshot={third} previousSnapshots={[first, second].filter(tree => tree.nodes.length > 0)} onChange={setThird} />
    {respecDemo && respecBefore && <><h2>Respec example</h2><p>Red dashed paths are refunded; green paths are added. Open the picker to edit the After tree and refund note.</p><SnapshotEditor snapshot={respecDemo} previousSnapshot={respecBefore} onChange={setRespecDemo} /></>}
  </>;
}
