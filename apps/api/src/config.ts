import type { OtpDelivery } from '@dialox/shared';

function env(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

const twilio = {
  accountSid: env('TWILIO_ACCOUNT_SID'),
  authToken: env('TWILIO_AUTH_TOKEN'),
  fromNumber: env('TWILIO_FROM_NUMBER'),
};

const twilioConfigured = Boolean(twilio.accountSid && twilio.authToken && twilio.fromNumber);
const simulatorEnabled = env('SIMULATOR_ENABLED', 'true') === 'true';

function resolveOtpDelivery(): OtpDelivery {
  const forced = env('OTP_MODE');
  if (forced === 'none') return 'none';
  if (twilioConfigured) return 'twilio';
  return simulatorEnabled ? 'simulator' : 'none';
}

export const config = {
  port: Number(env('PORT', '4000')),
  smtpPort: Number(env('SMTP_PORT', '2525')),
  databaseUrl: env('DATABASE_URL'),
  pgliteDir: env('PGLITE_DIR', '.data/pglite'),
  mailDomain: env('MAIL_DOMAIN', 'dialox.local').toLowerCase(),
  defaultCountry: env('DEFAULT_COUNTRY', 'IN').toUpperCase(),
  publicUrl: env('PUBLIC_URL', 'http://localhost:8080'),
  tollFreeNumber: env('TOLL_FREE_NUMBER', twilio.fromNumber || '+18005550199'),
  smsTemplate: env('SMS_TEMPLATE', 'You have received an email from {sender}. Subject: {subject}.'),
  smtpRelayUrl: env('SMTP_RELAY_URL'),
  seedDemo: env('SEED_DEMO', 'true') === 'true',
  simulatorEnabled,
  otpDelivery: resolveOtpDelivery(),
  twilio: twilioConfigured ? twilio : null,
  sessionDays: 30,
};
