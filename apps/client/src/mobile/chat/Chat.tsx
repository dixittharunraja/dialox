import type { MailEntry } from '@dialox/shared';
import { Star } from 'lucide-react';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Avatar } from '@/components/Avatar';
import { useApi } from '@/lib/api';
import { dayLabel, useConversationTitle } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { useConversation, useConversationMessages, useRefreshMail, useToggleFavorite } from '@/lib/queries';
import { IconButton, TopBar, useToast } from '../ui';
import { ChatComposer } from './ChatComposer';
import { MessageBubble } from './MessageBubble';

function dayKey(iso: string) {
  return new Date(iso).toDateString();
}

export function Chat() {
  const { id = '' } = useParams();
  const t = useT();
  const language = useLanguage();
  const navigate = useNavigate();
  const toast = useToast();
  const api = useApi();
  const refresh = useRefreshMail();
  const title = useConversationTitle();
  const { data: conversation } = useConversation(id);
  const { data: messages = [] } = useConversationMessages(id);
  const favorite = useToggleFavorite();
  const [replyTo, setReplyTo] = useState<MailEntry | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const unreadCount = messages.filter((m) => !m.isRead).length;
  useEffect(() => {
    if (unreadCount > 0) void api.post(`/api/conversations/${id}/read`).then(refresh);
  }, [unreadCount, id, api, refresh]);

  useLayoutEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length]);

  const jumpTo = (entryId: string) => {
    document.getElementById(`m-${entryId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlight(entryId);
    setTimeout(() => setHighlight(null), 1500);
  };

  const startReply = (message: MailEntry) => {
    if (message.repliedByMe) toast(t('alreadyReplied'));
    else setReplyTo(message);
  };

  if (!conversation) return <div className="h-full bg-wa-chat" />;
  const isGroup = conversation.kind === 'group';
  const name = title(conversation);
  const subtitle = isGroup
    ? `${conversation.participants.length + 1} ${t('participants')}`
    : conversation.participants[0]?.address;

  return (
    <div className="flex h-full flex-col text-wa-text">
      <TopBar
        back="/"
        title={
          <span className="flex items-center gap-2">
            <Avatar
              name={name}
              src={isGroup ? null : conversation.participants[0]?.avatarUrl}
              size={36}
              group={isGroup}
            />
            <span className="truncate">{name}</span>
          </span>
        }
        subtitle={<span className="pl-11">{subtitle}</span>}
      >
        <IconButton
          icon={Star}
          label={conversation.isFavorite ? t('unfavorite') : t('favorite')}
          className={conversation.isFavorite ? '[&>svg]:fill-current' : ''}
          onClick={() => favorite.mutate({ id, isFavorite: !conversation.isFavorite })}
        />
      </TopBar>

      <div ref={scroller} className="wa-wallpaper min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-2">
        {messages.map((message, i) => {
          const newDay = i === 0 || dayKey(messages[i - 1].createdAt) !== dayKey(message.createdAt);
          return (
            <Fragment key={message.id}>
              {newDay && (
                <div className="my-2 flex justify-center">
                  <span className="rounded-lg bg-wa-panel px-3 py-1 text-xs text-wa-muted shadow-sm">
                    {dayLabel(message.createdAt, language, { today: t('today'), yesterday: t('yesterday') })}
                  </span>
                </div>
              )}
              <MessageBubble
                message={message}
                showSender={isGroup}
                highlighted={highlight === message.id}
                onOpen={() => navigate(`/mail/${message.id}`)}
                onReply={() => startReply(message)}
                onQuoteTap={jumpTo}
              />
            </Fragment>
          );
        })}
      </div>

      <div className="wa-wallpaper">
        <ChatComposer conversationId={id} replyTo={replyTo} onClearReply={() => setReplyTo(null)} />
      </div>
    </div>
  );
}
