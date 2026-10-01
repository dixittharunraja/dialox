import { formatPhone, type SmsLog } from '@dialox/shared';
import { MessageSquareText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { request } from '@/lib/api';
import { listenForWebOtp } from '@/lib/device';
import { useT } from '@/lib/i18n';
import { useConfig } from '@/lib/queries';
import { useSmsFeed } from '@/lib/realtime';
import type { usePhoneAuth } from '@/lib/use-phone-auth';
import { PrimaryButton } from '../ui';
import type { StepProps } from './PhoneStep';

const RESEND_SECONDS = 60;

export function OtpStep({ auth, askPermission }: StepProps) {
  const t = useT();
  const { data: config } = useConfig();
  const [code, setCode] = useState('');
  const [smsAllowed, setSmsAllowed] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);
  const [remaining, setRemaining] = useState(RESEND_SECONDS);
  const submitted = useRef('');

  useEffect(() => {
    void askPermission('sms').then(setSmsAllowed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ask once on entering the step
  }, []);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const fill = (value: string, detected = false) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    setAutoDetected(detected);
    if (digits.length === 6 && submitted.current !== digits) {
      submitted.current = digits;
      void auth.verifyCode(digits);
    }
  };

  // Real devices: WebOTP reads the SMS. Simulator mode: the virtual device's inbox is watched.
  useEffect(() => {
    if (!smsAllowed) return;
    const controller = new AbortController();
    void listenForWebOtp(controller.signal).then((otp) => otp && fill(otp, true));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when permission changes
  }, [smsAllowed]);

  const simulated = smsAllowed && config?.otpDelivery === 'simulator';
  const readOtp = (log: SmsLog) => {
    const otp = log.direction === 'outbound' ? log.body.match(/\b(\d{6})\b/)?.[1] : undefined;
    if (otp) setTimeout(() => fill(otp, true), 700);
  };
  useSmsFeed(simulated, auth.phone, readOtp);
  // The code usually lands before the SMS permission is granted, so read the latest one too.
  useEffect(() => {
    if (!simulated) return;
    void request<SmsLog[]>(`/api/simulator/sms?phone=${encodeURIComponent(auth.phone)}`).then((logs) => {
      const latest = logs.find((l) => l.direction === 'outbound' && /verification code/.test(l.body));
      if (latest && Date.now() - Date.parse(latest.createdAt) < 5 * 60_000) readOtp(latest);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one backfill when auto-read turns on
  }, [simulated]);

  return (
    <div className="flex h-full flex-col items-center px-6 pt-14 pb-8 text-center">
      <h1 className="text-xl font-medium text-wa-accent">{t('verifyTitle')}</h1>
      <p className="mt-4 max-w-72 text-sm text-wa-muted">
        {t('waitingSms')} <span className="font-medium text-wa-text">{formatPhone(auth.phone)}</span>.{' '}
        <button type="button" onClick={auth.back} className="text-[#027eb5] dark:text-[#53bdeb]">
          {t('wrongNumber')}
        </button>
      </p>

      <input
        aria-label={t('codeHint')}
        value={code}
        onChange={(e) => fill(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        placeholder="— — —  — — —"
        className="mt-8 w-52 border-b-2 border-wa-accent bg-transparent pb-1 text-center text-2xl tracking-[0.4em] outline-none placeholder:text-base placeholder:tracking-normal placeholder:text-wa-muted"
      />
      <p className="mt-3 text-sm text-wa-muted">{autoDetected ? t('autoDetected') : t('codeHint')}</p>
      {auth.error && <p className="mt-3 text-sm text-red-500">{auth.error}</p>}
      {auth.busy && (
        <div className="mt-6 h-8 w-8 animate-spin rounded-full border-4 border-wa-accent border-t-transparent" />
      )}

      <div className="mt-10 w-full max-w-72 border-t border-wa-line pt-4">
        <button
          type="button"
          disabled={remaining > 0 || auth.busy}
          onClick={() => {
            setRemaining(RESEND_SECONDS);
            void auth.requestCode();
          }}
          className="flex items-center gap-4 text-sm text-wa-accent disabled:text-wa-muted"
        >
          <MessageSquareText size={20} />
          {remaining > 0 ? `${t('resendIn')} ${remaining}s` : t('resend')}
        </button>
        <button type="button" onClick={auth.usePassword} className="mt-4 text-sm text-wa-muted underline">
          {t('password')}
        </button>
      </div>
    </div>
  );
}

export function PasswordStep({ auth }: { auth: ReturnType<typeof usePhoneAuth> }) {
  const t = useT();
  const [password, setPassword] = useState('');
  return (
    <form
      className="flex h-full flex-col items-center px-6 pt-14 pb-8 text-center"
      onSubmit={(e) => {
        e.preventDefault();
        void auth.submitPassword(password);
      }}
    >
      <h1 className="text-xl font-medium text-wa-accent">{t('passwordTitle')}</h1>
      <p className="mt-2 text-[15px] font-medium">{formatPhone(auth.phone)}</p>
      <p className="mt-4 max-w-72 text-sm text-wa-muted">{t('passwordHint')}</p>
      <input
        type="password"
        aria-label={t('password')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        minLength={8}
        autoFocus
        placeholder={t('password')}
        className="mt-8 w-64 border-b-2 border-wa-accent bg-transparent pb-1 text-center text-lg outline-none placeholder:text-wa-muted"
      />
      {auth.error && <p className="mt-3 max-w-72 text-sm text-red-500">{auth.error}</p>}
      <button type="button" onClick={auth.back} className="mt-4 text-sm text-[#027eb5] dark:text-[#53bdeb]">
        {t('wrongNumber')}
      </button>
      <div className="mt-auto">
        <PrimaryButton type="submit" disabled={password.length < 8 || auth.busy}>
          {t('next')}
        </PrimaryButton>
      </div>
    </form>
  );
}
