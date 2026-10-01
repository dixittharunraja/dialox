import type { ClientKind } from '@dialox/shared';
import { and, eq, gt } from 'drizzle-orm';
import { config } from '../config';
import { db } from '../db/client';
import { sessions } from '../db/schema';
import { randomToken, sha256 } from '../lib/crypto';

export async function createSession(userId: string, client: ClientKind): Promise<string> {
  const token = randomToken();
  await db.insert(sessions).values({
    userId,
    client,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + config.sessionDays * 86_400_000),
  });
  return token;
}

export async function userIdForToken(token: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())));
  return row?.userId ?? null;
}

export async function revokeSession(token: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}

/** SMS notifications only go to users without an active mobile-app session (per the brief). */
export async function hasActiveMobileSession(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.client, 'mobile'), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return Boolean(row);
}
