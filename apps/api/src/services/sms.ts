import type { SmsLog } from '@dialox/shared';
import { desc, eq } from 'drizzle-orm';
import twilio from 'twilio';
import { config } from '../config';
import { db } from '../db/client';
import { smsLogs } from '../db/schema';
import { publishSms } from '../realtime';

const client = config.twilio ? twilio(config.twilio.accountSid, config.twilio.authToken) : null;

type LogInput = Pick<SmsLog, 'phone' | 'direction' | 'body' | 'provider' | 'status'>;

export async function logSms(input: LogInput): Promise<SmsLog> {
  const [row] = await db.insert(smsLogs).values(input).returning();
  const log = { ...row, createdAt: row.createdAt.toISOString() } as SmsLog;
  publishSms(log);
  return log;
}

/**
 * Sends through Twilio when configured, otherwise delivers to the virtual telephony simulator.
 * Returns false when the gateway rejects the message (e.g. a Twilio trial sending to an
 * unverified number) so callers can fall back instead of failing the whole request.
 */
export async function sendSms(phone: string, body: string): Promise<boolean> {
  if (!client || !config.twilio) {
    await logSms({ phone, direction: 'outbound', body, provider: 'simulator', status: 'sent' });
    return true;
  }
  try {
    await client.messages.create({ to: phone, from: config.twilio.fromNumber, body });
    await logSms({ phone, direction: 'outbound', body, provider: 'twilio', status: 'sent' });
    return true;
  } catch (error) {
    console.warn(`[sms] Twilio send to ${phone} failed: ${(error as Error).message}`);
    await logSms({ phone, direction: 'outbound', body, provider: 'twilio', status: 'failed' });
    return false;
  }
}

export async function recentSms(phone: string | null): Promise<SmsLog[]> {
  const rows = await db
    .select()
    .from(smsLogs)
    .where(phone ? eq(smsLogs.phone, phone) : undefined)
    .orderBy(desc(smsLogs.createdAt))
    .limit(100);
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }) as SmsLog);
}

export function validateTwilioSignature(signature: string, url: string, params: object): boolean {
  if (!config.twilio) return false;
  return twilio.validateRequest(config.twilio.authToken, signature, url, params as Record<string, string>);
}
