import type { ClientEvent, ServerEvent, SmsLog } from '@dialox/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useApi } from './api';

function socketUrl() {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}/api/ws`;
}

/**
 * Opens a WebSocket for `channel` (null = closed) that reconnects with backoff. `onOpen`
 * returns the frames to send on every (re)connect, so subscriptions survive network drops.
 */
function useSocket(channel: string | null, onOpen: () => ClientEvent[], onEvent: (event: ServerEvent) => void) {
  const handlers = useRef({ onOpen, onEvent });
  useEffect(() => {
    handlers.current = { onOpen, onEvent };
  });

  useEffect(() => {
    if (!channel) return;
    let socket: WebSocket | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;
    let closed = false;
    const connect = () => {
      socket = new WebSocket(socketUrl());
      socket.onopen = () => {
        retry = 0;
        handlers.current.onOpen().forEach((frame) => socket?.send(JSON.stringify(frame)));
      };
      socket.onmessage = (message) => handlers.current.onEvent(JSON.parse(message.data) as ServerEvent);
      socket.onclose = () => {
        if (!closed) timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 15_000));
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, [channel]);
}

/** Live mailbox sync: any server push refreshes this surface's cached mail. */
export function useMailboxSync() {
  const { token, surface } = useApi();
  const client = useQueryClient();
  useSocket(
    token,
    () => [{ type: 'auth', token: token ?? '' }],
    (event) => {
      if (event.type !== 'sms') void client.invalidateQueries({ queryKey: [surface] });
    },
  );
}

/** Simulator channel: SMS traffic for one virtual number, or every number when phone is null. */
export function useSmsFeed(enabled: boolean, phone: string | null, onSms: (log: SmsLog) => void) {
  useSocket(
    enabled ? `sms:${phone ?? '*'}` : null,
    () => [{ type: 'watch-sms', phone }],
    (event) => {
      if (event.type === 'sms') onSms(event.log);
    },
  );
}
