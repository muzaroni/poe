import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/core';
import { gemProgressionStages, type GemChangeOverrides, type GemSetupBaseline, type InlineSetupChanges } from '../lib/gem-links';
import GemChangeBadge from './GemChangeBadge';
import { gemDisplayName } from '../lib/gems';
const GemChangesContext = createContext<Map<JSONContent, InlineSetupChanges> | null>(null);
export function useGemRowChanges(node: JSONContent) { return useContext(GemChangesContext)?.get(node); }
export function GemSetupComparison({ content, baseline, overrides, children }: { content: JSONContent[]; baseline?: GemSetupBaseline | null; overrides?: GemChangeOverrides | null; children: ReactNode }) {
  const rows = useMemo(() => new Map(gemProgressionStages(content, baseline, overrides).flatMap(stage => [...(stage.changes?.rows ?? [])])), [content, baseline, overrides]);
  return <GemChangesContext.Provider value={rows}>{children}</GemChangesContext.Provider>;
}
export default function GemSetupChanges({ content, baseline, overrides }: { overrides?: GemChangeOverrides | null; content: JSONContent[]; baseline?: GemSetupBaseline | null }) {
  const removedSetups = gemProgressionStages(content, baseline, overrides).flatMap(stage => stage.changes?.removedSetups ?? []);
  const removed = removedSetups.filter(row => row.gems.length > 0);
  if (!removed.length) return null;
  return <div className="gem-removed-setups" aria-label="Removed gem setups">{removed.map(row => <div key={row.key}><strong>{row.title}:</strong>
    {row.gems.map((gem, index) => <p key={`removed-${index}`}>{gemDisplayName(gem.name)}{gem.annotation && ` ${gem.annotation}`}<GemChangeBadge kind="removed" /></p>)}

  </div>)}</div>;
}
