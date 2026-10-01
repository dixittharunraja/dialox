import type { EntryPatch, MailEntry, MailQuery } from '@dialox/shared';
import {
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Mail,
  MailOpen,
  OctagonAlert,
  Paperclip,
  RotateCw,
  Star,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { shortTime, useDisplayName } from '@/lib/format';
import { useDeleteForever, useMailList, usePatchEntries, useRefreshMail } from '@/lib/queries';
import { LabelChips, LabelMenu, SnoozeMenu } from './actions';
import { GmIconButton } from './widgets';

const PAGE_SIZE = 50;

function useEntryActions(view: MailQuery['view']) {
  const patch = usePatchEntries();
  const deleteForever = useDeleteForever();
  const update = (ids: string[], change: EntryPatch) => patch.mutate({ ids, patch: change });
  return {
    update,
    trash: (ids: string[]) => (view === 'trash' ? deleteForever.mutate(ids) : update(ids, { folder: 'trash' })),
  };
}

function Row({
  entry,
  view,
  selected,
  onSelect,
  onOpen,
}: {
  entry: MailEntry;
  view: MailQuery['view'];
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const displayName = useDisplayName();
  const actions = useEntryActions(view);
  const unread = !entry.isRead && !entry.outgoing;
  const who = entry.outgoing ? `To: ${entry.to.map((a) => displayName(a)).join(', ')}` : displayName(entry.from);
  return (
    <li
      onClick={onOpen}
      className={`group relative flex h-10 cursor-pointer items-center gap-1 border-b border-gm-line pr-4 pl-2 text-sm hover:z-10 hover:shadow-[inset_1px_0_0_#dadce0,inset_-1px_0_0_#dadce0,0_1px_2px_0_rgba(60,64,67,.3)] ${
        selected ? 'bg-gm-active' : unread ? 'bg-gm-unread' : 'bg-gm-bg/60'
      }`}
    >
      <input
        type="checkbox"
        aria-label="Select"
        checked={selected}
        onClick={(e) => e.stopPropagation()}
        onChange={onSelect}
        className="mx-2.5 h-4 w-4 shrink-0"
      />
      <button
        type="button"
        aria-label={entry.isStarred ? 'Starred' : 'Not starred'}
        onClick={(e) => {
          e.stopPropagation();
          actions.update([entry.id], { isStarred: !entry.isStarred });
        }}
        className={`shrink-0 p-1.5 ${entry.isStarred ? 'text-[#f4b400]' : 'text-gm-muted'}`}
      >
        <Star size={18} className={entry.isStarred ? 'fill-current' : ''} />
      </button>
      <span className={`w-44 shrink-0 truncate pl-1 max-md:w-28 ${unread ? 'font-bold' : ''}`}>
        {who}
        {entry.threadCount > 1 && <span className="text-gm-muted"> ({entry.threadCount})</span>}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <LabelChips ids={entry.labelIds} />
        <span className={`truncate ${unread ? 'font-bold' : ''}`}>{entry.subject || '(no subject)'}</span>
        <span className="truncate text-gm-muted">- {entry.snippet}</span>
      </span>
      {entry.attachments.length > 0 && <Paperclip size={16} className="shrink-0 text-gm-muted" />}
      <span
        className={`w-20 shrink-0 text-right text-xs group-hover:invisible ${unread ? 'font-bold' : 'text-gm-muted'}`}
      >
        {shortTime(entry.createdAt, navigator.language, 'Yesterday')}
      </span>
      <span className="absolute right-3 hidden items-center group-hover:flex" onClick={(e) => e.stopPropagation()}>
        <GmIconButton
          icon={Trash2}
          label={view === 'trash' ? 'Delete forever' : 'Delete'}
          size={18}
          onClick={() => actions.trash([entry.id])}
        />
        <GmIconButton
          icon={entry.isRead ? Mail : MailOpen}
          label={entry.isRead ? 'Mark as unread' : 'Mark as read'}
          size={18}
          onClick={() => actions.update([entry.id], { isRead: !entry.isRead })}
        />
      </span>
    </li>
  );
}

export function MailList({ query }: { query: MailQuery }) {
  const [params, setParams] = useSearchParams();
  const { data, isFetching } = useMailList(query);
  const refresh = useRefreshMail();
  const actions = useEntryActions(query.view);
  const [selected, setSelected] = useState<string[]>([]);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const page = Number(query.page ?? 1);
  const allSelected = items.length > 0 && selected.length === items.length;
  const view = query.labelId ? 'label' : query.view;

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  const bulk = (change: EntryPatch) => {
    actions.update(selected, change);
    setSelected([]);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-1 px-2">
        <input
          type="checkbox"
          aria-label="Select all"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = selected.length > 0 && !allSelected;
          }}
          onChange={() => setSelected(allSelected ? [] : items.map((i) => i.id))}
          className="mx-2.5 h-4 w-4"
        />
        {selected.length === 0 ? (
          <GmIconButton
            icon={RotateCw}
            label="Refresh"
            className={isFetching ? 'animate-spin' : ''}
            onClick={() => void refresh()}
          />
        ) : (
          <>
            {view === 'spam' || view === 'trash' ? (
              <GmIconButton
                icon={ArchiveRestore}
                label={view === 'spam' ? 'Not spam' : 'Move to Inbox'}
                onClick={() => bulk({ folder: 'inbox' })}
              />
            ) : (
              <GmIconButton icon={OctagonAlert} label="Report spam" onClick={() => bulk({ folder: 'spam' })} />
            )}
            <GmIconButton
              icon={Trash2}
              label={view === 'trash' ? 'Delete forever' : 'Delete'}
              onClick={() => {
                actions.trash(selected);
                setSelected([]);
              }}
            />
            <GmIconButton icon={MailOpen} label="Mark as read" onClick={() => bulk({ isRead: true })} />
            <GmIconButton icon={Mail} label="Mark as unread" onClick={() => bulk({ isRead: false })} />
            <SnoozeMenu ids={selected} snoozed={view === 'snoozed'} onDone={() => setSelected([])} />
            <LabelMenu ids={selected} current={items.find((i) => i.id === selected[0])?.labelIds ?? []} />
          </>
        )}
        <div className="ml-auto flex items-center gap-1 text-xs text-gm-muted">
          {total > 0 && `${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, total)} of ${total}`}
          <GmIconButton
            icon={ChevronLeft}
            label="Newer"
            onClick={() => page > 1 && setParam('page', String(page - 1))}
          />
          <GmIconButton
            icon={ChevronRight}
            label="Older"
            onClick={() => page * PAGE_SIZE < total && setParam('page', String(page + 1))}
          />
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {items.map((entry) => (
          <Row
            key={entry.id}
            entry={entry}
            view={query.view}
            selected={selected.includes(entry.id)}
            onSelect={() =>
              setSelected(
                selected.includes(entry.id) ? selected.filter((id) => id !== entry.id) : [...selected, entry.id],
              )
            }
            onOpen={() => setParam('open', entry.id)}
          />
        ))}
        {!items.length && !isFetching && (
          <li className="flex flex-col items-center gap-3 py-24 text-gm-muted">
            <Inbox size={48} strokeWidth={1.2} />
            {query.q || query.from || query.subject ? 'No messages matched your search.' : 'Nothing here yet.'}
          </li>
        )}
      </ul>
    </div>
  );
}
