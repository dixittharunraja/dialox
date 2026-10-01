import { otpRequestSchema, otpVerifySchema, passwordAuthSchema, registerSchema, type AppConfig } from '@dialox/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { config } from '../config';
import { bearerToken, parse } from '../lib/http';
import { loginWithOtp, loginWithPassword, registerFromPortal, requestOtp } from '../services/auth';
import { revokeSession } from '../services/sessions';

// Keyed by phone number (bodies are parsed first: the plugin runs at preHandler), so one number
// cannot be SMS-bombed or brute-forced, while users behind a shared NAT do not block each other.
const byPhone = (request: FastifyRequest) => (request.body as { phone?: string } | undefined)?.phone ?? request.ip;
const strictLimit = { rateLimit: { max: 5, timeWindow: '10 minutes', keyGenerator: byPhone } };
const loginLimit = { rateLimit: { max: 10, timeWindow: '10 minutes', keyGenerator: byPhone } };

export async function authRoutes(app: FastifyInstance) {
  app.get('/api/config', async (): Promise<AppConfig> => ({
    mailDomain: config.mailDomain,
    defaultCountry: config.defaultCountry,
    otpDelivery: config.otpDelivery,
    simulatorEnabled: config.simulatorEnabled,
    tollFreeNumber: config.tollFreeNumber,
  }));

  app.post('/api/auth/otp', { config: strictLimit }, async (request) => {
    return requestOtp(parse(otpRequestSchema, request.body).phone);
  });

  app.post('/api/auth/otp/verify', { config: loginLimit }, async (request) => {
    const body = parse(otpVerifySchema, request.body);
    return loginWithOtp(body.phone, body.code, body.client);
  });

  app.post('/api/auth/password', { config: loginLimit }, async (request) => {
    const body = parse(passwordAuthSchema, request.body);
    return loginWithPassword(body.phone, body.password, body.client);
  });

  app.post('/api/auth/logout', async (request) => {
    const token = bearerToken(request);
    if (token) await revokeSession(token);
    return { ok: true };
  });

  app.post('/api/accounts/register', { config: loginLimit }, async (request) => {
    const body = parse(registerSchema, request.body);
    return registerFromPortal(body.phone, body.code, body.password);
  });
}
