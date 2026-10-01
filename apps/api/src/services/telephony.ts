import { splitAddress } from '@dialox/shared';
import { eq } from 'drizzle-orm';
import twilio from 'twilio';
import { db } from '../db/client';
import { users } from '../db/schema';
import { addressForPhone, findUserByPhone, parsePhone } from './accounts';
import { registerAccount } from './auth';
import { logSms, sendSms } from './sms';

const { VoiceResponse, MessagingResponse } = twilio.twiml;
const VOICE = { voice: 'Polly.Joanna' as const };

/** "9876543210@dialox.local" -> "9 8 7 6 5 4 3 2 1 0, at dialox dot local" for text-to-speech. */
function speakable(address: string): string {
  const { local, domain } = splitAddress(address);
  return `${local.split('').join(' ')}, at ${domain.replaceAll('.', ' dot ')}`;
}

export async function incomingCall(from: string, gatherUrl: string): Promise<string> {
  const response = new VoiceResponse();
  const phone = parsePhone(from);
  if (await findUserByPhone(phone)) {
    response.say(VOICE, `Welcome back to Dialox. Your email address is ${speakable(addressForPhone(phone))}. Goodbye.`);
    response.hangup();
    return response.toString();
  }
  const gather = response.gather({ numDigits: 1, action: gatherUrl, method: 'POST', timeout: 8 });
  gather.say(VOICE, 'Welcome to Dialox, the email service for your phone number. Press 1 to create your account.');
  response.say(VOICE, 'We did not receive any input. Goodbye.');
  response.hangup();
  return response.toString();
}

export async function gatherDigits(from: string, digits: string, callUrl: string): Promise<string> {
  const response = new VoiceResponse();
  if (digits !== '1') {
    response.say(VOICE, 'That is not a valid option.');
    response.redirect({ method: 'POST' }, callUrl);
    return response.toString();
  }
  const phone = parsePhone(from);
  const { address, created } = await registerAccount(phone, 'ivr');
  response.say(
    VOICE,
    created
      ? `Your Dialox account has been created. Your email address is ${speakable(address)}. We have sent your sign-in details by SMS. Goodbye.`
      : `This number already has an account. Your email address is ${speakable(address)}. Goodbye.`,
  );
  response.hangup();
  return response.toString();
}

const HELP_TEXT = 'Dialox: reply START to create your email account, STOP to pause email alerts, HELP for help.';

/** Handles an inbound SMS command. Replies go out through sendSms so they are logged uniformly. */
export async function incomingSms(from: string, body: string, provider: 'twilio' | 'simulator'): Promise<string> {
  const phone = parsePhone(from);
  await logSms({ phone, direction: 'inbound', body, provider, status: 'received' });
  const command = body.trim().split(/\s+/)[0]?.toUpperCase() ?? '';
  const user = await findUserByPhone(phone);

  if (['START', 'REGISTER', 'JOIN', 'SIGNUP'].includes(command)) {
    if (!user) {
      await registerAccount(phone, 'sms');
    } else {
      if (user.smsOptOut) await db.update(users).set({ smsOptOut: false }).where(eq(users.id, user.id));
      await sendSms(phone, `You already have a Dialox account: ${addressForPhone(phone)}. Email alerts are on.`);
    }
  } else if (command === 'STOP' && user) {
    await db.update(users).set({ smsOptOut: true }).where(eq(users.id, user.id));
    await sendSms(phone, 'Dialox email alerts paused. Reply START to resume.');
  } else {
    await sendSms(phone, HELP_TEXT);
  }
  return new MessagingResponse().toString();
}
