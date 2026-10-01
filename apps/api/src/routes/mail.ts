import {
  bulkPatchSchema,
  conversationOpenSchema,
  conversationPatchSchema,
  conversationQuerySchema,
  draftSchema,
  entryPatchSchema,
  mailQuerySchema,
  sendMailSchema,
  type Draft,
} from '@dialox/shared';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { drafts } from '../db/schema';
import { currentUser, idParam, parse } from '../lib/http';
import { HttpError } from '../lib/http-error';
import { canonicalAddress, ownAddresses } from '../services/accounts';
import { describeConversation, ensureConversation, listConversations, setFavorite } from '../services/conversations';
import { sendMail } from '../services/delivery';
import {
  attachmentForUser,
  conversationEntries,
  deleteForever,
  folderCounts,
  getEntry,
  listMail,
  markConversationRead,
  patchEntries,
} from '../services/mailbox';

const toDraft = (row: typeof drafts.$inferSelect): Draft => ({
  id: row.id,
  from: row.fromAddress,
  to: row.to,
  cc: row.cc,
  bcc: row.bcc,
  subject: row.subject,
  text: row.text,
  html: row.html,
  conversationId: row.conversationId,
  replyToEntryId: row.replyToEntryId,
  updatedAt: row.updatedAt.toISOString(),
});

function draftValues(body: ReturnType<typeof draftSchema.parse>) {
  const { from, ...rest } = body;
  return { ...rest, fromAddress: from, updatedAt: new Date() };
}

export async function mailRoutes(app: FastifyInstance) {
  app.get('/api/conversations', async (request) => {
    const user = await currentUser(request);
    const query = parse(conversationQuerySchema, request.query);
    return listConversations(user.id, query.filter, query.q);
  });

  app.post('/api/conversations', async (request) => {
    const user = await currentUser(request);
    const body = parse(conversationOpenSchema, request.body);
    const own = await ownAddresses(user);
    const others = body.participants.map(canonicalAddress).filter((a) => !own.includes(a));
    const conversation = await ensureConversation(user.id, others, own[0]);
    return describeConversation(user.id, conversation.id);
  });

  app.get('/api/conversations/:id', async (request) => {
    const user = await currentUser(request);
    return describeConversation(user.id, idParam(request));
  });

  app.patch('/api/conversations/:id', async (request) => {
    const user = await currentUser(request);
    await setFavorite(user.id, idParam(request), parse(conversationPatchSchema, request.body).isFavorite);
    return { ok: true };
  });

  app.get('/api/conversations/:id/messages', async (request) => {
    const user = await currentUser(request);
    return conversationEntries(user.id, idParam(request));
  });

  app.post('/api/conversations/:id/read', async (request) => {
    const user = await currentUser(request);
    await markConversationRead(user.id, idParam(request));
    return { ok: true };
  });

  app.get('/api/mail', async (request) => {
    const user = await currentUser(request);
    return listMail(user.id, parse(mailQuerySchema, request.query));
  });

  app.get('/api/mail/counts', async (request) => folderCounts((await currentUser(request)).id));

  app.get('/api/mail/:id', async (request) => {
    const user = await currentUser(request);
    return getEntry(user.id, idParam(request));
  });

  app.patch('/api/mail/:id', async (request) => {
    const user = await currentUser(request);
    await patchEntries(user.id, [idParam(request)], parse(entryPatchSchema, request.body));
    return getEntry(user.id, idParam(request));
  });

  app.post('/api/mail/bulk', async (request) => {
    const user = await currentUser(request);
    const body = parse(bulkPatchSchema, request.body);
    await patchEntries(user.id, body.ids, body.patch);
    return { ok: true };
  });

  app.post('/api/mail/delete', async (request) => {
    const user = await currentUser(request);
    await deleteForever(user.id, parse(bulkPatchSchema.pick({ ids: true }), request.body).ids);
    return { ok: true };
  });

  app.post('/api/mail/send', { bodyLimit: 30 * 1024 * 1024 }, async (request) => {
    const user = await currentUser(request);
    return sendMail(user, parse(sendMailSchema, request.body));
  });

  app.get('/api/attachments/:id', async (request, reply) => {
    const user = await currentUser(request);
    const file = await attachmentForUser(user.id, idParam(request));
    return reply
      .header('content-type', file.contentType)
      .header('content-disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`)
      .send(file.content);
  });

  app.get('/api/drafts', async (request) => {
    const user = await currentUser(request);
    const rows = await db.select().from(drafts).where(eq(drafts.userId, user.id)).orderBy(desc(drafts.updatedAt));
    return rows.map(toDraft);
  });

  app.post('/api/drafts', async (request) => {
    const user = await currentUser(request);
    const values = draftValues(parse(draftSchema, request.body));
    const [row] = await db
      .insert(drafts)
      .values({ ...values, userId: user.id })
      .returning();
    return toDraft(row);
  });

  app.put('/api/drafts/:id', async (request) => {
    const user = await currentUser(request);
    const values = draftValues(parse(draftSchema, request.body));
    const [row] = await db
      .update(drafts)
      .set(values)
      .where(and(eq(drafts.id, idParam(request)), eq(drafts.userId, user.id)))
      .returning();
    if (!row) throw new HttpError(404, 'not_found', 'Draft not found');
    return toDraft(row);
  });

  app.delete('/api/drafts/:id', async (request) => {
    const user = await currentUser(request);
    await db.delete(drafts).where(and(eq(drafts.id, idParam(request)), eq(drafts.userId, user.id)));
    return { ok: true };
  });
}
