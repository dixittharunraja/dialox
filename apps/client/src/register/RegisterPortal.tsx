import { formatPhone } from '@dialox/shared';
import { CheckCircle2, MessageSquareText, PhoneCall } from 'lucide-react';
import { useState } from 'react';
import { PhoneAuthCard } from '@/components/PhoneAuthCard';
import { useConfig } from '@/lib/queries';
import { useThemePreference } from '@/lib/theme';
import { usePhoneAuth } from '@/lib/use-phone-auth';

/**
 * Registration-only portal: phone + OTP (or password fallback). It never signs anyone in, and
 * after each account is created the fields reset for the next registration.
 */
export function RegisterPortal() {
  useThemePreference('system');
  const { data: config } = useConfig();
  const [created, setCreated] = useState<{ address: string; isNew: boolean } | null>(null);
  const auth = usePhoneAuth({
    mode: 'register',
    client: 'web',
    onRegistered: (result) => {
      setCreated({ address: result.address, isNew: result.created });
      auth.reset();
    },
  });

  const notice = created && (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl bg-[#e6f4ea] p-4 text-sm text-[#0d652d] dark:bg-[#0d652d]/30 dark:text-[#a8dab5]"
    >
      <CheckCircle2 size={20} className="shrink-0" />
      <span>
        {created.isNew ? 'Account created: ' : 'This number is already registered: '}
        <strong>{created.address}</strong>. Ready for the next registration.
      </span>
    </div>
  );

  return (
    <PhoneAuthCard
      auth={auth}
      title="Create a Dialox account"
      subtitle="Register a phone number to start receiving email at it. This portal only creates accounts."
      submitLabel="Create account"
      notice={notice}
      footer={
        config && (
          <span className="flex flex-col gap-1 text-gm-muted">
            <span className="flex items-center gap-2">
              <PhoneCall size={14} /> Call {formatPhone(config.tollFreeNumber)} and press 1
            </span>
            <span className="flex items-center gap-2">
              <MessageSquareText size={14} /> or text START to it
            </span>
          </span>
        )
      }
    />
  );
}
