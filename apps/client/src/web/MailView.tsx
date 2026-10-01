import type { EntryPatch, MailEntry } from '@dialox/shared';
import { ArchiveRestore, ArrowLeft, Forward, Mail, OctagonAlert, Reply, Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Avatar } from '@/components/Avatar';
import { AttachmentList, MailBody } from '@/components/MailBody';
import { useApi } from '@/lib/api';
import { fullDate, useDisplayName } from '@/lib/format';
import type { PendingAttachment } from '@/lib/files';
import { useDeleteForever, useMailEntry, usePatchEntries } from '@/lib/queries';
import { LabelChips, LabelMenu, SnoozeMenu } from './actions';
import { useShell } from './WebApp';
import { GmIconButton } from './widgets';

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** Forwarding re-attaches the original files, so fetch them back as base64 uploads. */
function useForward() {
  const { token } = useApi();
  const displayName = useDisplayName();
  return async (entry: MailEntry) => {
    const attachments: PendingAttachment[] = await Promise.all(
      entry.attachments.map(async (file) => {
        const response = await fetch(`/api/attachments/${file.id}`, { headers: { authorization: `Bearer ${token}` } });
        const bytes = new Uint8Array(await response.arrayBuffer());
        let binary = '';
        bytes.forEach((b) => (binary += String.fromCharCode(b)));
        return { filename: file.filename, contentType: file.contentType, base64: btoa(binary), size: file.size };
      }),
    );
    const header = [
      '---------- Forwarded message ---------',
      `From: ${displayName(entry.from)} &lt;${entry.from.address}&gt;`,
      `Date: ${fullDate(entry.createdAt, navigator.language)}`,
      `Subject: ${escapeHtml(entry.subject)}`,
      `To: ${entry.to.join(', ')}`,
    ].join('<br>');
    const body = entry.html ?? escapeHtml(entry.text).replace(/\n/g, '<br>');
    return {
      subject: /^fwd?:/i.test(entry.subject) ? entry.subject : `Fwd: ${entry.subject}`,
      html: `<br><br>${header}<br><br>${body}`,
      attachments,
    };
  };
}

export function MailView({ id }: { id: string }) {
  const [params, setParams] = useSearchParams();
  const { data: entry } = useMailEntry(id);
  const [allMessages, setAllMessages] = useState<MailEntry[]>([]);
  const displayName = useDisplayName();
  const patch = usePatchEntries();
  const deleteForever = useDeleteForever();
  const forward = useForward();
  const api = useApi();
  const { openCompose } = useShell();

  useEffect(() => {
    if (entry && !entry.isRead) patch.mutate({ ids: [entry.id], patch: { isRead: true } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mark read once when it loads unread
  }, [entry?.id, entry?.isRead]);

  useEffect(() => {
    if (entry?.conversationId) {
      api
        .get<MailEntry[]>(`/api/conversations/${entry.conversationId}/messages`)
        .then(setAllMessages)
        .catch(() => setAllMessages(entry ? [entry] : []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- api identity changes every render; key off the conversation
  }, [entry?.conversationId]);

  const close = () => {
    const next = new URLSearchParams(params);
    next.delete('open');
    setParams(next);
  };

  if (!entry) return <div className="p-8 text-gm-muted">Loading...</div>;

  const update = (change: EntryPatch, leave = false) => {
    patch.mutate({ ids: [entry.id], patch: change });
    if (leave) close();
  };
  const inTrash = entry.folder === 'trash';
  const inSpam = entry.folder === 'spam';
  const actionButton =
    'flex items-center gap-2 rounded-full border border-gm-line px-5 py-2 text-sm font-medium hover:bg-gm-hover disabled:opacity-50';

  const messages = allMessages.length > 0 ? allMessages : [entry];
  const firstMessage = messages[0];

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-1 px-2">
        <GmIconButton icon={ArrowLeft} label="Back" onClick={close} />
        {inTrash || inSpam ? (
          <GmIconButton
            icon={ArchiveRestore}
            label={inSpam ? 'Not spam' : 'Move to Inbox'}
            onClick={() => update({ folder: 'inbox' }, true)}
          />
        ) : (
          !entry.outgoing && (
            <GmIconButton icon={OctagonAlert} label="Report spam" onClick={() => update({ folder: 'spam' }, true)} />
          )
        )}
        <GmIconButton
          icon={Trash2}
          label={inTrash ? 'Delete forever' : 'Delete'}
          onClick={() => {
            if (inTrash) deleteForever.mutate([entry.id]);
            else update({ folder: 'trash' });
            close();
          }}
        />
        <GmIconButton icon={Mail} label="Mark as unread" onClick={() => update({ isRead: false }, true)} />
        <SnoozeMenu ids={[entry.id]} snoozed={!!entry.snoozedUntil} onDone={close} />
        <LabelMenu ids={[entry.id]} current={entry.labelIds} />
      </div>

      <article className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 sm:pr-10 sm:pl-18">
        <div className="flex items-start gap-3 py-4">
          <h1 className="flex-1 text-[22px] leading-snug">
            {firstMessage.subject || '(no subject)'} <LabelChips ids={entry.labelIds} />
          </h1>
          <button
            type="button"
            aria-label={entry.isStarred ? 'Starred' : 'Not starred'}
            onClick={() => update({ isStarred: !entry.isStarred })}
            className={`p-2 ${entry.isStarred ? 'text-[#f4b400]' : 'text-gm-muted'}`}
          >
            <Star size={20} className={entry.isStarred ? 'fill-current' : ''} />
          </button>
        </div>

        <div className="space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className="border-t border-gm-line pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-start gap-3">
                <Avatar name={displayName(msg.from)} src={msg.from.avatarUrl} size={40} variant="gm" />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">
                        {msg.outgoing ? 'You' : displayName(msg.from)}
                        {msg.outgoing && ' (sent)'}
                      </p>
                      <p className="text-xs text-gm-muted">&lt;{msg.from.address}&gt;</p>
                    </div>
                    <span className="shrink-0 text-xs text-gm-muted">
                      {fullDate(msg.createdAt, navigator.language)}
                    </span>
                  </div>
                  {!msg.outgoing && (
                    <p className="text-xs text-gm-muted mt-0.5">
                      to {msg.to.map((a) => displayName(a)).join(', ')}
                      {msg.cc.length > 0 && `, cc ${msg.cc.map((a) => displayName(a)).join(', ')}`}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 ml-12">
                <MailBody text={msg.text} html={msg.html} />
                <AttachmentList files={msg.attachments} tone="gm" />
              </div>
            </div>
          ))}
        </div>

        {!inTrash && !inSpam && (
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={entry.repliedByMe}
              title={entry.repliedByMe ? 'Each message can be replied to only once' : undefined}
              onClick={() => openCompose({ replyToEntryId: entry.id })}
              className={actionButton}
            >
              <Reply size={18} /> {entry.repliedByMe ? 'Replied' : 'Reply'}
            </button>
            <button
              type="button"
              onClick={() => void forward(entry).then((initial) => openCompose({ initial }))}
              className={actionButton}
            >
              <Forward size={18} /> Forward
            </button>
          </div>
        )}
      </article>
    </div>
  );
}
