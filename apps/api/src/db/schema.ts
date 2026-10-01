import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Uint8Array }>({
  dataType: () => 'bytea',
  fromDriver: (value) => Buffer.from(value),
});

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const textArray = (name: string) =>
  text(name)
    .array()
    .notNull()
    .default(sql`'{}'::text[]`);

/** Envelope and body columns shared by sent messages and drafts. */
const messageColumns = () => ({
  to: textArray('to_addresses'),
  cc: textArray('cc_addresses'),
  bcc: textArray('bcc_addresses'),
  subject: text('subject').notNull().default(''),
  text: text('body_text').notNull().default(''),
  html: text('body_html'),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull().unique(),
  displayName: text('display_name').notNull().default(''),
  about: text('about').notNull().default(''),
  avatarUrl: text('avatar_url'),
  language: text('language').notNull().default('en'),
  theme: text('theme').notNull().default('system'),
  signature: text('signature').notNull().default(''),
  passwordHash: text('password_hash'),
  registeredVia: text('registered_via').notNull(),
  smsOptOut: boolean('sms_opt_out').notNull().default(false),
  createdAt: createdAt(),
});

export const aliases = pgTable('aliases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  localPart: text('local_part').notNull().unique(),
  createdAt: createdAt(),
});

export const otpCodes = pgTable('otp_codes', {
  phone: text('phone').primaryKey(),
  codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: text('token_hash').notNull().unique(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  client: text('client').notNull(),
  createdAt: createdAt(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    participantKey: text('participant_key').notNull(),
    participants: textArray('participants'),
    isFavorite: boolean('is_favorite').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('conversations_owner_key').on(t.ownerId, t.participantKey)],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rfcMessageId: text('rfc_message_id').notNull(),
    senderUserId: uuid('sender_user_id').references(() => users.id, { onDelete: 'set null' }),
    fromAddress: text('from_address').notNull(),
    fromName: text('from_name').notNull().default(''),
    ...messageColumns(),
    inReplyToId: uuid('in_reply_to_id').references((): AnyPgColumn => messages.id, {
      onDelete: 'set null',
    }),
    hasAttachments: boolean('has_attachments').notNull().default(false),
    status: text('status').notNull().default('sent'),
    createdAt: createdAt(),
  },
  // Enforces the "each message can be replied to only once" rule per sender at the database level.
  (t) => [uniqueIndex('messages_single_reply').on(t.senderUserId, t.inReplyToId)],
);

export const mailboxEntries = pgTable(
  'mailbox_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    ownAddress: text('own_address').notNull(),
    folder: text('folder').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    isStarred: boolean('is_starred').notNull().default(false),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
    labelIds: textArray('label_ids'),
    createdAt: createdAt(),
  },
  (t) => [
    index('entries_user_folder').on(t.userId, t.folder, t.createdAt),
    index('entries_conversation').on(t.conversationId, t.createdAt),
    uniqueIndex('entries_user_message').on(t.userId, t.messageId),
  ],
);

export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  content: bytea('content').notNull(),
});

export const drafts = pgTable('drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  fromAddress: text('from_address').notNull().default(''),
  ...messageColumns(),
  conversationId: uuid('conversation_id').references(() => conversations.id, {
    onDelete: 'set null',
  }),
  replyToEntryId: uuid('reply_to_entry_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const labels = pgTable(
  'labels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull(),
  },
  (t) => [uniqueIndex('labels_user_name').on(t.userId, t.name)],
);

export const spamSenders = pgTable(
  'spam_senders',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    address: text('address').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.address] })],
);

export const smsLogs = pgTable(
  'sms_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: text('phone').notNull(),
    direction: text('direction').notNull(),
    body: text('body').notNull(),
    provider: text('provider').notNull(),
    status: text('status').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('sms_logs_phone').on(t.phone, t.createdAt)],
);
