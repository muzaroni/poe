import type { JSONContent } from '@tiptap/core';
import { gemProgressionStages, inlineGemChanges, setupRows, setupGemReferences, type GemSetupBaseline, type GemChangeOverrides, type GemChangeChoice } from '../lib/gem-links';
import { gemDisplayName } from '../lib/gems';
export default function GemChangeControls({ content, baseline, value, onChange }: { content: JSONContent[]; baseline?: GemSetupBaseline | null; value?: GemChangeOverrides | null; onChange: (next: GemChangeOverrides | null) => void }) {
  if (!content.some(node => node.type === 'heading')) return <StageChangeControls content={content} baseline={gemProgressionStages(content, baseline, value)[0]?.baseline} value={value} onChange={onChange} />;
  return <>{gemProgressionStages(content, baseline, value).filter(stage => stage.baseline && setupRows(stage.content).length).map(stage => <div key={stage.key} contentEditable={false}><strong className="gem-stage-control-title">{stage.title}</strong><StageChangeControls content={stage.content} baseline={stage.baseline} value={stage.overrides} partial onChange={next => {
    const stages = { ...value?.stages }; if (next) stages[stage.key] = next; else delete stages[stage.key];
    onChange({ ...value, stages });
  }} /></div>)}</>;
}
function StageChangeControls({ content, baseline, value, onChange, partial = false }: { content: JSONContent[]; baseline?: GemSetupBaseline | null; value?: GemChangeOverrides | null; onChange: (next: GemChangeOverrides | null) => void; partial?: boolean }) {
  if (!baseline || !Array.isArray(baseline.content)) return null;
  const current = setupGemReferences(content), previous = setupGemReferences(baseline.content);
  const choices = value?.current ?? {}, removedChoices = value?.removed ?? {};
  const currentRows = setupRows(content);
  const auto = inlineGemChanges(content, baseline.content);
  const raw = inlineGemChanges(content, baseline.content, { current: choices });
  const removed = [...raw.rows.values()].flatMap(row => row.removed).concat(partial ? [] : raw.removedSetups.flatMap(row => row.gems));
  const currentRefs = new Set(current.map(entry => entry.ref));
  const overrideCount = current.filter(entry => choices[entry.ref]).length + removed.filter(gem => removedChoices[gem.ref!]).length;
  function setChoice(ref: string, encoded: string) {
    const next = { ...choices };
    if (encoded === 'auto') delete next[ref];
    else if (encoded === 'new' || encoded === 'none') next[ref] = { kind: encoded };
    else next[ref] = { kind: encoded.startsWith('swap:') ? 'swap' : 'moved', from: encoded.slice(encoded.indexOf(':') + 1) };
    onChange({ current: next, removed: removedChoices });
  }
  function selected(choice?: GemChangeChoice) { return !choice ? 'auto' : choice.kind === 'new' || choice.kind === 'none' ? choice.kind : `${choice.kind}:${choice.from}`; }
  return <details className="gem-manual-changes" contentEditable={false}><summary>Change badges{overrideCount ? ` · ${overrideCount} manual` : ' · Automatic'}</summary>
    <p>Choose NEW to keep an addition separate from a removal. Choose SWAP and the exact old gem to pair them. Choices are saved with this setup.</p>
    <div className="gem-manual-grid">{current.map((entry, index) => {
      const row = currentRows.find(row => row.key === entry.rowKey);
      const hint = row ? auto.rows.get(row.paragraph)?.gems[entry.index] : undefined;
      const autoLabel = hint?.movedFrom ? `MOVED from ${hint.movedFrom}` : hint?.replaces ? `SWAP ← ${gemDisplayName(hint.replaces.name)}` : hint?.added ? 'NEW' : 'No badge';
      const encoded = selected(choices[entry.ref]);
      const missingSource = choices[entry.ref] && 'from' in choices[entry.ref] && !previous.some(old => old.ref === (choices[entry.ref] as { from: string }).from);
      return <label key={entry.ref}><span>{entry.title} · <span className={`gem gem-${entry.gem.color}`}>{gemDisplayName(entry.gem.name)}</span>{entry.gem.annotation && ` ${entry.gem.annotation}`}</span><select aria-label={`Change badge ${index + 1}: ${entry.title} ${gemDisplayName(entry.gem.name)}`} value={encoded} onChange={event => setChoice(entry.ref, event.target.value)}>
        <option value="auto">Automatic — {autoLabel}</option><option value="new">NEW — separate addition</option><option value="none">No badge</option>
        {missingSource && <option value={encoded}>Source missing — automatic until updated</option>}
        {previous.map(old => {
          const claimed = Object.entries(choices).some(([ref, choice]) => currentRefs.has(ref) && ref !== entry.ref && 'from' in choice && choice.from === old.ref);
          return <option key={`swap-${old.ref}`} value={`swap:${old.ref}`} disabled={claimed}>SWAP ← {old.title}: {gemDisplayName(old.gem.name)}{old.gem.annotation && ` ${old.gem.annotation}`}{claimed ? ' (already paired)' : ''}</option>;
        })}
        {previous.filter(old => old.gem.name.toLowerCase() === entry.gem.name.toLowerCase() && old.rowKey !== entry.rowKey).map(old => <option key={`moved-${old.ref}`} value={`moved:${old.ref}`} disabled={Object.entries(choices).some(([ref, choice]) => currentRefs.has(ref) && ref !== entry.ref && 'from' in choice && choice.from === old.ref)}>MOVED from {old.title}</option>)}
      </select></label>;
    })}</div>
    {!!removed.length && <div className="gem-manual-removals"><strong>Removed gems</strong>{removed.map(gem => <label key={gem.ref}><span>{previous.find(entry => entry.ref === gem.ref)?.title} · {gemDisplayName(gem.name)}{gem.annotation && ` ${gem.annotation}`}</span><select aria-label={`Removal badge: ${gemDisplayName(gem.name)}`} value={removedChoices[gem.ref!] ?? 'auto'} onChange={event => { const next = { ...removedChoices }; if (event.target.value === 'hide') next[gem.ref!] = 'hide'; else delete next[gem.ref!]; onChange({ current: choices, removed: next }); }}><option value="auto">REMOVED</option><option value="hide">Hide badge and old entry</option></select></label>)}</div>}
    {overrideCount > 0 && <button type="button" onClick={() => onChange(null)}>Reset all to automatic</button>}
  </details>;
}
