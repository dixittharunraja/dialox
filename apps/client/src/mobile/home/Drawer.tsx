import { File, Home as HomeIcon, LogOut, OctagonAlert, Trash2, UserRound, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/Avatar';
import { useT } from '@/lib/i18n';
import { useCounts, useLogout, useMe } from '@/lib/queries';

/** Top-left menu: Home (Inbox + Sent unified as chats), Drafts, Spam, Trash. */
export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: counts } = useCounts();
  const logout = useLogout();

  const go = (path: string) => {
    onClose();
    navigate(path);
  };
  const items: { icon: LucideIcon; label: string; count?: number; path: string }[] = [
    { icon: HomeIcon, label: t('home'), count: counts?.inbox, path: '/' },
    { icon: File, label: t('drafts'), count: counts?.drafts, path: '/folder/drafts' },
    { icon: OctagonAlert, label: t('spam'), count: counts?.spam, path: '/folder/spam' },
    { icon: Trash2, label: t('trash'), count: counts?.trash, path: '/folder/trash' },
    { icon: UserRound, label: t('profile'), path: '/profile' },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="absolute inset-0 z-40 bg-black/40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.nav
            aria-label="Menu"
            className="absolute inset-y-0 left-0 z-50 flex w-72 flex-col bg-wa-panel shadow-xl"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            <div className="bg-wa-header px-5 pt-8 pb-5 text-wa-header-text">
              <Avatar name={me?.displayName || '?'} src={me?.avatarUrl} size={56} />
              <p className="mt-3 truncate font-medium">{me?.displayName || me?.address}</p>
              <p className="truncate text-xs opacity-80">{me?.address}</p>
            </div>
            <ul className="flex-1 py-2">
              {items.map((item) => (
                <li key={item.path}>
                  <button
                    type="button"
                    onClick={() => go(item.path)}
                    className="flex w-full items-center gap-5 px-5 py-3.5 text-left text-[15px] hover:bg-wa-panel-2"
                  >
                    <item.icon size={21} className="text-wa-muted" />
                    <span className="flex-1">{item.label}</span>
                    {!!item.count && <span className="text-xs font-medium text-wa-accent">{item.count}</span>}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex items-center gap-5 border-t border-wa-line px-5 py-4 text-left text-[15px] text-red-500 hover:bg-wa-panel-2"
            >
              <LogOut size={21} />
              {t('logout')}
            </button>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
}
