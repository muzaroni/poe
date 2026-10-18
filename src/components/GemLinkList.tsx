import type { JSONContent } from '@tiptap/core';
import type { ReactNode } from 'react';

import GemChangeBadge from './GemChangeBadge';
import { useGemRowChanges } from './GemSetupChanges';
import { gemDisplayName } from '../lib/gems';
import { gemLinkGroups, gemSocketOptions } from '../lib/gem-links';
export { gemLinkGroups } from '../lib/gem-links';

export default function GemLinkList({ node, renderInline }: { node: JSONContent; renderInline: (node: JSONContent, index: number) => ReactNode }) {
  const changes = useGemRowChanges(node);
  let gemIndex = 0;
  const setup = gemLinkGroups(node);
  if (!setup) return null;
  const maxLinks = Math.max(...setup.groups.map((group) => group.length));
  return <div className="gem-link-list">
    <div className="gem-link-heading"><span>{setup.title}{changes?.linksChanged && <span className="gem-inline-link-change" title="Same gems, different linking from the previous setup"> · links changed</span>}</span><small>{maxLinks > 1 ? `${maxLinks}-link` : 'No links needed'}</small></div>
    {setup.groups.map((group, groupIndex) => <ul key={groupIndex} className={`gem-link-group ${group.length > 1 ? 'is-linked' : ''}`} aria-label={group.length > 1 ? 'Linked gems' : 'Independent gem'}>
      {group.map((row, rowIndex) => {
        return <li key={rowIndex}><span className={`gem-link-dot gem-${row.find(item => item.type === 'gem')?.attrs?.color ?? 'red'}`} aria-hidden="true" /><span>{gemSocketOptions(row).map((option, optionIndex) => <span key={optionIndex}>{optionIndex > 0 && <span className="gem-link-or"> or </span>}{option.map((item, index) => {
          const hint = item.type === 'gem' ? changes?.gems[gemIndex++] : undefined;
          return <span key={index}>{renderInline(item, index)}{hint?.added && <GemChangeBadge kind="new" />}{hint?.movedFrom && <GemChangeBadge kind="moved" title={`Moved from ${hint.movedFrom}`} />}{hint?.replaces && <span className="gem-inline-replaced" title="Replaces this gem from the previous setup"><GemChangeBadge kind="swap" /> ← {gemDisplayName(hint.replaces.name)}{hint.replaces.annotation && ` ${hint.replaces.annotation}`}</span>}</span>;
        })}</span>)}</span></li>;
      })}
    </ul>)}
    {!!changes?.removed.length && <div className="gem-link-removed" aria-label="Removed gems">
      {changes.removed.map((gem, index) => <div key={`removed-${index}`}>{gemDisplayName(gem.name)}{gem.annotation && ` ${gem.annotation}`}<GemChangeBadge kind="removed" /></div>)}

    </div>}

  </div>;
}
