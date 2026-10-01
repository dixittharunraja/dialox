import type { AuthResult, ClientKind, RegisterResult, RegistrationChannel } from '@dialox/shared';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { db } from '../db/client';
import { otpCodes, users } from '../db/schema';
import { hashPassword, randomDigits, sha256, temporaryPassword, verifyPassword } from '../lib/crypto';
import { HttpError } from '../lib/http-error';
import { addressForPhone, createUser, findUserByPhone, parsePhone, toUserDto } from './accounts';
import { createSession } from './sessions';
import { sendSms } from './sms';

const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;

const otpUnavailable = () =>
  new HttpError(409, 'otp_unavailable', 'OTP delivery is unavailable. Use a password instead.');

export async function requestOtp(rawPhone: string) {
  if (config.otpDelivery === 'none') throw otpUnavailable();
  const phone = parsePhone(rawPhone);
  const code = randomDigits(6);
  const values = {
    phone,
    codeHash: sha256(`${phone}:${code}`),
    attempts: 0,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  };
  await db.insert(otpCodes).values(values).onConflictDoUpdate({ target: otpCodes.phone, set: values });
  // The trailing "@host #code" line is the WebOTP format, letting Android Chrome auto-fill it.
  const host = new URL(config.publicUrl).host;
  const sent = await sendSms(
    phone,
    `Your Dialox verification code is ${code}. It expires in 5 minutes.\n\n@${host} #${code}`,
  );
  if (!sent) throw otpUnavailable();
  return { phone, delivery: config.otpDelivery };
}

async function consumeOtp(phone: string, code: string) {
  const [row] = await db.select().from(otpCodes).where(eq(otpCodes.phone, phone));
  if (!row || row.expiresAt < new Date() || row.attempts >= OTP_MAX_ATTEMPTS) {
    throw new HttpError(400, 'otp_expired', 'The code has expired. Request a new one.');
  }
  if (row.codeHash !== sha256(`${phone}:${code}`)) {
    await db
      .update(otpCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(otpCodes.phone, phone));
    throw new HttpError(400, 'otp_invalid', 'Incorrect code');
  }
  await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
}

async function issue(userId: string, client: ClientKind, isNew: boolean): Promise<AuthResult> {
  const [row] = await db.select().from(users).where(eq(users.id, userId));
  return { token: await createSession(userId, client), user: toUserDto(row), isNew };
}

export async function loginWithOtp(rawPhone: string, code: string, client: ClientKind) {
  const phone = parsePhone(rawPhone);
  await consumeOtp(phone, code);
  const existing = await findUserByPhone(phone);
  const user = existing ?? (await createUser(phone, client));
  return issue(user.id, client, !existing);
}

export async function loginWithPassword(rawPhone: string, password: string, client: ClientKind) {
  const phone = parsePhone(rawPhone);
  const existing = await findUserByPhone(phone);
  if (!existing) {
    const user = await createUser(phone, client, await hashPassword(password));
    return issue(user.id, client, true);
  }
  if (!existing.passwordHash) {
    throw new HttpError(
      409,
      'password_not_set',
      'This account signs in with OTP. Set a password from your profile to enable password sign-in.',
    );
  }
  if (!(await verifyPassword(password, existing.passwordHash))) {
    throw new HttpError(401, 'wrong_password', 'Incorrect password');
  }
  return issue(existing.id, client, false);
}

/**
 * Creates an account from any registration channel and sends the welcome SMS. Phone-based
 * channels (IVR/SMS) never saw a password, so they receive a temporary one by SMS — that proves
 * possession of the number and still lets them sign in when OTP delivery is unavailable.
 */
export async function registerAccount(
  phone: string,
  via: RegistrationChannel,
  passwordHash: string | null = null,
): Promise<RegisterResult> {
  if (await findUserByPhone(phone)) return { address: addressForPhone(phone), created: false };
  const tempPassword = passwordHash ? null : via === 'ivr' || via === 'sms' ? temporaryPassword() : null;
  const hash = passwordHash ?? (tempPassword ? await hashPassword(tempPassword) : null);
  await createUser(phone, via, hash);
  const address = addressForPhone(phone);
  const signIn = tempPassword ? ` Temporary password: ${tempPassword}.` : '';
  await sendSms(phone, `Welcome to Dialox! Your email address is ${address}.${signIn} Sign in at ${config.publicUrl}`);
  return { address, created: true };
}

export async function registerFromPortal(rawPhone: string, code?: string, password?: string) {
  const phone = parsePhone(rawPhone);
  if (code) {
    await consumeOtp(phone, code);
    return registerAccount(phone, 'portal');
  }
  if (password) return registerAccount(phone, 'portal', await hashPassword(password));
  throw new HttpError(400, 'missing_credentials', 'Enter the OTP or a password');
}

export async function changePassword(userId: string, current: string | undefined, next: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId));
  if (row.passwordHash && !(current && (await verifyPassword(current, row.passwordHash)))) {
    throw new HttpError(401, 'wrong_password', 'Current password is incorrect');
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(next) })
    .where(eq(users.id, userId));
}
