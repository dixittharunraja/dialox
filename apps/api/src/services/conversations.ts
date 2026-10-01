import type { Conversation, ConversationFilter, DeliveryStatus } from '@dialox/shared';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { conversations, mailboxEntries, messages } from '../db/schema';
import { HttpError } from '../lib/http-error';
import { describeParticipants } from './accounts';
import { snippetOf } from './mailbox';

const CHAT_FOLDERS = ['inbox', 'sent'];

/**
 * A conversation is keyed by the owner plus the set of *other* participants, which gives the
 * brief's semantics for free: one-to-one mail always lands in the 1:1 chat, and a mail to 2+
 * people lands in a separate group chat for exactly that set of people.
 */
export async function ensureConversation(ownerId: string, others: string[], ownAddress: string) {
  const unique = [...new Set(others.map((a) => a.toLowerCase()))].sort();
  const participants = unique.length ? unique : [ownAddress];
  const participantKey = participants.join(',');
  const [row] = await db
    .insert(conversations)
    .values({
      ownerId,
      participantKey,
      participants,
      kind: participants.length > 1 ? 'group' : 'direct',
    })
    .onConflictDoUpdate({
      target: [conversations.ownerId, conversations.participantKey],
      set: { participantKey },
    })
    .returning();
  return row;
}

export async function getOwnConversation(ownerId: string, id: string) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.ownerId, ownerId)));
  if (!row) throw new HttpError(404, 'not_found', 'Conversation not found');
  return row;
}

export async function touchConversation(id: string) {
  await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, id));
}

export async function listConversations(
  ownerId: string,
  filter: ConversationFilter,
  q?: string,
): Promise<Conversation[]> {
  const visible = and(eq(mailboxEntries.userId, ownerId), inArray(mailboxEntries.folder, CHAT_FOLDERS));
  const pattern = q ? `%${q}%` : null;
  const rows = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.ownerId, ownerId),
        filter === 'favorites' ? eq(conversations.isFavorite, true) : undefined,
        pattern
          ? sql`(array_to_string(${conversations.participants}, ' ') ilike ${pattern} or exists (
              select 1 from ${mailboxEntries} e join ${messages} m on m.id = e.message_id
              where e.conversation_id = ${conversations.id} and e.folder in ('inbox','sent')
                and (m.subject ilike ${pattern} or m.body_text ilike ${pattern} or m.from_name ilike ${pattern})))`
          : undefined,
      ),
    )
    .orderBy(desc(conversations.updatedAt));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);

  const [lastRows, unreadRows, attachmentRows] = await Promise.all([
    db
      .selectDistinctOn([mailboxEntries.conversationId], {
        conversationId: mailboxEntries.conversationId,
        folder: mailboxEntries.folder,
        at: mailboxEntries.createdAt,
        subject: messages.subject,
        text: messages.text,
        status: messages.status,
      })
      .from(mailboxEntries)
      .innerJoin(messages, eq(messages.id, mailboxEntries.messageId))
      .where(and(visible, inArray(mailboxEntries.conversationId, ids)))
      .orderBy(mailboxEntries.conversationId, desc(mailboxEntries.createdAt)),
    db
      .select({ conversationId: mailboxEntries.conversationId, count: sql<number>`count(*)::int` })
      .from(mailboxEntries)
      .where(and(visible, inArray(mailboxEntries.conversationId, ids), eq(mailboxEntries.isRead, false)))
      .groupBy(mailboxEntries.conversationId),
    db
      .selectDistinct({ conversationId: mailboxEntries.conversationId })
      .from(mailboxEntries)
      .innerJoin(messages, eq(messages.id, mailboxEntries.messageId))
      .where(and(visible, inArray(mailboxEntries.conversationId, ids), eq(messages.hasAttachments, true))),
  ]);

  const last = new Map(lastRows.map((r) => [r.conversationId, r]));
  const unread = new Map(unreadRows.map((r) => [r.conversationId, r.count]));
  const withAttachments = new Set(attachmentRows.map((r) => r.conversationId));
  const people = await describeParticipants([...new Set(rows.flatMap((r) => r.participants))]);
  const person = new Map(people.map((p) => [p.address, p]));

  return rows
    .filter((r) => last.has(r.id))
    .filter((r) => filter !== 'unread' || (unread.get(r.id) ?? 0) > 0)
    .filter((r) => filter !== 'attachments' || withAttachments.has(r.id))
    .map((r) => {
      const l = last.get(r.id)!;
      return {
        id: r.id,
        kind: r.kind as Conversation['kind'],
        participants: r.participants.map((a) => person.get(a)!),
        isFavorite: r.isFavorite,
        unreadCount: unread.get(r.id) ?? 0,
        hasAttachments: withAttachments.has(r.id),
        last: {
          subject: l.subject,
          snippet: snippetOf(l.text),
          outgoing: l.folder === 'sent',
          status: (l.folder === 'sent' ? l.status : 'delivered') as DeliveryStatus,
          at: l.at.toISOString(),
        },
        updatedAt: r.updatedAt.toISOString(),
      };
    });
}

export async function describeConversation(ownerId: string, id: string): Promise<Conversation> {
  const row = await getOwnConversation(ownerId, id);
  return {
    id: row.id,
    kind: row.kind as Conversation['kind'],
    participants: await describeParticipants(row.participants),
    isFavorite: row.isFavorite,
    unreadCount: 0,
    hasAttachments: false,
    last: null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function setFavorite(ownerId: string, id: string, isFavorite: boolean) {
  await getOwnConversation(ownerId, id);
  await db.update(conversations).set({ isFavorite }).where(eq(conversations.id, id));
}
