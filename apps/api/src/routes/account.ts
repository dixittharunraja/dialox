import {
  aliasSchema,
  labelSchema,
  passwordChangeSchema,
  phoneToLocalPart,
  profileSchema,
  type Alias,
  type Label,
} from '@dialox/shared';
import { and, count, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import { db } from '../db/client';
import { aliases, labels, mailboxEntries, users } from '../db/schema';
import { currentUser, idParam, parse } from '../lib/http';
import { HttpError } from '../lib/http-error';
import { toUserDto } from '../services/accounts';
import { changePassword } from '../services/auth';

const MAX_ALIASES = 5;

const toAlias = (row: typeof aliases.$inferSelect): Alias => ({
  id: row.id,
  address: `${row.localPart}@${config.mailDomain}`,
  createdAt: row.createdAt.toISOString(),
});

export async function accountRoutes(app: FastifyInstance) {
  app.get('/api/me', async (request) => toUserDto(await currentUser(request)));

  app.patch('/api/me', async (request) => {
    const user = await currentUser(request);
    const patch = parse(profileSchema, request.body);
    const [row] = await db.update(users).set(patch).where(eq(users.id, user.id)).returning();
    return toUserDto(row);
  });

  app.put('/api/me/password', async (request) => {
    const user = await currentUser(request);
    const body = parse(passwordChangeSchema, request.body);
    await changePassword(user.id, body.current, body.next);
    return { ok: true };
  });

  app.get('/api/aliases', async (request) => {
    const user = await currentUser(request);
    const rows = await db.select().from(aliases).where(eq(aliases.userId, user.id)).orderBy(aliases.createdAt);
    return rows.map(toAlias);
  });

  app.post('/api/aliases', async (request) => {
    const user = await currentUser(request);
    const { name } = parse(aliasSchema, request.body);
    const [{ n }] = await db.select({ n: count() }).from(aliases).where(eq(aliases.userId, user.id));
    if (n >= MAX_ALIASES) throw new HttpError(400, 'alias_limit', `You can have up to ${MAX_ALIASES} aliases`);
    const localPart = `${name}.${phoneToLocalPart(user.phone, config.defaultCountry)}`;
    const [row] = await db.insert(aliases).values({ userId: user.id, localPart }).onConflictDoNothing().returning();
    if (!row) throw new HttpError(409, 'alias_taken', 'That alias already exists');
    return toAlias(row);
  });

  app.delete('/api/aliases/:id', async (request) => {
    const user = await currentUser(request);
    await db.delete(aliases).where(and(eq(aliases.id, idParam(request)), eq(aliases.userId, user.id)));
    return { ok: true };
  });

  app.get('/api/labels', async (request): Promise<Label[]> => {
    const user = await currentUser(request);
    return db
      .select({ id: labels.id, name: labels.name, color: labels.color })
      .from(labels)
      .where(eq(labels.userId, user.id))
      .orderBy(labels.name);
  });

  app.post('/api/labels', async (request): Promise<Label> => {
    const user = await currentUser(request);
    const body = parse(labelSchema, request.body);
    const [row] = await db
      .insert(labels)
      .values({ ...body, userId: user.id })
      .onConflictDoNothing()
      .returning();
    if (!row) throw new HttpError(409, 'label_exists', 'A label with that name already exists');
    return { id: row.id, name: row.name, color: row.color };
  });

  app.delete('/api/labels/:id', async (request) => {
    const user = await currentUser(request);
    const id = idParam(request);
    await db.delete(labels).where(and(eq(labels.id, id), eq(labels.userId, user.id)));
    await db
      .update(mailboxEntries)
      .set({ labelIds: sql`array_remove(${mailboxEntries.labelIds}, ${id})` })
      .where(eq(mailboxEntries.userId, user.id));
    return { ok: true };
  });
}
