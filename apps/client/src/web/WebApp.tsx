import { createContext, useContext, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { SurfaceContext, useToken } from '@/lib/api';
import { useMe } from '@/lib/queries';
import { useMailboxSync } from '@/lib/realtime';
import { useThemePreference } from '@/lib/theme';
import type { ComposeContext } from '@/lib/use-compose';
import { ComposeWindow } from './ComposeWindow';
import { MailPane } from './MailPane';
import { SettingsDialog } from './SettingsDialog';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { WebLogin } from './WebLogin';

interface WebShell {
  openCompose: (context?: ComposeContext) => void;
  openSettings: () => void;
}

const ShellContext = createContext<WebShell>({ openCompose: () => undefined, openSettings: () => undefined });
export const useShell = () => useContext(ShellContext);

function Workspace() {
  const { data: me } = useMe();
  useMailboxSync();
  useThemePreference(me?.theme);
  const [collapsed, setCollapsed] = useState(false);
  const [compose, setCompose] = useState<{ key: number; context: ComposeContext } | null>(null);
  const [settings, setSettings] = useState(false);

  const shell: WebShell = {
    openCompose: (context = {}) => {
      const signature = me?.signature ? `<br><br>--<br>${me.signature.replace(/\n/g, '<br>')}` : '';
      const initial =
        context.draftId || context.replyToEntryId ? context.initial : { html: signature, ...context.initial };
      setCompose({ key: Date.now(), context: { ...context, initial } });
    },
    openSettings: () => setSettings(true),
  };

  return (
    <ShellContext.Provider value={shell}>
      <div className="flex h-full flex-col bg-gm-bg font-google text-gm-text">
        <TopBar onToggleSidebar={() => setCollapsed((c) => !c)} />
        <div className="flex min-h-0 flex-1">
          <Sidebar collapsed={collapsed} />
          <main className="mr-2 mb-2 min-w-0 flex-1 overflow-hidden rounded-2xl bg-gm-surface sm:mr-4">
            <Routes>
              <Route path="label/:labelId" element={<MailPane />} />
              <Route path=":view" element={<MailPane />} />
              <Route path="*" element={<Navigate to="/web/inbox" replace />} />
            </Routes>
          </main>
        </div>
      </div>
      {compose && <ComposeWindow key={compose.key} context={compose.context} onClose={() => setCompose(null)} />}
      <SettingsDialog open={settings} onClose={() => setSettings(false)} />
    </ShellContext.Provider>
  );
}

export function WebApp() {
  const token = useToken('web');
  return <SurfaceContext.Provider value="web">{token ? <Workspace /> : <WebLogin />}</SurfaceContext.Provider>;
}
