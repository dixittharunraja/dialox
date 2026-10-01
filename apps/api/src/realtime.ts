import type { ClientEvent, ServerEvent, SmsLog } from '@dialox/shared';
import type { WebSocket } from 'ws';
import { config } from './config';
import { userIdForToken } from './services/sessions';

const userSockets = new Map<string, Set<WebSocket>>();
// Simulator-only channel: null watches every number (simulator console), a phone watches one
// number (mobile onboarding OTP auto-fill against the virtual device).
const smsWatchers = new Map<WebSocket, string | null>();

function send(socket: WebSocket, event: ServerEvent) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event));
}

export function publishToUser(userId: string, event: ServerEvent) {
  userSockets.get(userId)?.forEach((socket) => send(socket, event));
}

export function publishSms(log: SmsLog) {
  for (const [socket, phone] of smsWatchers) {
    if (phone === null || phone === log.phone) send(socket, { type: 'sms', log });
  }
}

export function attachSocket(socket: WebSocket) {
  let userId: string | null = null;

  socket.on('message', async (raw) => {
    let event: ClientEvent;
    try {
      event = JSON.parse(String(raw)) as ClientEvent;
    } catch {
      return;
    }
    if (event.type === 'auth' && !userId) {
      userId = await userIdForToken(event.token);
      if (!userId) return socket.close(4401, 'unauthorized');
      const sockets = userSockets.get(userId) ?? new Set();
      sockets.add(socket);
      userSockets.set(userId, sockets);
    } else if (event.type === 'watch-sms' && config.simulatorEnabled) {
      smsWatchers.set(socket, event.phone);
    }
  });

  socket.on('close', () => {
    smsWatchers.delete(socket);
    if (userId) userSockets.get(userId)?.delete(socket);
  });
}
