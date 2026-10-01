import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import Fastify, { LogController } from 'fastify';
import { config } from './config';
import { HttpError } from './lib/http-error';
import { attachSocket } from './realtime';
import { accountRoutes } from './routes/account';
import { authRoutes } from './routes/auth';
import { mailRoutes } from './routes/mail';
import { telephonyRoutes } from './routes/telephony';
import { seedDemoData } from './seed';
import { startSmtpServer } from './smtp';

const app = Fastify({
  logger: { level: 'info' },
  logController: new LogController({ disableRequestLogging: true }),
  bodyLimit: 2 * 1024 * 1024,
  trustProxy: true,
});

await app.register(rateLimit, { global: false, hook: 'preHandler' });
await app.register(websocket);

app.setErrorHandler((error, request, reply) => {
  if (error instanceof HttpError) {
    return reply.status(error.status).send({ code: error.code, message: error.message });
  }
  const { statusCode: status = 500, message } = error as { statusCode?: number; message: string };
  if (status >= 500) request.log.error(error);
  return reply.status(status).send({ code: 'error', message: status >= 500 ? 'Something went wrong' : message });
});

app.get('/api/health', async () => ({ ok: true }));
app.get('/api/ws', { websocket: true }, (socket) => attachSocket(socket));

await app.register(authRoutes);
await app.register(accountRoutes);
await app.register(mailRoutes);
await app.register(telephonyRoutes);

if (config.seedDemo) await seedDemoData();
startSmtpServer();
await app.listen({ port: config.port, host: '0.0.0.0' });
app.log.info(`OTP delivery: ${config.otpDelivery}; simulator ${config.simulatorEnabled ? 'on' : 'off'}`);
