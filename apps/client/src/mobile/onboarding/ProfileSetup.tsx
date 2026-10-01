import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useT } from '@/lib/i18n';
import { useMe, useUpdateProfile } from '@/lib/queries';
import { usePermissionPrompt } from '../permissions';
import { AvatarPicker } from '../profile/AvatarPicker';
import { PrimaryButton } from '../ui';

/** Final onboarding screen for new accounts, followed by the contacts/notification prompts. */
export function ProfileSetup() {
  const t = useT();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const update = useUpdateProfile();
  const permissions = usePermissionPrompt();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);

  const finish = async () => {
    await update.mutateAsync({ displayName: name.trim(), avatarUrl: avatar ?? me?.avatarUrl ?? null });
    await permissions.ask('contacts');
    await permissions.ask('notifications');
    navigate('/', { replace: true });
  };

  return (
    <div className="relative flex h-full flex-col items-center bg-wa-panel px-6 pt-14 pb-8 text-center text-wa-text">
      <h1 className="text-xl font-medium text-wa-accent">{t('profileInfo')}</h1>
      <p className="mt-4 max-w-72 text-sm text-wa-muted">{t('profileHint')}</p>
      <div className="mt-8">
        <AvatarPicker name={name} src={avatar ?? me?.avatarUrl ?? null} onChange={setAvatar} />
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        autoFocus
        placeholder={t('yourName')}
        className="mt-8 w-72 border-b-2 border-wa-accent bg-transparent pb-1 text-[17px] outline-none placeholder:text-wa-muted"
      />
      <p className="mt-3 text-xs text-wa-muted">{me?.address}</p>
      <div className="mt-auto">
        <PrimaryButton onClick={() => void finish()} disabled={!name.trim() || update.isPending}>
          {t('next')}
        </PrimaryButton>
      </div>
      {permissions.element}
    </div>
  );
}
