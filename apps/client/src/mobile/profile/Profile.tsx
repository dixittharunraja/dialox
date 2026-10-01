import type { ProfileInput, ThemePreference } from '@dialox/shared';
import {
  AtSign,
  Copy,
  Globe,
  Info,
  KeyRound,
  LogOut,
  Moon,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { formatPhone } from '@dialox/shared';
import { LANGUAGES, setLanguage, useT } from '@/lib/i18n';
import {
  useAliases,
  useChangePassword,
  useCreateAlias,
  useDeleteAlias,
  useLogout,
  useMe,
  useUpdateProfile,
} from '@/lib/queries';
import { IconButton, TopBar, useToast } from '../ui';
import { AvatarPicker } from './AvatarPicker';

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="border-b-8 border-wa-panel-2 py-2">
      {title && <h2 className="px-5 pt-2 pb-1 text-sm font-medium text-wa-accent">{title}</h2>}
      {children}
    </section>
  );
}

function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-5 px-5 py-3">
      <Icon size={22} className="shrink-0 text-wa-muted" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-wa-muted">{label}</p>
        {children}
      </div>
    </div>
  );
}

function EditableRow({
  icon,
  label,
  value,
  onSave,
  maxLength,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onSave: (v: string) => void;
  maxLength: number;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Row icon={icon} label={label}>
      {editing === null ? (
        <div className="flex items-center gap-2">
          <p className="flex-1 truncate text-[16px]">{value || '-'}</p>
          <IconButton
            icon={Pencil}
            label={`Edit ${label}`}
            size={18}
            className="text-wa-accent"
            onClick={() => setEditing(value)}
          />
        </div>
      ) : (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(editing.trim());
            setEditing(null);
          }}
        >
          <input
            autoFocus
            value={editing}
            maxLength={maxLength}
            onChange={(e) => setEditing(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
            className="min-w-0 flex-1 border-b-2 border-wa-accent bg-transparent py-1 text-[16px] outline-none"
          />
          <button type="submit" className="text-sm font-medium text-wa-accent">
            OK
          </button>
        </form>
      )}
    </Row>
  );
}

function AliasSection() {
  const t = useT();
  const toast = useToast();
  const { data: aliases = [] } = useAliases();
  const create = useCreateAlias();
  const remove = useDeleteAlias();
  const [name, setName] = useState('');
  return (
    <Section title={t('aliases')}>
      <p className="px-5 pb-2 text-xs text-wa-muted">{t('aliasHint')}</p>
      <ul>
        {aliases.map((alias) => (
          <li key={alias.id} className="flex items-center gap-5 py-1 pr-3 pl-5">
            <AtSign size={20} className="shrink-0 text-wa-muted" />
            <span className="flex-1 truncate text-[15px]">{alias.address}</span>
            <IconButton icon={Trash2} label={t('delete')} size={18} onClick={() => remove.mutate(alias.id)} />
          </li>
        ))}
      </ul>
      <form
        className="flex items-center gap-3 px-5 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(name, {
            onSuccess: () => setName(''),
            onError: (error) => toast(error.message),
          });
        }}
      >
        <Plus size={20} className="shrink-0 text-wa-muted" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          placeholder="work"
          maxLength={24}
          aria-label={t('addAlias')}
          className="min-w-0 flex-1 border-b border-wa-line bg-transparent py-1 text-[15px] outline-none focus:border-wa-accent"
        />
        <button
          type="submit"
          disabled={name.length < 2}
          className="text-sm font-medium text-wa-accent disabled:opacity-40"
        >
          {t('addAlias')}
        </button>
      </form>
    </Section>
  );
}

function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const t = useT();
  const toast = useToast();
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const input = 'w-full border-b border-wa-line bg-transparent py-1.5 text-[15px] outline-none focus:border-wa-accent';
  return (
    <Section title={t('security')}>
      <form
        className="space-y-2 px-5 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate(
            { current: current || undefined, next },
            {
              onSuccess: () => {
                setCurrent('');
                setNext('');
                toast(t('saved'));
              },
              onError: (error) => toast(error.message),
            },
          );
        }}
      >
        {!hasPassword && <p className="text-xs text-wa-muted">{t('setPassword')}</p>}
        {hasPassword && (
          <input
            type="password"
            autoComplete="current-password"
            placeholder={t('currentPassword')}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={input}
          />
        )}
        <input
          type="password"
          autoComplete="new-password"
          placeholder={t('newPassword')}
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className={input}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={next.length < 8 || change.isPending}
            className="flex items-center gap-2 py-1 text-sm font-medium text-wa-accent disabled:opacity-40"
          >
            <KeyRound size={16} />
            {t('save')}
          </button>
        </div>
      </form>
    </Section>
  );
}

export function Profile() {
  const t = useT();
  const toast = useToast();
  const { data: me } = useMe();
  const update = useUpdateProfile();
  const logout = useLogout();
  if (!me) return <div className="h-full bg-wa-panel" />;

  const save = (patch: ProfileInput) =>
    update.mutate(patch, { onSuccess: () => toast(t('saved')), onError: (e) => toast(e.message) });
  const select = 'mt-0.5 w-full bg-transparent text-[16px] outline-none';

  return (
    <div className="flex h-full flex-col bg-wa-panel text-wa-text">
      <TopBar title={t('profile')} back="/" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex justify-center py-6">
          <AvatarPicker
            name={me.displayName}
            src={me.avatarUrl}
            onChange={(avatarUrl) => save({ avatarUrl })}
            size={140}
          />
        </div>
        <Section>
          <EditableRow
            icon={UserRound}
            label={t('name')}
            value={me.displayName}
            maxLength={60}
            onSave={(displayName) => save({ displayName })}
          />
          <EditableRow
            icon={Info}
            label={t('about')}
            value={me.about}
            maxLength={140}
            onSave={(about) => save({ about })}
          />
          <Row icon={Phone} label={t('phone')}>
            <p className="text-[16px]">{formatPhone(me.phone)}</p>
          </Row>
          <Row icon={AtSign} label={t('emailAddress')}>
            <div className="flex items-center gap-2">
              <p className="flex-1 truncate text-[16px]">{me.address}</p>
              <IconButton
                icon={Copy}
                label="Copy"
                size={18}
                onClick={() => void navigator.clipboard.writeText(me.address).then(() => toast(me.address))}
              />
            </div>
          </Row>
        </Section>
        <AliasSection />
        <Section>
          <Row icon={Globe} label={t('language')}>
            <select
              value={me.language}
              onChange={(e) => {
                setLanguage(e.target.value);
                save({ language: e.target.value as ProfileInput['language'] });
              }}
              className={select}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-wa-panel">
                  {lang.native}
                </option>
              ))}
            </select>
          </Row>
          <Row icon={Moon} label={t('theme')}>
            <select
              value={me.theme}
              onChange={(e) => save({ theme: e.target.value as ThemePreference })}
              className={select}
            >
              <option value="system" className="bg-wa-panel">
                {t('themeSystem')}
              </option>
              <option value="light" className="bg-wa-panel">
                {t('themeLight')}
              </option>
              <option value="dark" className="bg-wa-panel">
                {t('themeDark')}
              </option>
            </select>
          </Row>
        </Section>
        <PasswordSection hasPassword={me.hasPassword} />
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-5 px-5 py-4 text-[16px] text-red-500"
        >
          <LogOut size={22} />
          {t('logout')}
        </button>
      </div>
    </div>
  );
}
