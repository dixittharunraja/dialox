import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { SurfaceContext, useToken } from '@/lib/api';
import { setLanguage } from '@/lib/i18n';
import { useMe } from '@/lib/queries';
import { useMailboxSync } from '@/lib/realtime';
import { useThemePreference } from '@/lib/theme';
import { Chat } from './chat/Chat';
import { Composer } from './compose/Composer';
import { FolderView } from './home/FolderView';
import { Home } from './home/Home';
import { Onboarding } from './onboarding/Onboarding';
import { ProfileSetup } from './onboarding/ProfileSetup';
import { Profile } from './profile/Profile';
import { Reader } from './reader/Reader';
import { ToastProvider } from './ui';

/** Phone-width column: full screen on phones, a centred device frame on larger screens. */
function DeviceFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full justify-center bg-wa-panel-2 sm:py-6">
      <div className="relative h-full w-full max-w-[440px] overflow-hidden bg-wa-panel sm:rounded-[28px] sm:shadow-2xl sm:ring-1 sm:ring-black/10">
        <ToastProvider>{children}</ToastProvider>
      </div>
    </div>
  );
}

function Mailbox() {
  const { data: me } = useMe();
  useMailboxSync();
  useThemePreference(me?.theme);
  useEffect(() => {
    if (me) setLanguage(me.language);
  }, [me]);

  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path="setup" element={<ProfileSetup />} />
      <Route path="chat/:id" element={<Chat />} />
      <Route path="compose" element={<Composer />} />
      <Route path="mail/:id" element={<Reader />} />
      <Route path="folder/:name" element={<FolderView />} />
      <Route path="profile" element={<Profile />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function MobileApp() {
  const token = useToken('mobile');
  return (
    <SurfaceContext.Provider value="mobile">
      <DeviceFrame>{token ? <Mailbox /> : <Onboarding />}</DeviceFrame>
    </SurfaceContext.Provider>
  );
}
