import { simulatorCallSchema, simulatorSmsSchema } from '@dialox/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config';
import { parse } from '../lib/http';
import { HttpError } from '../lib/http-error';
import { recentSms, validateTwilioSignature } from '../services/sms';
import { gatherDigits, incomingCall, incomingSms } from '../services/telephony';
import { parsePhone } from '../services/accounts';

type TwilioParams = { From?: string; Body?: string; Digits?: string };

const VOICE_URL = '/api/telephony/voice';
const SIM_CALL_URL = '/api/simulator/call';

function twilioParams(request: FastifyRequest): TwilioParams {
  if (!config.twilio) throw new HttpError(404, 'not_found', 'Twilio is not configured');
  const signature = String(request.headers['x-twilio-signature'] ?? '');
  const params = (request.body ?? {}) as TwilioParams;
  if (!validateTwilioSignature(signature, `${config.publicUrl}${request.url}`, params)) {
    throw new HttpError(403, 'invalid_signature', 'Invalid Twilio signature');
  }
  return params;
}

const xml = (reply: FastifyReply, twiml: string) => reply.type('text/xml').send(twiml);

function requireSimulator() {
  if (!config.simulatorEnabled) throw new HttpError(404, 'not_found', 'Simulator is disabled');
}

/**
 * Real Twilio webhooks (signature-verified) and the virtual telephony simulator share the same
 * IVR/SMS logic and return the same TwiML, so the simulator exercises the production path.
 */
export async function telephonyRoutes(app: FastifyInstance) {
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => {
    done(null, Object.fromEntries(new URLSearchParams(String(body))));
  });

  app.post(VOICE_URL, async (request, reply) => {
    const params = twilioParams(request);
    return xml(reply, await incomingCall(params.From ?? '', `${VOICE_URL}/gather`));
  });

  app.post(`${VOICE_URL}/gather`, async (request, reply) => {
    const params = twilioParams(request);
    return xml(reply, await gatherDigits(params.From ?? '', params.Digits ?? '', VOICE_URL));
  });

  app.post('/api/telephony/sms', async (request, reply) => {
    const params = twilioParams(request);
    return xml(reply, await incomingSms(params.From ?? '', params.Body ?? '', 'twilio'));
  });

  app.post(SIM_CALL_URL, async (request, reply) => {
    requireSimulator();
    const body = parse(simulatorCallSchema, request.body);
    return xml(reply, await incomingCall(body.from, `${SIM_CALL_URL}/gather`));
  });

  app.post(`${SIM_CALL_URL}/gather`, async (request, reply) => {
    requireSimulator();
    const body = parse(simulatorCallSchema, request.body);
    return xml(reply, await gatherDigits(body.from, body.digits ?? '', SIM_CALL_URL));
  });

  app.post('/api/simulator/sms', async (request, reply) => {
    requireSimulator();
    const body = parse(simulatorSmsSchema, request.body);
    return xml(reply, await incomingSms(body.from, body.body, 'simulator'));
  });

  app.get('/api/simulator/sms', async (request) => {
    requireSimulator();
    const { phone } = parse(z.object({ phone: z.string().optional() }), request.query);
    return recentSms(phone ? parsePhone(phone) : null);
  });
}
