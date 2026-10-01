import type { EntryPatch } from '@dialox/shared';
import { ArchiveRestore, MailOpen, OctagonAlert, Reply, Star, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Avatar } from '@/components/Avatar';
import { AttachmentList, MailBody } from '@/components/MailBody';
import { fullDate, useDisplayName } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { useDeleteForever, useMailEntry, usePatchEntries } from '@/lib/queries';
import { IconButton, TopBar } from '../ui';

/** Traditional email view: full body, recipients, attachments, and Reply at the bottom. */
export function Reader() {
  const { id = '' } = useParams();
  const t = useT();
  const language = useLanguage();
  const navigate = useNavigate();
  const displayName = useDisplayName();
  const { data: entry } = useMailEntry(id);
  const patch = usePatchEntries();
  const deleteForever = useDeleteForever();

  useEffect(() => {
    if (entry && !entry.isRead) patch.mutate({ ids: [entry.id], patch: { isRead: true } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mark read once when it loads unread
  }, [entry?.id, entry?.isRead]);

  if (!entry) return <div className="h-full bg-wa-panel" />;

  const update = (change: EntryPatch, leave = false) => {
    patch.mutate({ ids: [entry.id], patch: change });
    if (leave) navigate(-1);
  };
  const inTrash = entry.folder === 'trash';
  const inSpam = entry.folder === 'spam';
  const restoreFolder = entry.outgoing ? 'sent' : 'inbox';
  const recipients = (list: string[]) => list.map((a) => displayName(a)).join(', ');

  return (
    <div className="flex h-full flex-col bg-wa-panel text-wa-text">
      <TopBar title="">
        <IconButton
          icon={Star}
          label={entry.isStarred ? 'Unstar' : 'Star'}
          className={entry.isStarred ? '[&>svg]:fill-current' : ''}
          onClick={() => update({ isStarred: !entry.isStarred })}
        />
        {inTrash || inSpam ? (
          <IconButton
            icon={ArchiveRestore}
            label={inSpam ? t('notSpam') : t('restore')}
            onClick={() => update({ folder: restoreFolder }, true)}
          />
        ) : (
          <>
            {!entry.outgoing && (
              <IconButton
                icon={OctagonAlert}
                label={t('reportSpam')}
                onClick={() => update({ folder: 'spam' }, true)}
              />
            )}
            <IconButton icon={MailOpen} label={t('markUnread')} onClick={() => update({ isRead: false }, true)} />
          </>
        )}
        <IconButton
          icon={Trash2}
          label={inTrash ? t('deleteForever') : t('delete')}
          onClick={() => {
            if (inTrash) deleteForever.mutate([entry.id]);
            else update({ folder: 'trash' });
            navigate(-1);
          }}
        />
      </TopBar>

      <article className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <h1 className="text-[22px] leading-tight">{entry.subject || t('noSubject')}</h1>
        <div className="mt-4 flex items-start gap-3">
          <Avatar name={displayName(entry.from)} src={entry.from.avatarUrl} size={40} />
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium">{entry.outgoing ? t('you') : displayName(entry.from)}</p>
            <p className="truncate text-xs text-wa-muted">{entry.from.address}</p>
            <p className="mt-1 text-xs text-wa-muted">
              {t('to')}: {recipients(entry.to)}
              {entry.cc.length > 0 && ` · ${t('cc')}: ${recipients(entry.cc)}`}
              {entry.bcc.length > 0 && ` · ${t('bcc')}: ${recipients(entry.bcc)}`}
            </p>
          </div>
          <span className="shrink-0 text-xs text-wa-muted">{fullDate(entry.createdAt, language)}</span>
        </div>
        {entry.quoted && (
          <p className="mt-4 rounded-md border-l-4 border-wa-accent bg-wa-panel-2 px-3 py-2 text-sm text-wa-muted">
            <span className="font-medium text-wa-accent">{entry.quoted.fromName}</span> · {entry.quoted.snippet}
          </p>
        )}
        <div className="mt-5">
          <MailBody text={entry.text} html={entry.html} />
        </div>
        <AttachmentList files={entry.attachments} />
      </article>

      {!inTrash && !inSpam && (
        <div className="shrink-0 border-t border-wa-line p-3">
          <button
            type="button"
            disabled={entry.repliedByMe}
            onClick={() => navigate(`/compose?reply=${entry.id}`)}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-wa-line py-2.5 text-[15px] font-medium text-wa-accent disabled:text-wa-muted"
          >
            <Reply size={18} />
            {entry.repliedByMe ? t('alreadyReplied') : t('reply')}
          </button>
        </div>
      )}
    </div>
  );
}
