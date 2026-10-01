import type { ClientKind } from '@dialox/shared';
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// Each surface keeps its own session, so the mobile app and the web client can be signed in
// as different users in one browser, and the server can tell mobile-app users apart for SMS.
const tokenKey = (surface: ClientKind) => `dialox.token.${surface}`;
const listeners = new Set<() => void>();

function readToken(surface: ClientKind): string | null {
  try {
    return localStorage.getItem(tokenKey(surface));
  } catch {
    return null;
  }
}

export function setToken(surface: ClientKind, token: string | null) {
  try {
    if (token) localStorage.setItem(tokenKey(surface), token);
    else localStorage.removeItem(tokenKey(surface));
  } catch {
    // Storage blocked (private mode): the session simply will not persist across reloads.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function useToken(surface: ClientKind) {
  return useSyncExternalStore(subscribe, () => readToken(surface));
}

export async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  const response = await fetch(path, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const type = response.headers.get('content-type') ?? '';
  const data = type.includes('json') ? await response.json() : await response.text();
  if (!response.ok) {
    const error = data as { code?: string; message?: string };
    throw new ApiError(response.status, error.code ?? 'error', error.message ?? response.statusText);
  }
  return data as T;
}

export const SurfaceContext = createContext<ClientKind>('mobile');

function useSurface() {
  return useContext(SurfaceContext);
}

/** Request helpers bound to the current surface's session token. */
export function useApi() {
  const surface = useSurface();
  const token = useToken(surface);
  return useMemo(() => {
    const call =
      <T>(method: string) =>
      (path: string, body?: unknown) =>
        request<T>(path, { method, body, token });
    return {
      surface,
      token,
      get: <T>(path: string) => call<T>('GET')(path),
      post: <T>(path: string, body?: unknown) => call<T>('POST')(path, body ?? {}),
      patch: <T>(path: string, body: unknown) => call<T>('PATCH')(path, body),
      put: <T>(path: string, body: unknown) => call<T>('PUT')(path, body),
      del: <T>(path: string) => call<T>('DELETE')(path),
    };
  }, [surface, token]);
}
