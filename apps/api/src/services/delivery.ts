import { randomUUID } from 'node:crypto';
import type { SendResult, sendMailSchema } from '@dialox/shared';
import { eq } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import type { z } from 'zod';
import { config } from '../config';
import { db } from '../db/client';
import { attachments, drafts, mailboxEntries, messages, type users } from '../db/schema';
import { HttpError } from '../lib/http-error';
import { publishToUser } from '../realtime';
import { canonicalAddress, isLocalAddress, ownAddresses, resolveLocalAddress } from './accounts';
import { ensureConversation, getOwnConversation, touchConversation } from './conversations';
import { getEntryRow, isSpamSender } from './mailbox';
import { hasActiveMobileSession } from './sessions';
import { sendSms } from './sms';

type UserRow = typeof users.$inferSelect;

interface OutgoingFile {
  filename: string;
  contentType: string;
  content: Buffer;
}

interface DeliveryInput {
  sender: UserRow | null;
  fromAddress: string;
  fromName: string;
  to: string[];
  cc: string[];
  bcc: string[];
  /** Envelope recipients; for SMTP this is RCPT TO, which is how BCC recipients are reached. */
  recipients: string[];
  subject: string;
  text: string;
  html: string | null;
  files: OutgoingFile[];
  inReplyToId: string | null;
  rfcMessageId?: string;
  senderConversationId?: string;
}

const relay = config.smtpRelayUrl ? nodemailer.createTransport(config.smtpRelayUrl) : null;
const MAILER_DAEMON = () => `mailer-daemon@${config.mailDomain}`;

function notifyBySms(recipient: UserRow, fromLabel: string, subject: string) {
  if (recipient.smsOptOut) return;
  void hasActiveMobileSession(recipient.id).then((hasApp) => {
    if (hasApp) return;
    const body = config.smsTemplate.replace('{sender}', fromLabel).replace('{subject}', subject || '(no subject)');
    return sendSms(recipient.phone, body);
  });
}

async function deliverLocally(input: DeliveryInput, messageId: string, address: string): Promise<boolean> {
  const recipient = await resolveLocalAddress(address);
  if (!recipient) return false;
  if (recipient.id === input.sender?.id) return true; // the sender's own copy already lives in Sent
  const own = await ownAddresses(recipient);
  const others = [input.fromAddress, ...input.to, ...input.cc].filter((a) => !own.includes(a));
  const conversation = await ensureConversation(recipient.id, others, address);
  const spam = await isSpamSender(recipient.id, input.fromAddress);
  const [entry] = await db
    .insert(mailboxEntries)
    .values({
      userId: recipient.id,
      messageId,
      conversationId: conversation.id,
      ownAddress: address,
      folder: spam ? 'spam' : 'inbox',
    })
    .onConflictDoNothing()
    .returning();
  if (!entry) return true;
  await touchConversation(conversation.id);
  publishToUser(recipient.id, { type: 'mail', conversationId: conversation.id, entryId: entry.id });
  if (!spam) notifyBySms(recipient, input.fromName || input.fromAddress, input.subject);
  return true;
}

async function relayExternally(input: DeliveryInput, rfcMessageId: string, external: string[]) {
  if (!relay) throw new Error('No outbound SMTP relay is configured (SMTP_RELAY_URL)');
  await relay.sendMail({
    messageId: rfcMessageId,
    from: { name: input.fromName, address: input.fromAddress },
    to: input.to.filter((a) => external.includes(a)),
    cc: input.cc.filter((a) => external.includes(a)),
    bcc: input.bcc.filter((a) => external.includes(a)),
    subject: input.subject,
    text: input.text,
    html: input.html ?? undefined,
    attachments: input.files,
  });
}

async function bounce(sender: UserRow, senderAddress: string, failed: string[], reason: string, subject: string) {
  await deliver({
    sender: null,
    fromAddress: MAILER_DAEMON(),
    fromName: 'Mail Delivery System',
    to: [senderAddress],
    cc: [],
    bcc: [],
    recipients: [senderAddress],
    subject: `Delivery Status Notification (Failure): ${subject}`,
    text: `Your message "${subject}" could not be delivered to:\n\n${failed.join('\n')}\n\nReason: ${reason}`,
    html: null,
    files: [],
    inReplyToId: null,
  });
  console.warn(`[mail] bounced for ${sender.phone}: ${failed.join(', ')} (${reason})`);
}

/** Stores one message and fans it out to the sender's Sent copy and every recipient mailbox. */
async function deliver(input: DeliveryInput): Promise<SendResult & { messageId: string }> {
  const rfcMessageId = input.rfcMessageId ?? `<${randomUUID()}@${config.mailDomain}>`;
  const [message] = await db
    .insert(messages)
    .values({
      rfcMessageId,
      senderUserId: input.sender?.id ?? null,
      fromAddress: input.fromAddress,
      fromName: input.fromName,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      text: input.text,
      html: input.html,
      inReplyToId: input.inReplyToId,
      hasAttachments: input.files.length > 0,
    })
    .returning();
  if (input.files.length) {
    await db
      .insert(attachments)
      .values(input.files.map((f) => ({ ...f, messageId: message.id, size: f.content.length })));
  }

  let senderEntryId: string | null = null;
  let conversationId: string | null = null;
  if (input.sender) {
    conversationId =
      input.senderConversationId ??
      (await ensureConversation(input.sender.id, [...input.to, ...input.cc], input.fromAddress)).id;
    const [entry] = await db
      .insert(mailboxEntries)
      .values({
        userId: input.sender.id,
        messageId: message.id,
        conversationId,
        ownAddress: input.fromAddress,
        folder: 'sent',
        isRead: true,
      })
      .returning();
    senderEntryId = entry.id;
    await touchConversation(conversationId);
  }

  const local = input.recipients.filter(isLocalAddress);
  const external = input.recipients.filter((a) => !isLocalAddress(a));
  const unknown: string[] = [];
  for (const address of local) {
    if (!(await deliverLocally(input, message.id, address))) unknown.push(address);
  }

  let failed = false;
  if (input.sender && unknown.length) {
    failed = true;
    await bounce(input.sender, input.fromAddress, unknown, 'No Dialox account exists for this number.', input.subject);
  }
  if (input.sender && external.length) {
    try {
      await relayExternally(input, rfcMessageId, external);
    } catch (error) {
      failed = true;
      await bounce(input.sender, input.fromAddress, external, (error as Error).message, input.subject);
    }
  }
  const status = failed ? 'failed' : external.length ? 'sent' : 'delivered';
  await db.update(messages).set({ status }).where(eq(messages.id, message.id));
  if (input.sender) publishToUser(input.sender.id, { type: 'mail:changed', conversationId: null });
  return { messageId: message.id, senderEntryId, conversationId };
}

function withReplyPrefix(subject: string): string {
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

/** API send path: validates the sender identity and enforces the chat-locking rules. */
export async function sendMail(sender: UserRow, input: z.infer<typeof sendMailSchema>) {
  const own = await ownAddresses(sender);
  const fromAddress = input.from ? canonicalAddress(input.from) : own[0];
  if (!own.includes(fromAddress)) throw new HttpError(403, 'invalid_from', 'You can only send from your own addresses');

  let subject = input.subject.trim();
  let inReplyToId: string | null = null;
  let conversationId = input.conversationId;

  if (input.replyToEntryId) {
    const parent = await getEntryRow(sender.id, input.replyToEntryId);
    inReplyToId = parent.message.id;
    conversationId = parent.entry.conversationId;
    subject = withReplyPrefix(parent.message.subject);
  }
  // Inside an existing chat the recipients are locked to the chat's participants (the brief's
  // "To and CC cannot be changed" rule), enforced here so no client can bypass it.
  const locked = conversationId ? await getOwnConversation(sender.id, conversationId) : null;
  const to = locked ? locked.participants : input.to.map(canonicalAddress);
  const cc = locked ? [] : input.cc.map(canonicalAddress);
  const bcc = input.bcc.map(canonicalAddress);

  const files = input.attachments.map((a) => ({
    filename: a.filename,
    contentType: a.contentType || 'application/octet-stream',
    content: Buffer.from(a.base64, 'base64'),
  }));
  try {
    const result = await deliver({
      sender,
      fromAddress,
      fromName: sender.displayName || fromAddress,
      to,
      cc,
      bcc,
      recipients: [...new Set([...to, ...cc, ...bcc])],
      subject,
      text: input.text,
      html: input.html,
      files,
      inReplyToId,
      senderConversationId: conversationId,
    });
    if (input.draftId) await db.delete(drafts).where(eq(drafts.id, input.draftId));
    return result;
  } catch (error) {
    const pgError = error as { code?: string; cause?: { code?: string } };
    if ((pgError.cause?.code ?? pgError.code) === '23505') {
      throw new HttpError(409, 'already_replied', 'You have already replied to this message');
    }
    throw error;
  }
}

/** SMTP ingest path: mail from the outside world, routed by the envelope recipients. */
export async function ingestInbound(
  input: Omit<DeliveryInput, 'sender' | 'inReplyToId'> & { inReplyToRfc: string | null },
) {
  let inReplyToId: string | null = null;
  if (input.inReplyToRfc) {
    const [parent] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.rfcMessageId, input.inReplyToRfc));
    inReplyToId = parent?.id ?? null;
  }
  const { inReplyToRfc: _, ...rest } = input;
  return deliver({ ...rest, sender: null, inReplyToId });
}
