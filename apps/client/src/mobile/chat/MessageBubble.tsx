import type { MailEntry } from '@dialox/shared';
import { Reply, Star } from 'lucide-react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { useRef } from 'react';
import { AttachmentList } from '@/components/MailBody';
import { clockTime, colorFor, useDisplayName } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { StatusTicks } from '../StatusTicks';

const PREVIEW_CHARS = 420;
const SWIPE_THRESHOLD = 60;

interface BubbleProps {
  message: MailEntry;
  showSender: boolean;
  highlighted: boolean;
  onOpen: () => void;
  onReply: () => void;
  onQuoteTap: (entryId: string) => void;
}

export function MessageBubble({ message, showSender, highlighted, onOpen, onReply, onQuoteTap }: BubbleProps) {
  const t = useT();
  const language = useLanguage();
  const displayName = useDisplayName();
  const x = useMotionValue(0);
  const iconOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const dragged = useRef(false);

  const long = message.text.length > PREVIEW_CHARS || message.text.split('\n').length > 10;
  const body = long ? `${message.text.slice(0, PREVIEW_CHARS).trimEnd()}…` : message.text;
  const out = message.outgoing;
  const senderName = displayName(message.from);

  return (
    <div id={`m-${message.id}`} className={`relative flex px-3 py-0.5 ${out ? 'justify-end' : 'justify-start'}`}>
      <motion.span
        style={{ opacity: iconOpacity }}
        className="absolute top-1/2 left-4 -translate-y-1/2 rounded-full bg-black/10 p-1.5 text-wa-muted dark:bg-white/10"
      >
        <Reply size={18} />
      </motion.span>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.6 }}
        dragSnapToOrigin
        style={{ x }}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={(_, info) => {
          if (info.offset.x > SWIPE_THRESHOLD) onReply();
          setTimeout(() => (dragged.current = false), 50);
        }}
        onClick={() => !dragged.current && onOpen()}
        className={`relative max-w-[82%] cursor-pointer rounded-lg px-2 pt-1.5 pb-1 text-[15px] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] transition-colors ${
          out ? 'rounded-tr-none bg-wa-out' : 'rounded-tl-none bg-wa-in'
        } ${highlighted ? 'ring-2 ring-wa-accent' : ''}`}
      >
        {showSender && !out && (
          <p className="mb-0.5 text-[13px] font-medium" style={{ color: colorFor(message.from.address) }}>
            {senderName}
          </p>
        )}
        {message.quoted ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (message.quoted?.entryId) onQuoteTap(message.quoted.entryId);
            }}
            className="mb-1 block w-full rounded-md border-l-4 border-wa-accent bg-black/5 px-2 py-1 text-left dark:bg-black/20"
          >
            <span className="block text-[13px] font-medium text-wa-accent">{message.quoted.fromName}</span>
            <span className="line-clamp-2 text-[13px] text-wa-muted">
              {message.quoted.snippet || message.quoted.subject}
            </span>
          </button>
        ) : (
          <p className="mb-0.5 font-semibold">{message.subject || t('noSubject')}</p>
        )}
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
          {body}
          {long && <span className="ml-1 font-medium text-wa-accent">{t('readMore')}</span>}
        </p>
        <AttachmentList files={message.attachments} />
        <span className="float-right mt-1 ml-3 flex items-center gap-1 text-[11px] text-wa-muted">
          {message.isStarred && <Star size={11} className="fill-current" aria-label="Starred" />}
          {clockTime(message.createdAt, language)}
          {out && <StatusTicks status={message.status} size={15} />}
        </span>
        <span className="clear-both block" />
      </motion.div>
    </div>
  );
}
