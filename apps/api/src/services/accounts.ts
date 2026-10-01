import {
  normalizePhone,
  phoneToLocalPart,
  splitAddress,
  toAddress,
  type Participant,
  type RegistrationChannel,
  type ThemePreference,
  type User,
} from '@dialox/shared';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { config } from '../config';
import { db } from '../db/client';
import { aliases, messages, users } from '../db/schema';
import { HttpError } from '../lib/http-error';

type UserRow = typeof users.$inferSelect;

export function parsePhone(input: string): string {
  const phone = normalizePhone(input, config.defaultCountry);
  if (!phone) throw new HttpError(400, 'invalid_phone', 'Enter a valid phone number');
  return phone;
}

export function addressForPhone(phone: string): string {
  return `${phoneToLocalPart(phone, config.defaultCountry)}@${config.mailDomain}`;
}

export function canonicalAddress(input: string): string {
  const address = toAddress(input, config.mailDomain, config.defaultCountry);
  if (!address) throw new HttpError(400, 'invalid_address', `"${input}" is not a phone number or email`);
  return address;
}

export function isLocalAddress(address: string): boolean {
  return splitAddress(address).domain === config.mailDomain;
}

export function toUserDto(row: UserRow): User {
  return {
    id: row.id,
    phone: row.phone,
    address: addressForPhone(row.phone),
    displayName: row.displayName,
    about: row.about,
    avatarUrl: row.avatarUrl,
    language: row.language,
    theme: row.theme as ThemePreference,
    signature: row.signature,
    hasPassword: Boolean(row.passwordHash),
    registeredVia: row.registeredVia as RegistrationChannel,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function findUserByPhone(phone: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.phone, phone));
  return row;
}

export async function getUser(id: string): Promise<UserRow> {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  if (!row) throw new HttpError(401, 'unauthorized', 'Account no longer exists');
  return row;
}

export async function createUser(
  phone: string,
  via: RegistrationChannel,
  passwordHash: string | null = null,
): Promise<UserRow> {
  const [row] = await db.insert(users).values({ phone, registeredVia: via, passwordHash }).returning();
  return row;
}

/** Resolves a local address (phone local part or alias) to its owning user. */
export async function resolveLocalAddress(address: string): Promise<UserRow | undefined> {
  const { local, domain } = splitAddress(address);
  if (domain !== config.mailDomain) return undefined;
  const [alias] = await db.select().from(aliases).where(eq(aliases.localPart, local));
  if (alias) {
    const [row] = await db.select().from(users).where(eq(users.id, alias.userId));
    return row;
  }
  const phone = normalizePhone(local, config.defaultCountry);
  return phone ? findUserByPhone(phone) : undefined;
}

export async function ownAddresses(user: UserRow): Promise<string[]> {
  const rows = await db.select().from(aliases).where(eq(aliases.userId, user.id));
  return [addressForPhone(user.phone), ...rows.map((a) => `${a.localPart}@${config.mailDomain}`)];
}

/**
 * Display metadata for addresses. Local numbers and aliases get their owner's profile name and
 * photo; external senders fall back to the display name from their most recent message.
 */
export async function describeParticipants(
  addresses: string[],
  knownNames: Map<string, string> = new Map(),
): Promise<Participant[]> {
  if (!addresses.length) return [];
  const locals = addresses.filter(isLocalAddress).map((a) => splitAddress(a).local);
  const phones = locals
    .map((local) => normalizePhone(local, config.defaultCountry))
    .filter((p): p is string => Boolean(p));
  const [profiles, aliasOwners, senderNames] = await Promise.all([
    phones.length ? db.select().from(users).where(inArray(users.phone, phones)) : [],
    locals.length
      ? db
          .select({ localPart: aliases.localPart, user: users })
          .from(aliases)
          .innerJoin(users, eq(users.id, aliases.userId))
          .where(inArray(aliases.localPart, locals))
      : [],
    db
      .selectDistinctOn([messages.fromAddress], { address: messages.fromAddress, name: messages.fromName })
      .from(messages)
      .where(and(inArray(messages.fromAddress, addresses), ne(messages.fromName, '')))
      .orderBy(messages.fromAddress, desc(messages.createdAt)),
  ]);
  const byAddress = new Map([
    ...profiles.map((u) => [addressForPhone(u.phone), u] as const),
    ...aliasOwners.map((a) => [`${a.localPart}@${config.mailDomain}`, a.user] as const),
  ]);
  const lastName = new Map(senderNames.map((s) => [s.address, s.name]));
  return addresses.map((address) => {
    const profile = byAddress.get(address);
    return {
      address,
      name: profile?.displayName || knownNames.get(address) || lastName.get(address) || null,
      avatarUrl: profile?.avatarUrl ?? null,
    };
  });
}
