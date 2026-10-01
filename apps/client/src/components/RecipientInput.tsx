import { toAddress } from '@dialox/shared';
import { Lock, X } from 'lucide-react';
import { useState } from 'react';
import { useDisplayName } from '@/lib/format';
import { useConfig } from '@/lib/queries';

interface RecipientInputProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  locked?: boolean;
  lockedHint?: string;
  tone: 'wa' | 'gm';
  autoFocus?: boolean;
}

/** Chip input accepting phone numbers or email addresses; commits on Enter, comma, space or blur. */
export function RecipientInput({ label, value, onChange, locked, lockedHint, tone, autoFocus }: RecipientInputProps) {
  const { data: config } = useConfig();
  const displayName = useDisplayName();
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);

  const commit = () => {
    const entry = draft.trim().replace(/[,;]$/, '');
    if (!entry || !config) return;
    const address = toAddress(entry, config.mailDomain, config.defaultCountry);
    if (!address) return setInvalid(true);
    if (!value.includes(address)) onChange([...value, address]);
    setDraft('');
    setInvalid(false);
  };

  const chip = tone === 'wa' ? 'bg-wa-panel-2 text-wa-text' : 'bg-gm-hover text-gm-text';
  const muted = tone === 'wa' ? 'text-wa-muted' : 'text-gm-muted';

  return (
    <div className="flex min-h-11 items-center gap-2 py-1">
      <span className={`w-10 shrink-0 text-sm ${muted}`}>{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {value.map((address) => (
          <span
            key={address}
            title={address}
            className={`flex max-w-full items-center gap-1 rounded-full py-0.5 pr-1.5 pl-2.5 text-sm ${chip}`}
          >
            <span className="truncate">{displayName(address)}</span>
            {!locked && (
              <button
                type="button"
                aria-label={`Remove ${address}`}
                onClick={() => onChange(value.filter((a) => a !== address))}
              >
                <X size={13} />
              </button>
            )}
          </span>
        ))}
        {locked ? (
          <span className={`flex items-center gap-1 text-xs ${muted}`} title={lockedHint}>
            <Lock size={12} />
            {lockedHint}
          </span>
        ) : (
          <input
            aria-label={label}
            value={draft}
            autoFocus={autoFocus}
            onChange={(e) => {
              setDraft(e.target.value);
              setInvalid(false);
            }}
            onKeyDown={(e) => {
              if (['Enter', ',', ';', ' '].includes(e.key) && draft.trim()) {
                e.preventDefault();
                commit();
              } else if (e.key === 'Backspace' && !draft && value.length) {
                onChange(value.slice(0, -1));
              }
            }}
            onBlur={commit}
            inputMode="email"
            className={`min-w-24 flex-1 bg-transparent py-1 text-[15px] outline-none ${invalid ? 'text-red-500 underline decoration-wavy' : ''}`}
          />
        )}
      </div>
    </div>
  );
}
