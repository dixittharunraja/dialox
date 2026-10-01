import type { AuthResult, ClientKind, RegisterResult } from '@dialox/shared';
import { useState } from 'react';
import { ApiError, request, setToken } from './api';

type AuthStep = 'phone' | 'otp' | 'password';

interface Options {
  /** "login" signs the surface in; "register" only creates the account (registration portal). */
  mode: 'login' | 'register';
  client: ClientKind;
  onLogin?: (result: AuthResult) => void;
  onRegistered?: (result: RegisterResult) => void;
}

/**
 * Phone -> OTP state machine shared by the mobile onboarding, the web login and the portal.
 * If the OTP gateway is unconfigured or rejects the send, it falls back to password auth.
 */
export function usePhoneAuth({ mode, client, onLogin, onRegistered }: Options) {
  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'otp_unavailable') setStep('password');
      else setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const requestCode = (number = phone) =>
    run(async () => {
      await request('/api/auth/otp', { method: 'POST', body: { phone: number } });
      setStep('otp');
    });

  const finish = async (credentials: { code?: string; password?: string }) => {
    if (mode === 'register') {
      const result = await request<RegisterResult>('/api/accounts/register', {
        method: 'POST',
        body: { phone, ...credentials },
      });
      onRegistered?.(result);
      return;
    }
    const path = credentials.code ? '/api/auth/otp/verify' : '/api/auth/password';
    const result = await request<AuthResult>(path, { method: 'POST', body: { phone, client, ...credentials } });
    setToken(client, result.token);
    onLogin?.(result);
  };

  return {
    step,
    phone,
    error,
    busy,
    setPhone,
    requestCode,
    verifyCode: (code: string) => run(() => finish({ code })),
    submitPassword: (password: string) => run(() => finish({ password })),
    usePassword: () => setStep('password'),
    reset: () => {
      setStep('phone');
      setPhone('');
      setError(null);
    },
    back: () => {
      setStep('phone');
      setError(null);
    },
  };
}
