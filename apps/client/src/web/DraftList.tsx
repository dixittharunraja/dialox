import { File, Trash2 } from 'lucide-react';
import { shortTime, useDisplayName } from '@/lib/format';
import { useDeleteDraft, useDrafts } from '@/lib/queries';
import { useShell } from './WebApp';
import { GmIconButton } from './widgets';

export function DraftList() {
  const { data: drafts = [] } = useDrafts();
  const remove = useDeleteDraft();
  const displayName = useDisplayName();
  const { openCompose } = useShell();

  if (!drafts.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-gm-muted">
        <File size={48} strokeWidth={1.2} />
        You don&apos;t have any saved drafts.
      </div>
    );
  }
  return (
    <ul className="h-full overflow-y-auto pt-2">
      {drafts.map((draft) => (
        <li
          key={draft.id}
          onClick={() => openCompose({ draftId: draft.id })}
          className="group flex h-10 cursor-pointer items-center gap-3 border-b border-gm-line px-5 text-sm hover:shadow-sm"
        >
          <span className="w-44 shrink-0 truncate text-[#d93025]">
            Draft <span className="text-gm-text">{draft.to.map((a) => displayName(a)).join(', ')}</span>
          </span>
          <span className="min-w-0 flex-1 truncate">
            {draft.subject || '(no subject)'} <span className="text-gm-muted">- {draft.text}</span>
          </span>
          <span className="w-20 shrink-0 text-right text-xs text-gm-muted group-hover:hidden">
            {shortTime(draft.updatedAt, navigator.language, 'Yesterday')}
          </span>
          <span className="hidden group-hover:block" onClick={(e) => e.stopPropagation()}>
            <GmIconButton icon={Trash2} label="Discard draft" size={18} onClick={() => remove.mutate(draft.id)} />
          </span>
        </li>
      ))}
    </ul>
  );
}
