import { formatPhone, type ProfileInput, type ThemePreference } from '@dialox/shared';
import { Camera, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Avatar } from '@/components/Avatar';
import { avatarDataUrl } from '@/lib/files';
import { fullDate } from '@/lib/format';
import { LANGUAGES } from '@/lib/i18n';
import { useAliases, useChangePassword, useCreateAlias, useDeleteAlias, useMe, useUpdateProfile } from '@/lib/queries';

const TABS = ['General', 'Signature', 'Aliases', 'Security', 'Account'] as const;
type Tab = (typeof TABS)[number];

const field =
  'w-full rounded-md border border-gm-line bg-transparent px-3 py-2 text-sm outline-none focus:border-gm-blue';
const primary = 'rounded-full bg-gm-blue px-5 py-2 text-sm font-medium text-white disabled:opacity-50';

function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-gm-line py-5 sm:grid-cols-[12rem_1fr]">
      <span className="text-sm font-medium">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function GeneralTab() {
  const { data: me } = useMe();
  const update = useUpdateProfile();
  const photo = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ displayName: me?.displayName ?? '', about: me?.about ?? '' });
  if (!me) return null;
  const save = (patch: ProfileInput) => update.mutate(patch);
  return (
    <>
      <Setting label="Profile picture">
        <div className="flex items-center gap-4">
          <Avatar name={me.displayName || me.address} src={me.avatarUrl} size={64} variant="gm" />
          <button
            type="button"
            onClick={() => photo.current?.click()}
            className="flex items-center gap-2 rounded-full border border-gm-line px-4 py-1.5 text-sm hover:bg-gm-hover"
          >
            <Camera size={16} /> Change
          </button>
          {me.avatarUrl && (
            <button
              type="button"
              onClick={() => save({ avatarUrl: null })}
              className="text-sm text-gm-muted hover:underline"
            >
              Remove
            </button>
          )}
          <input
            ref={photo}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) save({ avatarUrl: await avatarDataUrl(file) });
              e.target.value = '';
            }}
          />
        </div>
      </Setting>
      <Setting label="Name & about">
        <form
          className="grid max-w-md gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save(form);
          }}
        >
          <input
            className={field}
            placeholder="Display name"
            maxLength={60}
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
          <input
            className={field}
            placeholder="About"
            maxLength={140}
            value={form.about}
            onChange={(e) => setForm({ ...form, about: e.target.value })}
          />
          <div>
            <button type="submit" className={primary} disabled={update.isPending}>
              Save changes
            </button>
          </div>
        </form>
      </Setting>
      <Setting label="Language">
        <select
          className={`${field} max-w-xs`}
          value={me.language}
          onChange={(e) => save({ language: e.target.value as ProfileInput['language'] })}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code} className="bg-gm-surface">
              {l.native} ({l.label})
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-gm-muted">Applies to the mobile app and to date formats.</p>
      </Setting>
      <Setting label="Theme">
        <div className="flex gap-2">
          {(['system', 'light', 'dark'] as ThemePreference[]).map((theme) => (
            <button
              key={theme}
              type="button"
              aria-pressed={me.theme === theme}
              onClick={() => save({ theme })}
              className={`rounded-full border px-4 py-1.5 text-sm capitalize ${me.theme === theme ? 'border-gm-blue bg-gm-active' : 'border-gm-line hover:bg-gm-hover'}`}
            >
              {theme}
            </button>
          ))}
        </div>
      </Setting>
    </>
  );
}

function SignatureTab() {
  const { data: me } = useMe();
  const update = useUpdateProfile();
  const [signature, setSignature] = useState(me?.signature ?? '');
  return (
    <Setting label="Signature">
      <p className="mb-2 text-xs text-gm-muted">Appended to new messages you compose on the web.</p>
      <textarea
        className={`${field} min-h-32`}
        maxLength={2000}
        value={signature}
        onChange={(e) => setSignature(e.target.value)}
      />
      <button
        type="button"
        className={`${primary} mt-3`}
        disabled={update.isPending}
        onClick={() => update.mutate({ signature })}
      >
        {update.isSuccess ? 'Saved' : 'Save signature'}
      </button>
    </Setting>
  );
}

function AliasesTab() {
  const { data: aliases = [] } = useAliases();
  const create = useCreateAlias();
  const remove = useDeleteAlias();
  const [name, setName] = useState('');
  return (
    <Setting label="Alias IDs">
      <p className="mb-3 text-xs text-gm-muted">
        Extra addresses that deliver to this inbox. You can send from them too (up to 5).
      </p>
      <ul className="mb-4 divide-y divide-gm-line rounded-lg border border-gm-line">
        {aliases.length === 0 && <li className="px-4 py-3 text-sm text-gm-muted">No aliases yet.</li>}
        {aliases.map((alias) => (
          <li key={alias.id} className="flex items-center justify-between px-4 py-2 text-sm">
            {alias.address}
            <button
              type="button"
              aria-label={`Delete ${alias.address}`}
              onClick={() => remove.mutate(alias.id)}
              className="rounded-full p-1.5 text-gm-muted hover:bg-gm-hover"
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(name, { onSuccess: () => setName('') });
        }}
      >
        <input
          className={field}
          placeholder="work"
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
        />
        <button type="submit" className={primary} disabled={name.length < 2 || create.isPending}>
          Add
        </button>
      </form>
      {create.error && <p className="mt-2 text-xs text-red-500">{create.error.message}</p>}
    </Setting>
  );
}

function SecurityTab() {
  const { data: me } = useMe();
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  return (
    <Setting label="Password">
      <p className="mb-3 text-xs text-gm-muted">
        {me?.hasPassword
          ? 'Change the password used when OTP delivery is unavailable.'
          : 'Set a password so you can sign in when OTP delivery is unavailable.'}
      </p>
      <form
        className="grid max-w-md gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate(
            { current: current || undefined, next },
            {
              onSuccess: () => {
                setCurrent('');
                setNext('');
              },
            },
          );
        }}
      >
        {me?.hasPassword && (
          <input
            type="password"
            autoComplete="current-password"
            className={field}
            placeholder="Current password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        )}
        <input
          type="password"
          autoComplete="new-password"
          minLength={8}
          className={field}
          placeholder="New password (min. 8 characters)"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <div>
          <button type="submit" className={primary} disabled={next.length < 8 || change.isPending}>
            Update password
          </button>
        </div>
        {change.error && <p className="text-xs text-red-500">{change.error.message}</p>}
        {change.isSuccess && <p className="text-xs text-[#188038]">Password updated.</p>}
      </form>
    </Setting>
  );
}

function AccountTab() {
  const { data: me } = useMe();
  if (!me) return null;
  const rows: [string, string][] = [
    ['Email address', me.address],
    ['Phone number', formatPhone(me.phone)],
    ['Registered via', me.registeredVia.toUpperCase()],
    ['Member since', fullDate(me.createdAt, navigator.language)],
  ];
  return (
    <>
      {rows.map(([label, value]) => (
        <Setting key={label} label={label}>
          <span className="text-sm">{value}</span>
        </Setting>
      ))}
    </>
  );
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('General');
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-gm-surface font-google text-gm-text shadow-2xl"
      >
        <header className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-2xl">Settings</h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="rounded-full p-2 hover:bg-gm-hover"
          >
            <X size={20} />
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-gm-line px-4" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`border-b-[3px] px-4 py-3 text-sm font-medium ${tab === t ? 'border-gm-blue text-gm-blue' : 'border-transparent text-gm-muted hover:text-gm-text'}`}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          {tab === 'General' && <GeneralTab />}
          {tab === 'Signature' && <SignatureTab />}
          {tab === 'Aliases' && <AliasesTab />}
          {tab === 'Security' && <SecurityTab />}
          {tab === 'Account' && <AccountTab />}
        </div>
      </div>
    </div>
  );
}
