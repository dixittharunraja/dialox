import { z } from 'zod';

const phone = z.string().trim().min(4).max(24);
const client = z.enum(['mobile', 'web']);
const addressList = z.array(z.string().trim().min(3).max(254)).max(50);

export const otpRequestSchema = z.object({ phone });

export const otpVerifySchema = z.object({
  phone,
  code: z.string().regex(/^\d{6}$/),
  client,
});

export const passwordAuthSchema = z.object({
  phone,
  password: z.string().min(8).max(128),
  client,
});

export const registerSchema = z.object({
  phone,
  code: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  password: z.string().min(8).max(128).optional(),
});

export const profileSchema = z
  .object({
    displayName: z.string().trim().max(60),
    about: z.string().trim().max(140),
    avatarUrl: z.string().startsWith('data:image/').max(400_000).nullable(),
    language: z.enum(['en', 'hi', 'ta', 'es']),
    theme: z.enum(['system', 'light', 'dark']),
    signature: z.string().max(2000),
  })
  .partial();

export const passwordChangeSchema = z.object({
  current: z.string().max(128).optional(),
  next: z.string().min(8).max(128),
});

export const aliasSchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9-]{1,23}$/, 'Use 2-24 letters, digits or dashes, starting with a letter'),
});

export const labelSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});

export const attachmentUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().max(255),
  base64: z.string().max(14_000_000),
});

const messageFields = {
  to: addressList.default([]),
  cc: addressList.default([]),
  bcc: addressList.default([]),
  subject: z.string().max(998).default(''),
  text: z.string().max(1_000_000).default(''),
  html: z.string().max(2_000_000).nullable().default(null),
};

export const sendMailSchema = z
  .object({
    ...messageFields,
    from: z.string().optional(),
    attachments: z.array(attachmentUploadSchema).max(10).default([]),
    conversationId: z.uuid().optional(),
    replyToEntryId: z.uuid().optional(),
    draftId: z.uuid().optional(),
  })
  // Chat sends and replies take their recipients from the conversation, so only a fresh
  // compose must name them.
  .refine((v) => v.to.length > 0 || v.conversationId || v.replyToEntryId, {
    path: ['to'],
    message: 'Add at least one recipient',
  });

export const draftSchema = z.object({
  ...messageFields,
  from: z.string().default(''),
  conversationId: z.uuid().nullable().default(null),
  replyToEntryId: z.uuid().nullable().default(null),
});

export const entryPatchSchema = z
  .object({
    isRead: z.boolean(),
    isStarred: z.boolean(),
    folder: z.enum(['inbox', 'sent', 'spam', 'trash']),
    snoozedUntil: z.iso.datetime().nullable(),
    labelIds: z.array(z.uuid()).max(20),
  })
  .partial();

export const bulkPatchSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(500),
  patch: entryPatchSchema,
});

export const mailQuerySchema = z.object({
  view: z.enum(['inbox', 'sent', 'spam', 'trash', 'starred', 'snoozed']).default('inbox'),
  q: z.string().max(200).optional(),
  from: z.string().max(200).optional(),
  to: z.string().max(200).optional(),
  subject: z.string().max(200).optional(),
  hasAttachment: z.coerce.boolean().optional(),
  after: z.iso.date().optional(),
  before: z.iso.date().optional(),
  labelId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const conversationQuerySchema = z.object({
  filter: z.enum(['all', 'unread', 'attachments', 'favorites']).default('all'),
  q: z.string().max(200).optional(),
});

export const conversationOpenSchema = z.object({ participants: addressList.min(1) });

export const conversationPatchSchema = z.object({ isFavorite: z.boolean() });

export const simulatorCallSchema = z.object({
  from: phone,
  digits: z.string().max(8).optional(),
});

export const simulatorSmsSchema = z.object({
  from: phone,
  body: z.string().min(1).max(1600),
});

export type SendMailInput = z.input<typeof sendMailSchema>;
export type DraftInput = z.input<typeof draftSchema>;
export type EntryPatch = z.infer<typeof entryPatchSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type MailQuery = z.input<typeof mailQuerySchema>;
