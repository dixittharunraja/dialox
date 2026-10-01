import type { MailEntry } from '@dialox/shared';
import { Mail, Mic, Paperclip, SendHorizontal, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { fileSize, useDisplayName } from '@/lib/format';
import { toAttachments, type PendingAttachment } from '@/lib/files';
import { useLanguage, useT } from '@/lib/i18n';
import { useSendMail } from '@/lib/queries';
import { useDictation } from '@/lib/use-dictation';
import { useToast } from '../ui';

interface ChatComposerProps {
  conversationId: string;
  replyTo: MailEntry | null;
  onClearReply: () => void;
}

/**
 * Chat input bar. New emails show the compact Subject field; replies hide it (the server
 * derives "Re: <original>"). The camera slot opens the traditional composer, recipients locked.
 */
export function ChatComposer({ conversationId, replyTo, onClearReply }: ChatComposerProps) {
  const t = useT();
  const language = useLanguage();
  const navigate = useNavigate();
  const toast = useToast();
  const displayName = useDisplayName();
  const send = useSendMail();
  const fileInput = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<PendingAttachment[]>([]);
  const dictation = useDictation(language, (phrase) =>
    setText((current) => (current ? `${current} ${phrase}` : phrase)),
  );

  const hasContent = Boolean(text.trim() || files.length > 0);
  const canSend = hasContent && !send.isPending;

  const submit = async () => {
    if (!canSend) return;
    try {
      await send.mutateAsync({
        conversationId,
        subject: replyTo ? '' : subject.trim(),
        text: text.trim(),
        attachments: files.map(({ size: _, ...file }) => file),
        replyToEntryId: replyTo?.id,
      });
      setText('');
      setSubject('');
      setFiles([]);
      onClearReply();
    } catch (e) {
      toast(e instanceof Error ? e.message : t('failed'));
    }
  };

  const traditional = () => {
    const params = new URLSearchParams({ conversation: conversationId });
    if (replyTo) params.set('reply', replyTo.id);
    navigate(`/compose?${params}`);
  };

  return (
    <div className="shrink-0 px-2 pt-1 pb-2">
      <div className="flex items-end gap-1.5">
        <div className="min-w-0 flex-1 overflow-hidden rounded-3xl bg-wa-panel shadow-sm">
          {replyTo ? (
            <div className="m-1.5 mb-0 flex items-stretch gap-2 rounded-xl border-l-4 border-wa-accent bg-wa-panel-2 py-1.5 pr-1 pl-2">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-wa-accent">
                  {t('replyingTo')} {replyTo.outgoing ? t('you') : displayName(replyTo.from)}
                </p>
                <p className="truncate text-[13px] text-wa-muted">{replyTo.snippet || replyTo.subject}</p>
              </div>
              <button
                type="button"
                onClick={traditional}
                className="flex shrink-0 items-center gap-1 self-center rounded-full px-2 py-1 text-xs font-medium text-wa-accent hover:bg-black/5"
              >
                <Mail size={14} />
                {t('emailView')}
              </button>
              <button
                type="button"
                aria-label="Cancel reply"
                onClick={onClearReply}
                className="self-start p-1 text-wa-muted"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('subject')}
              aria-label={t('subject')}
              maxLength={998}
              className="block w-full border-b border-wa-line bg-transparent px-4 pt-2 pb-1 text-[13px] font-medium outline-none placeholder:font-normal placeholder:text-wa-muted"
            />
          )}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2">
              {files.map((file, i) => (
                <span
                  key={`${file.filename}-${i}`}
                  className="flex items-center gap-1 rounded-full bg-wa-panel-2 py-0.5 pr-1 pl-2.5 text-xs"
                >
                  <span className="max-w-36 truncate">{file.filename}</span>
                  <span className="text-wa-muted">{fileSize(file.size)}</span>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="p-0.5"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
                  e.preventDefault();
                  void submit();
                }
              }}
              rows={1}
              placeholder={t('typeMessage')}
              aria-label={t('typeMessage')}
              className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-4 py-2.5 text-[16px] outline-none [field-sizing:content] placeholder:text-wa-muted"
            />
            <button
              type="button"
              aria-label={t('attach')}
              onClick={() => fileInput.current?.click()}
              className="p-2.5 text-wa-muted"
            >
              <Paperclip size={21} className="-rotate-45" />
            </button>
            <button
              type="button"
              aria-label={t('emailView')}
              title={t('emailView')}
              onClick={traditional}
              className="p-2.5 pr-3.5 text-wa-muted"
            >
              <Mail size={21} />
            </button>
          </div>
        </div>
        {hasContent || !dictation.supported ? (
          <button
            type="button"
            aria-label={t('send')}
            disabled={!canSend}
            onClick={() => void submit()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-wa-accent text-white shadow disabled:opacity-60 dark:text-[#111b21]"
          >
            <SendHorizontal size={21} />
          </button>
        ) : (
          <button
            type="button"
            aria-label={t('dictate')}
            aria-pressed={dictation.listening}
            onClick={dictation.toggle}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow dark:text-[#111b21] ${
              dictation.listening ? 'animate-pulse bg-red-500' : 'bg-wa-accent'
            }`}
          >
            <Mic size={21} />
          </button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={async (e) => {
          if (e.target.files) {
            try {
              setFiles(await toAttachments(e.target.files, files));
            } catch (error) {
              toast((error as Error).message);
            }
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}
