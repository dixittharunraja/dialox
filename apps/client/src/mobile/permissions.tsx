import { Bell, Contact, MessageSquareText, Smartphone, type LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useT } from '@/lib/i18n';
import { Dialog, DialogActions, TextButton } from './ui';

export type Permission = 'phone' | 'sms' | 'contacts' | 'notifications';

const META: Record<
  Permission,
  { icon: LucideIcon; text: 'permPhone' | 'permSms' | 'permContacts' | 'permNotifications' }
> = {
  phone: { icon: Smartphone, text: 'permPhone' },
  sms: { icon: MessageSquareText, text: 'permSms' },
  contacts: { icon: Contact, text: 'permContacts' },
  notifications: { icon: Bell, text: 'permNotifications' },
};

const storageKey = (p: Permission) => `dialox.permission.${p}`;

export function isGranted(permission: Permission): boolean {
  try {
    return localStorage.getItem(storageKey(permission)) === 'granted';
  } catch {
    return false;
  }
}

function remember(permission: Permission, granted: boolean) {
  try {
    localStorage.setItem(storageKey(permission), granted ? 'granted' : 'denied');
  } catch {
    // Without storage the prompt simply shows again next time.
  }
}

/**
 * Android-style runtime permission prompts, asked at the onboarding step that needs them.
 * Where the browser has a real permission (notifications) it is requested on "Allow"; the
 * others gate the matching web capability (WebOTP, Contact Picker, device number detection).
 */
export function usePermissionPrompt() {
  const t = useT();
  const [pending, setPending] = useState<Permission | null>(null);
  const resolver = useRef<(granted: boolean) => void>(() => undefined);

  const ask = (permission: Permission) =>
    new Promise<boolean>((resolve) => {
      if (isGranted(permission)) return resolve(true);
      resolver.current = resolve;
      setPending(permission);
    });

  const answer = async (granted: boolean) => {
    const permission = pending!;
    let result = granted;
    if (granted && permission === 'notifications' && 'Notification' in window) {
      result = (await Notification.requestPermission()) === 'granted';
    }
    remember(permission, result);
    setPending(null);
    resolver.current(result);
  };

  const meta = pending ? META[pending] : null;
  const element = (
    <Dialog open={!!pending}>
      {meta && (
        <>
          <meta.icon className="mx-auto text-wa-accent" size={30} />
          <p className="mt-4 text-center text-[17px] leading-snug">{t(meta.text)}</p>
          <DialogActions>
            <TextButton onClick={() => void answer(false)}>{t('deny')}</TextButton>
            <TextButton onClick={() => void answer(true)}>{t('allow')}</TextButton>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
  return { ask, element };
}
