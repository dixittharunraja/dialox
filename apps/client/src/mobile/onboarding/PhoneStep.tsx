import { countryDialCodes, formatPhone, normalizePhone, splitPhone } from '@dialox/shared';
import { useEffect, useMemo, useState } from 'react';
import { detectedPhone, rememberDevicePhone } from '@/lib/device';
import { useLanguage, useT } from '@/lib/i18n';
import { useConfig } from '@/lib/queries';
import type { usePhoneAuth } from '@/lib/use-phone-auth';
import type { Permission } from '../permissions';
import { Dialog, DialogActions, PrimaryButton, TextButton } from '../ui';

export interface StepProps {
  auth: ReturnType<typeof usePhoneAuth>;
  askPermission: (permission: Permission) => Promise<boolean>;
}

export function PhoneStep({ auth, askPermission }: StepProps) {
  const t = useT();
  const language = useLanguage();
  const { data: config } = useConfig();
  const [country, setCountry] = useState('');
  const [national, setNational] = useState('');
  const [autoFilled, setAutoFilled] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([language], { type: 'region' });
    return countryDialCodes()
      .map((c) => ({ ...c, name: names.of(c.country) ?? c.country }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [language]);

  // Ask for the phone permission first, then pre-fill from the (virtual) SIM.
  useEffect(() => {
    let cancelled = false;
    void askPermission('phone').then((granted) => {
      const detected = granted ? detectedPhone() : null;
      const parts = detected ? splitPhone(detected) : null;
      if (cancelled || !parts) return;
      setCountry(parts.country);
      setNational(parts.national);
      setAutoFilled(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ask once on entering the step
  }, []);

  const selectedCountry = country || config?.defaultCountry || 'IN';
  const dial = countries.find((c) => c.country === selectedCountry)?.dial ?? '';
  const e164 = normalizePhone(`+${dial}${national}`, selectedCountry);

  const submit = () => {
    if (!e164) return;
    auth.setPhone(e164);
    rememberDevicePhone(e164);
    setConfirming(false);
    void auth.requestCode(e164);
  };

  return (
    <form
      className="flex h-full flex-col items-center px-6 pt-14 pb-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (e164) setConfirming(true);
      }}
    >
      <h1 className="text-xl font-medium text-wa-accent">{t('enterPhone')}</h1>
      <p className="mt-4 max-w-72 text-center text-sm text-wa-muted">{t('phoneHint')}</p>

      <div className="mt-8 w-full max-w-72">
        <label className="block border-b-2 border-wa-accent pb-1">
          <span className="sr-only">{t('country')}</span>
          <select
            value={selectedCountry}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full bg-transparent py-1 text-center text-[16px] outline-none"
          >
            {countries.map((c) => (
              <option key={c.country} value={c.country} className="bg-wa-panel">
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 flex gap-3">
          <span className="w-20 border-b-2 border-wa-accent pb-1 text-center text-[17px]">+{dial}</span>
          <input
            aria-label={t('phone')}
            value={national}
            onChange={(e) => {
              setNational(e.target.value.replace(/[^\d]/g, ''));
              setAutoFilled(false);
            }}
            inputMode="tel"
            autoComplete="tel-national"
            placeholder={t('phone')}
            className="min-w-0 flex-1 border-b-2 border-wa-accent bg-transparent pb-1 text-[17px] tracking-wide outline-none placeholder:text-wa-muted"
          />
        </div>
        {autoFilled && <p className="mt-2 text-xs text-wa-accent">{t('detected')}</p>}
        {auth.error && <p className="mt-3 text-sm text-red-500">{auth.error}</p>}
      </div>

      <div className="mt-auto">
        <PrimaryButton type="submit" disabled={!e164 || auth.busy}>
          {t('next')}
        </PrimaryButton>
      </div>

      <Dialog open={confirming}>
        <p className="text-[15px] text-wa-muted">{t('verifyTitle')}:</p>
        <p className="mt-2 text-xl font-medium">{e164 ? formatPhone(e164) : ''}</p>
        <DialogActions>
          <TextButton onClick={() => setConfirming(false)}>{t('wrongNumber')}</TextButton>
          <TextButton onClick={submit}>{t('next')}</TextButton>
        </DialogActions>
      </Dialog>
    </form>
  );
}
