import { useState } from 'react';
import { normalizeTags } from '../lib/search';

export default function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [value, setValue] = useState('');
  function add() { if (value.trim()) onChange(normalizeTags([...tags, ...value.split(',')])); setValue(''); }
  return <div className="editor-tags"><label htmlFor="guide-tags">Tags</label><div className="content-tags">{tags.map((tag) => <button key={tag} type="button" onClick={() => onChange(tags.filter((item) => item !== tag))} aria-label={`Remove tag ${tag}`}>{tag} ×</button>)}</div><div className="tag-entry"><input id="guide-tags" value={value} placeholder="e.g. chieftain, league starter" onChange={(event) => setValue(event.target.value)} onBlur={add} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(); } }} /><button type="button" onClick={add}>Add tag</button></div><p>Press Enter or comma to add a tag. Save to project to include changes in search.</p></div>;
}
