import type { SendResult } from '@dialox/shared';
import { useEffect, useState } from 'react';
import { toAttachments, type PendingAttachment } from './files';
import {
  useAliases,
  useConversation,
  useDeleteDraft,
  useDrafts,
  useMailEntry,
  useMe,
  useSaveDraft,
  useSendMail,
} from './queries';

export interface ComposeContext {
  draftId?: string;
  /** Composing inside a chat: recipients are locked to the chat's participants. */
  conversationId?: string;
  /** Replying to a specific message: subject is derived, recipients locked. */
  replyToEntryId?: string;
  /** Pre-filled content for a fresh compose (signature, forwarded message). */
  initial?: { subject?: string; text?: string; html?: string; attachments?: PendingAttachment[] };
}

/** Composer state shared by the mobile traditional composer and the Gmail-style window. */
export function useCompose(context: ComposeContext) {
  const { data: me } = useMe();
  const { data: aliases = [] } = useAliases();
  const { data: drafts } = useDrafts();
  const { data: replyEntry } = useMailEntry(context.replyToEntryId);
  const lockedConversationId = context.conversationId ?? replyEntry?.conversationId;
  const { data: conversation } = useConversation(lockedConversationId ?? '');
  const sendMail = useSendMail();
  const saveDraftMutation = useSaveDraft();
  const deleteDraft = useDeleteDraft();

  const [draftId, setDraftId] = useState(context.draftId);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [subject, setSubject] = useState(context.initial?.subject ?? '');
  const [text, setText] = useState(context.initial?.text ?? '');
  const [html, setHtml] = useState<string | null>(context.initial?.html ?? null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>(context.initial?.attachments ?? []);
  const [loadedDraft, setLoadedDraft] = useState(false);

  const draft = drafts?.find((d) => d.id === context.draftId);
  useEffect(() => {
    if (!draft || loadedDraft) return;
    setLoadedDraft(true);
    setFrom(draft.from);
    setTo(draft.to);
    setCc(draft.cc);
    setBcc(draft.bcc);
    setSubject(draft.subject);
    setText(draft.text);
    setHtml(draft.html);
  }, [draft, loadedDraft]);

  const locked = Boolean(context.conversationId || context.replyToEntryId || draft?.conversationId);
  const lockedRecipients = conversation?.participants.map((p) => p.address) ?? [];
  const replySubject = replyEntry
    ? /^re:/i.test(replyEntry.subject)
      ? replyEntry.subject
      : `Re: ${replyEntry.subject}`
    : null;
  const fromOptions = me ? [me.address, ...aliases.map((a) => a.address)] : [];
  const isDirty = Boolean(text.trim() || subject.trim() || attachments.length || (!locked && to.length));

  const draftBody = () => ({
    from,
    to: locked ? lockedRecipients : to,
    cc: locked ? [] : cc,
    bcc,
    subject: replySubject ?? subject,
    text,
    html,
    conversationId: lockedConversationId ?? null,
    replyToEntryId: context.replyToEntryId ?? draft?.replyToEntryId ?? null,
  });

  return {
    from: from || fromOptions[0] || '',
    setFrom,
    fromOptions,
    to: locked ? lockedRecipients : to,
    setTo,
    cc: locked ? [] : cc,
    setCc,
    bcc,
    setBcc,
    subject: replySubject ?? subject,
    setSubject,
    text,
    setText,
    html,
    setHtml,
    attachments,
    locked,
    isReply: Boolean(replyEntry),
    isDirty,
    sending: sendMail.isPending,
    addFiles: async (files: FileList | File[]) => setAttachments(await toAttachments(files, attachments)),
    removeAttachment: (index: number) => setAttachments(attachments.filter((_, i) => i !== index)),
    send: (): Promise<SendResult> =>
      sendMail.mutateAsync({
        ...draftBody(),
        from: from || undefined,
        conversationId: lockedConversationId,
        replyToEntryId: context.replyToEntryId ?? draft?.replyToEntryId ?? undefined,
        attachments: attachments.map(({ size: _, ...file }) => file),
        draftId,
      }),
    saveDraft: async () => {
      const saved = await saveDraftMutation.mutateAsync({ id: draftId, draft: draftBody() });
      setDraftId(saved.id);
    },
    discard: async () => {
      if (draftId) await deleteDraft.mutateAsync(draftId);
    },
  };
}
