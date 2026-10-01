import { toAddress, type Conversation, type ConversationFilter } from '@dialox/shared';
import { Contact, Menu, MessageCircle, Paperclip, PenLine, Search, Star, X } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/Avatar';
import { useApi } from '@/lib/api';
import { contactPickerSupported, pickContactPhone } from '@/lib/device';
import { shortTime, useConversationTitle, useDisplayName } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { useConfig, useConversations, useMe } from '@/lib/queries';
import { isGranted } from '../permissions';
import { StatusTicks } from '../StatusTicks';
import { EmptyState, IconButton, useToast } from '../ui';
import { Drawer } from './Drawer';

const FILTERS: ConversationFilter[] = ['all', 'unread', 'attachments', 'favorites'];

function ConversationRow({ conversation, onOpen }: { conversation: Conversation; onOpen: () => void }) {
  const t = useT();
  const language = useLanguage();
  const title = useConversationTitle()(conversation);
  const last = conversation.last!;
  const unread = conversation.unreadCount > 0;
  const avatar = conversation.kind === 'direct' ? conversation.participants[0]?.avatarUrl : null;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-wa-panel-2"
      >
        <Avatar name={title} src={avatar} size={50} group={conversation.kind === 'group'} />
        <span className="min-w-0 flex-1 border-b border-wa-line pb-2.5">
          <span className="flex items-baseline gap-2">
            <span className="flex-1 truncate text-[16px] font-medium">{title}</span>
            <span className={`shrink-0 text-xs ${unread ? 'font-medium text-wa-green' : 'text-wa-muted'}`}>
              {shortTime(last.at, language, t('yesterday'))}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-sm text-wa-muted">
            {last.outgoing && <StatusTicks status={last.status} />}
            {conversation.hasAttachments && <Paperclip size={14} className="shrink-0" />}
            <span className="flex-1 truncate">
              {last.subject && <span className="text-wa-text">{last.subject} · </span>}
              {last.snippet}
            </span>
            {conversation.isFavorite && <Star size={14} className="shrink-0 fill-current" />}
            {unread && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-wa-green px-1.5 text-[11px] font-semibold text-white dark:text-[#111b21]">
                {conversation.unreadCount}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

export function Home() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const api = useApi();
  const { data: me } = useMe();
  const { data: config } = useConfig();
  const displayName = useDisplayName();
  const [drawer, setDrawer] = useState(false);
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim());
  const { data: conversations = [], isLoading } = useConversations(filter, deferredQuery);

  const typedAddress = config && query.trim() ? toAddress(query, config.mailDomain, config.defaultCountry) : null;

  const openChatWith = async (target: string) => {
    try {
      const conversation = await api.post<Conversation>('/api/conversations', { participants: [target] });
      navigate(`/chat/${conversation.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : t('failed'));
    }
  };

  const pickContact = async () => {
    const phone = await pickContactPhone().catch(() => null);
    if (phone) void openChatWith(phone);
  };

  return (
    <div className="relative flex h-full flex-col bg-wa-panel text-wa-text">
      <header
        className="shrink-0 bg-wa-header text-wa-header-text"
        style={{ paddingTop: 'var(--safe-area-inset-top, 0px)' }}
      >
        <div className="flex h-14 items-center gap-1 px-1">
          <IconButton icon={Menu} label="Menu" onClick={() => setDrawer(true)} />
          <h1 className="flex-1 px-1 text-xl font-medium">Dialox</h1>
          <button
            type="button"
            aria-label={t('profile')}
            onClick={() => navigate('/profile')}
            className="mr-2 rounded-full"
          >
            <Avatar name={me?.displayName || '?'} src={me?.avatarUrl} size={34} />
          </button>
        </div>
      </header>

      <div className="shrink-0 px-3 pt-2">
        <label className="flex h-10 items-center gap-3 rounded-full bg-wa-panel-2 px-4">
          <Search size={18} className="shrink-0 text-wa-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-wa-muted"
          />
          {query ? (
            <button type="button" aria-label="Clear" onClick={() => setQuery('')} className="text-wa-muted">
              <X size={18} />
            </button>
          ) : (
            contactPickerSupported() &&
            isGranted('contacts') && (
              <button
                type="button"
                aria-label={t('pickContact')}
                onClick={() => void pickContact()}
                className="text-wa-muted"
              >
                <Contact size={18} />
              </button>
            )
          )}
        </label>
        <div className="no-scrollbar flex gap-2 overflow-x-auto py-2.5" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition ${
                filter === f
                  ? 'bg-[#d8fdd2] font-medium text-[#15603e] dark:bg-[#0a332c] dark:text-[#e7fce3]'
                  : 'bg-wa-panel-2 text-wa-muted'
              }`}
            >
              {t(f)}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {typedAddress && (
          <button
            type="button"
            onClick={() => void openChatWith(typedAddress)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-wa-panel-2"
          >
            <span className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-wa-accent text-white">
              <MessageCircle size={24} />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px]">{t('messageNumber')}</span>
              <span className="block truncate font-medium">{displayName(typedAddress)}</span>
            </span>
          </button>
        )}
        {conversations.length > 0 ? (
          <ul>
            {conversations.map((c) => (
              <ConversationRow key={c.id} conversation={c} onOpen={() => navigate(`/chat/${c.id}`)} />
            ))}
          </ul>
        ) : (
          !isLoading &&
          !typedAddress && (
            <EmptyState icon={MessageCircle} text={query || filter !== 'all' ? t('noResults') : t('noChats')} />
          )
        )}
      </div>

      <button
        type="button"
        aria-label={t('compose')}
        onClick={() => navigate('/compose')}
        className="absolute right-4 bottom-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-wa-accent text-white shadow-lg transition hover:brightness-110 dark:text-[#111b21]"
      >
        <PenLine size={24} />
      </button>

      <Drawer open={drawer} onClose={() => setDrawer(false)} />
    </div>
  );
}
