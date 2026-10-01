import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useThemePreference } from '@/lib/theme';
import { usePhoneAuth } from '@/lib/use-phone-auth';
import { usePermissionPrompt } from '../permissions';
import { LanguageStep, TermsStep } from './IntroSteps';
import { OtpStep, PasswordStep } from './VerifySteps';
import { PhoneStep } from './PhoneStep';

type IntroStep = 'language' | 'terms';

/** WhatsApp-style onboarding: language, terms, phone (auto-detected), OTP (auto-detected). */
export function Onboarding() {
  const navigate = useNavigate();
  const [intro, setIntro] = useState<IntroStep | null>('language');
  const permissions = usePermissionPrompt();
  useThemePreference('system');
  const auth = usePhoneAuth({
    mode: 'login',
    client: 'mobile',
    onLogin: (result) => navigate(result.isNew ? '/setup' : '/', { replace: true }),
  });

  let content;
  if (intro === 'language') content = <LanguageStep onNext={() => setIntro('terms')} />;
  else if (intro === 'terms') content = <TermsStep onNext={() => setIntro(null)} />;
  else if (auth.step === 'phone') content = <PhoneStep auth={auth} askPermission={permissions.ask} />;
  else if (auth.step === 'otp') content = <OtpStep auth={auth} askPermission={permissions.ask} />;
  else content = <PasswordStep auth={auth} />;

  return (
    <div className="relative h-full bg-wa-panel text-wa-text">
      {content}
      {permissions.element}
    </div>
  );
}
