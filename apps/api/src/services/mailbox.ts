import type {
  DeliveryStatus,
  EntryPatch,
  Folder,
  FolderCounts,
  MailEntry,
  MailPage,
  mailQuerySchema,
} from '@dialox/shared';
import { and, asc, count, desc, eq, gt, inArray, isNull, lte, ne, notInArray, or, sql, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../db/client';
import { attachments, drafts, mailboxEntries, messages, spamSenders } from '../db/schema';
import { HttpError } from '../lib/http-error';
import { publishToUser } from '../realtime';
import { describeParticipants } from './accounts';

type EntryRow = { entry: typeof mailboxEntries.$inferSelect; message: typeof messages.$inferSelect };

const PAGE_SIZE = 50;

export function snippetOf(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 160);
}

async function toEntries(userId: string, rows: EntryRow[], threadCounts?: Map<string, number>): Promise<MailEntry[]> {
  if (!rows.length) return [];
  const messageIds = rows.map((r) => r.message.id);
  const parentIds = [...new Set(rows.map((r) => r.message.inReplyToId).filter((id): id is string => !!id))];

  const [files, parents, parentEntries, myReplies, senders] = await Promise.all([
    db
      .select({
        id: attachments.id,
        messageId: attachments.messageId,
        filename: attachments.filename,
        contentType: attachments.contentType,
        size: attachments.size,
      })
      .from(attachments)
      .where(inArray(attachments.messageId, messageIds)),
    parentIds.length ? db.select().from(messages).where(inArray(messages.id, parentIds)) : [],
    parentIds.length
      ? db
          .select({ id: mailboxEntries.id, messageId: mailboxEntries.messageId })
          .from(mailboxEntries)
          .where(and(eq(mailboxEntries.userId, userId), inArray(mailboxEntries.messageId, parentIds)))
      : [],
    db
      .select({ inReplyToId: messages.inReplyToId })
      .from(messages)
      .where(and(eq(messages.senderUserId, userId), inArray(messages.inReplyToId, messageIds))),
    describeParticipants(
      [...new Set(rows.map((r) => r.message.fromAddress))],
      new Map(rows.map((r) => [r.message.fromAddress, r.message.fromName])),
    ),
  ]);

  const parentById = new Map(parents.map((p) => [p.id, p]));
  const parentEntryByMessage = new Map(parentEntries.map((e) => [e.messageId, e.id]));
  const replied = new Set(myReplies.map((r) => r.inReplyToId));
  const senderByAddress = new Map(senders.map((s) => [s.address, s]));

  return rows.map(({ entry, message }) => {
    const outgoing = entry.folder === 'sent' || message.senderUserId === userId;
    const parent = message.inReplyToId ? parentById.get(message.inReplyToId) : undefined;
    return {
      id: entry.id,
      conversationId: entry.conversationId,
      folder: entry.folder as Folder,
      from: senderByAddress.get(message.fromAddress)!,
      ownAddress: entry.ownAddress,
      to: message.to,
      cc: message.cc,
      bcc: outgoing ? message.bcc : [],
      subject: message.subject,
      snippet: snippetOf(message.text),
      text: message.text,
      html: message.html,
      outgoing,
      isRead: entry.isRead,
      isStarred: entry.isStarred,
      snoozedUntil: entry.snoozedUntil?.toISOString() ?? null,
      labelIds: entry.labelIds,
      attachments: files.filter((f) => f.messageId === message.id).map(({ messageId: _, ...f }) => f),
      quoted: parent
        ? {
            entryId: parentEntryByMessage.get(parent.id) ?? null,
            fromName: parent.fromName || parent.fromAddress,
            subject: parent.subject,
            snippet: snippetOf(parent.text),
          }
        : null,
      repliedByMe: replied.has(message.id),
      status: (outgoing ? message.status : 'delivered') as DeliveryStatus,
      createdAt: entry.createdAt.toISOString(),
      threadCount: threadCounts?.get(entry.conversationId) ?? 1,
    };
  });
}

function selectEntries() {
  return db
    .select({ entry: mailboxEntries, message: messages })
    .from(mailboxEntries)
    .innerJoin(messages, eq(messages.id, mailboxEntries.messageId));
}

export async function conversationEntries(userId: string, conversationId: string) {
  const rows = await selectEntries()
    .where(
      and(
        eq(mailboxEntries.userId, userId),
        eq(mailboxEntries.conversationId, conversationId),
        inArray(mailboxEntries.folder, ['inbox', 'sent']),
      ),
    )
    .orderBy(asc(mailboxEntries.createdAt));
  return toEntries(userId, rows);
}

export async function getEntry(userId: string, id: string): Promise<MailEntry> {
  const rows = await selectEntries().where(and(eq(mailboxEntries.id, id), eq(mailboxEntries.userId, userId)));
  if (!rows.length) throw new HttpError(404, 'not_found', 'Email not found');
  const [entry] = await toEntries(userId, rows);
  return entry;
}

export async function getEntryRow(userId: string, id: string) {
  const [row] = await selectEntries().where(and(eq(mailboxEntries.id, id), eq(mailboxEntries.userId, userId)));
  if (!row) throw new HttpError(404, 'not_found', 'Email not found');
  return row;
}

function viewCondition(view: z.infer<typeof mailQuerySchema>['view']): SQL | undefined {
  const now = new Date();
  switch (view) {
    case 'inbox':
      return and(
        eq(mailboxEntries.folder, 'inbox'),
        or(isNull(mailboxEntries.snoozedUntil), lte(mailboxEntries.snoozedUntil, now)),
      );
    case 'starred':
      return and(eq(mailboxEntries.isStarred, true), notInArray(mailboxEntries.folder, ['spam', 'trash']));
    case 'snoozed':
      return and(gt(mailboxEntries.snoozedUntil, now), ne(mailboxEntries.folder, 'trash'));
    default:
      return eq(mailboxEntries.folder, view);
  }
}

export async function listMail(userId: string, query: z.infer<typeof mailQuerySchema>): Promise<MailPage> {
  const like = (value: string | undefined) => (value ? `%${value}%` : null);
  const q = like(query.q);
  const from = like(query.from);
  const to = like(query.to);
  const subject = like(query.subject);
  const where = and(
    eq(mailboxEntries.userId, userId),
    // A label view spans every folder except Spam and Trash, like Gmail.
    query.labelId ? notInArray(mailboxEntries.folder, ['spam', 'trash']) : viewCondition(query.view),
    q
      ? sql`(${messages.subject} ilike ${q} or ${messages.text} ilike ${q} or ${messages.fromAddress} ilike ${q} or ${messages.fromName} ilike ${q})`
      : undefined,
    from ? sql`(${messages.fromAddress} ilike ${from} or ${messages.fromName} ilike ${from})` : undefined,
    to ? sql`array_to_string(${messages.to} || ${messages.cc}, ' ') ilike ${to}` : undefined,
    subject ? sql`${messages.subject} ilike ${subject}` : undefined,
    query.hasAttachment ? eq(messages.hasAttachments, true) : undefined,
    query.after ? sql`${mailboxEntries.createdAt} >= ${query.after}::date` : undefined,
    query.before ? sql`${mailboxEntries.createdAt} < ${query.before}::date + 1` : undefined,
    query.labelId ? sql`${mailboxEntries.labelIds} @> array[${query.labelId}]::text[]` : undefined,
  );
  // Group matching entries by conversation, like Gmail: each thread is one row, keyed on its
  // most recent matching message. Pagination and totals operate on conversations, not messages.
  const latestPerConversation = db
    .selectDistinctOn([mailboxEntries.conversationId], {
      id: mailboxEntries.id,
      conversationId: mailboxEntries.conversationId,
      createdAt: mailboxEntries.createdAt,
    })
    .from(mailboxEntries)
    .innerJoin(messages, eq(messages.id, mailboxEntries.messageId))
    .where(where)
    .orderBy(mailboxEntries.conversationId, desc(mailboxEntries.createdAt))
    .as('latest');

  const [page, [{ total }]] = await Promise.all([
    db
      .select({ id: latestPerConversation.id })
      .from(latestPerConversation)
      .orderBy(desc(latestPerConversation.createdAt))
      .limit(PAGE_SIZE)
      .offset((query.page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(latestPerConversation),
  ]);
  const ids = page.map((p) => p.id);
  if (!ids.length) return { items: [], total };

  const rows = await selectEntries().where(inArray(mailboxEntries.id, ids));
  const order = new Map(ids.map((id, i) => [id, i]));
  rows.sort((a, b) => order.get(a.entry.id)! - order.get(b.entry.id)!);

  const conversationIds = [...new Set(rows.map((r) => r.entry.conversationId))];
  const countRows = await db
    .select({ conversationId: mailboxEntries.conversationId, n: count() })
    .from(mailboxEntries)
    .innerJoin(messages, eq(messages.id, mailboxEntries.messageId))
    .where(and(where, inArray(mailboxEntries.conversationId, conversationIds)))
    .groupBy(mailboxEntries.conversationId);
  const threadCounts = new Map(countRows.map((c) => [c.conversationId, c.n]));

  return { items: await toEntries(userId, rows, threadCounts), total };
}

export async function folderCounts(userId: string): Promise<FolderCounts> {
  const now = new Date();
  const countWhere = (where: SQL | undefined) =>
    db
      .select({ n: count() })
      .from(mailboxEntries)
      .where(and(eq(mailboxEntries.userId, userId), where))
      .then(([r]) => r.n);
  const [inbox, spam, trash, draftCount] = await Promise.all([
    countWhere(
      and(
        eq(mailboxEntries.folder, 'inbox'),
        eq(mailboxEntries.isRead, false),
        or(isNull(mailboxEntries.snoozedUntil), lte(mailboxEntries.snoozedUntil, now)),
      ),
    ),
    countWhere(and(eq(mailboxEntries.folder, 'spam'), eq(mailboxEntries.isRead, false))),
    countWhere(eq(mailboxEntries.folder, 'trash')),
    db
      .select({ n: count() })
      .from(drafts)
      .where(eq(drafts.userId, userId))
      .then(([r]) => r.n),
  ]);
  return { inbox, drafts: draftCount, spam, trash };
}

/** Upgrades the sender's copy to "read" (blue ticks) once every local recipient has read it. */
async function propagateReadReceipt(messageId: string) {
  const [message] = await db.select().from(messages).where(eq(messages.id, messageId));
  if (!message?.senderUserId || message.status === 'read') return;
  const others = await db
    .select({ isRead: mailboxEntries.isRead })
    .from(mailboxEntries)
    .where(and(eq(mailboxEntries.messageId, messageId), ne(mailboxEntries.userId, message.senderUserId)));
  if (!others.length || others.some((o) => !o.isRead)) return;
  await db.update(messages).set({ status: 'read' }).where(eq(messages.id, messageId));
  const [senderEntry] = await db
    .select({ conversationId: mailboxEntries.conversationId })
    .from(mailboxEntries)
    .where(and(eq(mailboxEntries.messageId, messageId), eq(mailboxEntries.userId, message.senderUserId)));
  publishToUser(message.senderUserId, { type: 'mail:changed', conversationId: senderEntry?.conversationId ?? null });
}

export async function patchEntries(userId: string, ids: string[], patch: EntryPatch) {
  const rows = await selectEntries().where(and(eq(mailboxEntries.userId, userId), inArray(mailboxEntries.id, ids)));
  if (!rows.length) throw new HttpError(404, 'not_found', 'Email not found');
  await db
    .update(mailboxEntries)
    .set({
      ...patch,
      snoozedUntil: typeof patch.snoozedUntil === 'string' ? new Date(patch.snoozedUntil) : patch.snoozedUntil,
    })
    .where(and(eq(mailboxEntries.userId, userId), inArray(mailboxEntries.id, ids)));

  // "Move to inbox" restores the user's own messages to Sent rather than the Inbox.
  const own = rows.filter((r) => r.message.senderUserId === userId).map((r) => r.entry.id);
  if (patch.folder === 'inbox' && own.length) {
    await db.update(mailboxEntries).set({ folder: 'sent' }).where(inArray(mailboxEntries.id, own));
  }

  // Reporting spam teaches the mailbox: future mail from that sender skips the inbox.
  const senders = [...new Set(rows.filter((r) => r.message.senderUserId !== userId).map((r) => r.message.fromAddress))];
  if (patch.folder === 'spam' && senders.length) {
    await db
      .insert(spamSenders)
      .values(senders.map((address) => ({ userId, address })))
      .onConflictDoNothing();
  } else if (patch.folder === 'inbox' && senders.length) {
    await db.delete(spamSenders).where(and(eq(spamSenders.userId, userId), inArray(spamSenders.address, senders)));
  }
  if (patch.isRead) await Promise.all(rows.map((r) => propagateReadReceipt(r.message.id)));
  publishToUser(userId, { type: 'mail:changed', conversationId: null });
}

export async function markConversationRead(userId: string, conversationId: string) {
  const unread = await db
    .select({ id: mailboxEntries.id })
    .from(mailboxEntries)
    .where(
      and(
        eq(mailboxEntries.userId, userId),
        eq(mailboxEntries.conversationId, conversationId),
        eq(mailboxEntries.isRead, false),
      ),
    );
  if (unread.length)
    await patchEntries(
      userId,
      unread.map((r) => r.id),
      { isRead: true },
    );
}

export async function deleteForever(userId: string, ids: string[]) {
  await db
    .delete(mailboxEntries)
    .where(and(eq(mailboxEntries.userId, userId), inArray(mailboxEntries.id, ids), eq(mailboxEntries.folder, 'trash')));
  publishToUser(userId, { type: 'mail:changed', conversationId: null });
}

export async function isSpamSender(userId: string, address: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(spamSenders)
    .where(and(eq(spamSenders.userId, userId), eq(spamSenders.address, address)));
  return Boolean(row);
}

export async function attachmentForUser(userId: string, attachmentId: string) {
  const [row] = await db
    .select({ attachment: attachments })
    .from(attachments)
    .innerJoin(mailboxEntries, eq(mailboxEntries.messageId, attachments.messageId))
    .where(and(eq(attachments.id, attachmentId), eq(mailboxEntries.userId, userId)))
    .limit(1);
  if (!row) throw new HttpError(404, 'not_found', 'Attachment not found');
  return row.attachment;
}
