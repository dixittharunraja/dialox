import { Check } from 'lucide-react';
import { Link } from 'react-router';
import { LANGUAGES, setLanguage, useLanguage, useT } from '@/lib/i18n';
import { PrimaryButton } from '../ui';

function Logo() {
  return <img src="/icon.svg" alt="" className="h-24 w-24 rounded-[28px] shadow-lg" />;
}

export function LanguageStep({ onNext }: { onNext: () => void }) {
  const t = useT();
  const language = useLanguage();
  return (
    <div className="flex h-full flex-col items-center px-6 pt-16 pb-8">
      <Logo />
      <h1 className="mt-8 text-2xl font-medium">{t('welcome')}</h1>
      <p className="mt-2 text-sm text-wa-muted">{t('chooseLanguage')}</p>
      <ul className="mt-6 w-full max-w-xs divide-y divide-wa-line" role="radiogroup">
        {LANGUAGES.map((lang) => (
          <li key={lang.code}>
            <button
              type="button"
              role="radio"
              aria-checked={language === lang.code}
              onClick={() => setLanguage(lang.code)}
              className="flex w-full items-center justify-between py-3.5 text-left"
            >
              <span>
                <span className="block text-[16px]">{lang.native}</span>
                <span className="text-xs text-wa-muted">{lang.label}</span>
              </span>
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                  language === lang.code ? 'border-wa-accent bg-wa-accent text-white' : 'border-wa-muted'
                }`}
              >
                {language === lang.code && <Check size={12} strokeWidth={4} />}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-auto">
        <PrimaryButton onClick={onNext}>{t('continue')}</PrimaryButton>
      </div>
    </div>
  );
}

export function TermsStep({ onNext }: { onNext: () => void }) {
  const t = useT();
  return (
    <div className="flex h-full flex-col items-center px-8 pt-16 pb-8 text-center">
      <h1 className="text-2xl font-medium text-wa-accent">{t('welcome')}</h1>
      <div className="my-auto flex h-56 w-56 items-center justify-center rounded-full bg-wa-panel-2">
        <Logo />
      </div>
      <p className="text-sm leading-relaxed text-wa-muted">
        {t('termsIntro')}{' '}
        <Link to="/terms" className="text-[#027eb5] dark:text-[#53bdeb]">
          {t('termsLink')}
        </Link>
        .
      </p>
      <div className="mt-8">
        <PrimaryButton onClick={onNext}>{t('agreeContinue')}</PrimaryButton>
      </div>
    </div>
  );
}
