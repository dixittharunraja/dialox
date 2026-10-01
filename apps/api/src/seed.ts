import { sendMailSchema, type SendMailInput } from '@dialox/shared';
import { and, count, eq } from 'drizzle-orm';
import { config } from './config';
import { db } from './db/client';
import { aliases, mailboxEntries, users } from './db/schema';
import { hashPassword } from './lib/crypto';
import { addressForPhone } from './services/accounts';
import { ingestInbound, sendMail } from './services/delivery';

const DEMO_PASSWORD = 'demo1234';
const DEMO_USERS = [
  { phone: '+919876543210', displayName: 'Aarav Sharma', about: 'Product designer' },
  { phone: '+919812345678', displayName: 'Priya Nair', about: 'Available' },
  { phone: '+919900112233', displayName: 'Rahul Verma', about: 'At the gym' },
];

/** Seeds a small, realistic mailbox on first boot so evaluators can sign in and explore. */
export async function seedDemoData() {
  const [{ n }] = await db.select({ n: count() }).from(users);
  if (n > 0) return;
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  // Opted out while seeding so the demo history does not fire SMS alerts.
  const [aarav, priya, rahul] = await db
    .insert(users)
    .values(DEMO_USERS.map((u) => ({ ...u, passwordHash, registeredVia: 'portal', smsOptOut: true })))
    .returning();
  await db
    .insert(aliases)
    .values({ userId: aarav.id, localPart: `work.${addressForPhone(aarav.phone).split('@')[0]}` });

  const send = (sender: typeof aarav, input: SendMailInput) => sendMail(sender, sendMailSchema.parse(input));
  const entryFor = async (userId: string, messageId: string) => {
    const [row] = await db
      .select({ id: mailboxEntries.id })
      .from(mailboxEntries)
      .where(and(eq(mailboxEntries.userId, userId), eq(mailboxEntries.messageId, messageId)));
    return row.id;
  };

  const first = await send(aarav, {
    to: [priya.phone],
    subject: 'Weekend trip plan',
    text: 'Hey Priya! Are we still on for Ooty this weekend? I can book the cottage tonight if you confirm.',
  });
  const reply = await send(priya, {
    to: [aarav.phone],
    replyToEntryId: await entryFor(priya.id, first.messageId),
    text: 'Yes, count me in. Book it! I will bring the board games.',
  });
  await send(aarav, {
    to: [priya.phone],
    replyToEntryId: await entryFor(aarav.id, reply.messageId),
    text: 'Done, booked for two nights. Sharing the receipt soon.',
  });
  await send(rahul, {
    to: [aarav.phone, priya.phone],
    subject: 'Hackathon team sync',
    text: 'Team, let us sync at 7 PM tomorrow to split the Alphastack tasks. I will take the backend.',
  });
  await send(priya, {
    to: [rahul.phone],
    subject: 'Notes from class',
    text: 'Attaching my notes from today. Ping me if anything is unclear.',
    attachments: [
      {
        filename: 'notes.txt',
        contentType: 'text/plain',
        base64: Buffer.from('Lecture 12: Distributed systems\n- Consensus\n- Raft vs Paxos\n').toString('base64'),
      },
    ],
  });
  await ingestInbound({
    fromAddress: 'newsletter@example.com',
    fromName: 'Tech Weekly',
    to: [addressForPhone(aarav.phone)],
    cc: [],
    bcc: [],
    recipients: [addressForPhone(aarav.phone)],
    subject: 'Your weekly digest',
    text: 'This week in tech: new JavaScript runtimes, faster databases, and a deep dive into SMTP.\n\n'.repeat(12),
    html: null,
    files: [],
    inReplyToRfc: null,
  });

  await db.update(users).set({ smsOptOut: false });
  console.log(`[seed] demo accounts created (password "${DEMO_PASSWORD}") on @${config.mailDomain}`);
}
