import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useConfig } from '@/lib/queries';
import type { usePhoneAuth } from '@/lib/use-phone-auth';

interface PhoneAuthCardProps {
  auth: ReturnType<typeof usePhoneAuth>;
  title: string;
  subtitle: string;
  submitLabel: string;
  notice?: ReactNode;
  footer?: ReactNode;
}

/**
 * Google-style two-field card (phone + OTP, or phone + password when OTP delivery is
 * unavailable) with a single Next button. Used by the web sign-in and the registration portal.
 */
export function PhoneAuthCard({ auth, title, subtitle, submitLabel, notice, footer }: PhoneAuthCardProps) {
  const { data: config } = useConfig();
  const [secret, setSecret] = useState('');
  const passwordMode = auth.step === 'password';
  const codeSent = auth.step === 'otp';

  const next = () => {
    if (auth.step === 'phone') void auth.requestCode();
    else if (codeSent) void auth.verifyCode(secret);
    else void auth.submitPassword(secret);
  };
  const input =
    'peer w-full rounded-md border border-gm-line bg-transparent px-3.5 pt-5 pb-2 text-base outline-none focus:border-gm-blue focus:ring-1 focus:ring-gm-blue disabled:opacity-50';
  const floatLabel = 'pointer-events-none absolute top-1.5 left-3.5 text-xs text-gm-muted peer-focus:text-gm-blue';

  return (
    <div className="flex min-h-full items-center justify-center bg-gm-bg p-4 font-google text-gm-text">
      <form
        className="grid w-full max-w-4xl gap-8 rounded-[28px] bg-gm-surface p-8 sm:p-10 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          next();
          if (auth.step !== 'phone') setSecret('');
        }}
      >
        <div>
          <img src="/icon.svg" alt="Dialox" className="h-12 w-12 rounded-xl" />
          <h1 className="mt-6 text-4xl font-normal">{title}</h1>
          <p className="mt-4 text-base text-gm-muted">{subtitle}</p>
          {config && <p className="mt-2 text-sm text-gm-muted">Your address: number@{config.mailDomain}</p>}
        </div>
        <div className="flex flex-col gap-4 pt-2 md:pt-16">
          {notice}
          <label className="relative block">
            <input
              value={auth.phone}
              onChange={(e) => auth.setPhone(e.target.value)}
              disabled={auth.step !== 'phone' || auth.busy}
              inputMode="tel"
              autoComplete="tel"
              placeholder=" "
              required
              className={input}
            />
            <span className={floatLabel}>Phone number</span>
          </label>
          <label className="relative block">
            <input
              value={secret}
              onChange={(e) => setSecret(passwordMode ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={auth.step === 'phone' || auth.busy}
              type={passwordMode ? 'password' : 'text'}
              inputMode={passwordMode ? 'text' : 'numeric'}
              autoComplete={passwordMode ? 'current-password' : 'one-time-code'}
              placeholder=" "
              className={input}
            />
            <span className={floatLabel}>{passwordMode ? 'Password (min. 8 characters)' : 'OTP'}</span>
          </label>
          <p className="min-h-5 text-sm text-gm-muted">
            {codeSent && `Code sent by SMS to ${auth.phone}.`}
            {passwordMode && 'OTP delivery is unavailable, so enter a password. New numbers create an account with it.'}
          </p>
          {auth.error && <p className="text-sm text-red-600 dark:text-red-400">{auth.error}</p>}
          {auth.step !== 'phone' && (
            <button type="button" onClick={auth.back} className="self-start text-sm font-medium text-gm-blue">
              Use a different number
            </button>
          )}
          <p className="mt-4 text-sm text-gm-muted">
            By signing up, you agree to the{' '}
            <Link to="/terms" target="_blank" className="font-medium text-gm-blue underline">
              Terms of Service
            </Link>
          </p>
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm">{footer}</div>
            <button
              type="submit"
              disabled={auth.busy || !auth.phone || (auth.step !== 'phone' && !secret)}
              className="rounded-full bg-gm-blue px-6 py-2.5 text-sm font-medium text-white hover:shadow-md disabled:opacity-50"
            >
              {auth.busy ? 'Please wait...' : auth.step === 'phone' ? 'Next' : submitLabel}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
