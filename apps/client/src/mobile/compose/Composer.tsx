import { Paperclip, SendHorizontal, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { RecipientInput } from '@/components/RecipientInput';
import { fileSize } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useCompose } from '@/lib/use-compose';
import { Dialog, DialogActions, IconButton, TextButton, TopBar, useToast } from '../ui';

/** Traditional full-screen email composer (FAB on Home, or the email-view button inside a chat). */
export function Composer() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const compose = useCompose({
    draftId: params.get('draft') ?? undefined,
    conversationId: params.get('conversation') ?? undefined,
    replyToEntryId: params.get('reply') ?? undefined,
  });
  const fileInput = useRef<HTMLInputElement>(null);
  const [showCopies, setShowCopies] = useState(false);
  const [askDraft, setAskDraft] = useState(false);

  const close = () => (compose.isDirty ? setAskDraft(true) : navigate(-1));

  const send = async () => {
    try {
      const result = await compose.send();
      navigate(result.conversationId ? `/chat/${result.conversationId}` : '/', { replace: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : t('failed'));
    }
  };

  const canSend =
    compose.to.length > 0 &&
    !compose.sending &&
    (compose.text.trim() || compose.subject.trim() || compose.attachments.length);
  const field = 'border-b border-wa-line px-4';

  return (
    <div className="relative flex h-full flex-col bg-wa-panel text-wa-text">
      <TopBar title={compose.isReply ? t('reply') : t('compose')} back={close}>
        <IconButton icon={Paperclip} label={t('attach')} onClick={() => fileInput.current?.click()} />
        <IconButton icon={SendHorizontal} label={t('send')} disabled={!canSend} onClick={() => void send()} />
      </TopBar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <label className={`flex h-12 items-center gap-2 ${field}`}>
          <span className="w-10 text-sm text-wa-muted">{t('from')}</span>
          <select
            value={compose.from}
            onChange={(e) => compose.setFrom(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          >
            {compose.fromOptions.map((address) => (
              <option key={address} value={address} className="bg-wa-panel">
                {address}
              </option>
            ))}
          </select>
        </label>
        <div className={field}>
          <RecipientInput
            label={t('to')}
            value={compose.to}
            onChange={compose.setTo}
            locked={compose.locked}
            lockedHint={compose.locked ? t('lockedRecipients') : undefined}
            tone="wa"
            autoFocus={!compose.locked && !compose.to.length}
          />
        </div>
        {!compose.locked && compose.to.length > 1 && (
          <p className="px-4 pt-1 text-xs text-wa-accent">{t('newGroupNote')}</p>
        )}
        {showCopies || compose.cc.length || compose.bcc.length ? (
          <>
            {!compose.locked && (
              <div className={field}>
                <RecipientInput label={t('cc')} value={compose.cc} onChange={compose.setCc} tone="wa" />
              </div>
            )}
            <div className={field}>
              <RecipientInput label={t('bcc')} value={compose.bcc} onChange={compose.setBcc} tone="wa" />
            </div>
          </>
        ) : (
          <button type="button" onClick={() => setShowCopies(true)} className="px-4 py-2 text-sm text-wa-accent">
            {compose.locked ? t('bcc') : `${t('cc')} / ${t('bcc')}`}
          </button>
        )}
        {compose.isReply ? (
          <p className={`py-3 text-[15px] text-wa-muted ${field}`}>{compose.subject}</p>
        ) : (
          <input
            value={compose.subject}
            onChange={(e) => compose.setSubject(e.target.value)}
            placeholder={t('subject')}
            maxLength={998}
            className={`block h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-wa-muted ${field}`}
          />
        )}
        {compose.attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2 px-4 pt-3">
            {compose.attachments.map((file, i) => (
              <li
                key={`${file.filename}-${i}`}
                className="flex items-center gap-2 rounded-lg bg-wa-panel-2 py-1.5 pr-1.5 pl-3 text-sm"
              >
                <Paperclip size={14} />
                <span className="max-w-40 truncate">{file.filename}</span>
                <span className="text-xs text-wa-muted">{fileSize(file.size)}</span>
                <button type="button" aria-label="Remove" onClick={() => compose.removeAttachment(i)}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <textarea
          value={compose.text}
          onChange={(e) => compose.setText(e.target.value)}
          placeholder={t('typeMessage')}
          className="block min-h-72 w-full resize-none bg-transparent px-4 py-3 text-[16px] leading-relaxed outline-none placeholder:text-wa-muted"
        />
      </div>

      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={async (e) => {
          if (e.target.files) await compose.addFiles(e.target.files).catch((error: Error) => toast(error.message));
          e.target.value = '';
        }}
      />

      <Dialog open={askDraft}>
        <p className="text-[16px]">{t('discardQuestion')}</p>
        <DialogActions>
          <TextButton danger onClick={() => void compose.discard().then(() => navigate(-1))}>
            {t('discard')}
          </TextButton>
          <TextButton onClick={() => void compose.saveDraft().then(() => navigate(-1))}>{t('saveDraft')}</TextButton>
        </DialogActions>
      </Dialog>
    </div>
  );
}
