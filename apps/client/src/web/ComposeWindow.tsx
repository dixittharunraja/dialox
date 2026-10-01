import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  Paperclip,
  RemoveFormatting,
  Trash2,
  Underline,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { RecipientInput } from '@/components/RecipientInput';
import { fileSize } from '@/lib/format';
import { useCompose, type ComposeContext } from '@/lib/use-compose';

const AUTOSAVE_MS = 2500;

// execCommand is deprecated but remains the only dependency-free way to drive a
// contentEditable formatting toolbar across all browsers.
const FORMATS: { icon: LucideIcon; label: string; command: string }[] = [
  { icon: Bold, label: 'Bold', command: 'bold' },
  { icon: Italic, label: 'Italic', command: 'italic' },
  { icon: Underline, label: 'Underline', command: 'underline' },
  { icon: List, label: 'Bulleted list', command: 'insertUnorderedList' },
  { icon: ListOrdered, label: 'Numbered list', command: 'insertOrderedList' },
  { icon: RemoveFormatting, label: 'Remove formatting', command: 'removeFormat' },
];

/** Gmail-style docked composer with rich text, attachments, Cc/Bcc and draft autosave. */
export function ComposeWindow({ context, onClose }: { context: ComposeContext; onClose: () => void }) {
  const compose = useCompose(context);
  const editor = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'docked' | 'minimized' | 'maximized'>('docked');
  const [showCopies, setShowCopies] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const { saveDraft, isDirty } = compose;

  // Seed the editor once initial content (signature, forward, or a loaded draft) is known.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !editor.current) return;
    const initial = compose.html ?? compose.text.replace(/\n/g, '<br>');
    if (initial || !context.draftId) {
      editor.current.innerHTML = initial;
      seeded.current = true;
    }
  }, [compose.html, compose.text, context.draftId]);

  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      void saveDraft().then(() =>
        setSavedAt(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })),
      );
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on content changes only
  }, [compose.to, compose.cc, compose.bcc, compose.subject, compose.html, compose.attachments.length]);

  const syncEditor = () => {
    compose.setHtml(editor.current?.innerHTML ?? '');
    compose.setText(editor.current?.innerText ?? '');
  };
  const format = (command: string) => {
    editor.current?.focus();
    if (command === 'createLink') {
      const url = window.prompt('Link URL');
      if (url) document.execCommand('createLink', false, url);
    } else {
      document.execCommand(command);
    }
    syncEditor();
  };
  const send = async () => {
    setError(null);
    try {
      await compose.send();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    }
  };
  const close = async () => {
    if (isDirty) await saveDraft();
    onClose();
  };

  const title = compose.isReply ? compose.subject : compose.subject || 'New Message';
  const frame =
    mode === 'maximized'
      ? 'fixed inset-6 sm:inset-x-[10%] sm:inset-y-10'
      : `fixed right-0 bottom-0 w-full sm:right-6 sm:w-[540px] ${mode === 'minimized' ? '' : 'h-[min(600px,85vh)]'}`;

  return (
    <>
      {mode === 'maximized' && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setMode('docked')} />}
      <section
        aria-label="Compose"
        className={`${frame} z-50 flex flex-col overflow-hidden rounded-t-xl bg-gm-surface text-gm-text shadow-[0_8px_10px_1px_rgba(0,0,0,0.14),0_3px_14px_2px_rgba(0,0,0,0.12)] ${mode === 'maximized' ? 'rounded-xl' : ''}`}
      >
        <header
          className="flex h-10 shrink-0 cursor-pointer items-center gap-1 bg-[#f2f6fc] pr-2 pl-4 text-sm font-medium dark:bg-[#303030]"
          onClick={() => setMode(mode === 'minimized' ? 'docked' : 'minimized')}
        >
          <span className="flex-1 truncate">{title}</span>
          <span onClick={(e) => e.stopPropagation()} className="flex">
            <button
              type="button"
              aria-label="Minimise"
              onClick={() => setMode(mode === 'minimized' ? 'docked' : 'minimized')}
              className="rounded p-1 hover:bg-gm-hover"
            >
              <Minus size={16} />
            </button>
            <button
              type="button"
              aria-label={mode === 'maximized' ? 'Exit full screen' : 'Full screen'}
              onClick={() => setMode(mode === 'maximized' ? 'docked' : 'maximized')}
              className="rounded p-1 hover:bg-gm-hover"
            >
              {mode === 'maximized' ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button
              type="button"
              aria-label="Save & close"
              onClick={() => void close()}
              className="rounded p-1 hover:bg-gm-hover"
            >
              <X size={16} />
            </button>
          </span>
        </header>

        {/* Hidden rather than unmounted when minimised so the editor keeps its content. */}
        <div className={mode === 'minimized' ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
          <div className="shrink-0 px-4">
            {compose.fromOptions.length > 1 && (
              <label className="flex h-10 items-center gap-2 border-b border-gm-line text-sm">
                <span className="w-10 text-gm-muted">From</span>
                <select
                  value={compose.from}
                  onChange={(e) => compose.setFrom(e.target.value)}
                  className="flex-1 bg-transparent outline-none"
                >
                  {compose.fromOptions.map((a) => (
                    <option key={a} value={a} className="bg-gm-surface">
                      {a}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex items-center border-b border-gm-line">
              <div className="flex-1">
                <RecipientInput
                  label="To"
                  value={compose.to}
                  onChange={compose.setTo}
                  locked={compose.locked}
                  lockedHint={compose.locked ? 'Replies stay in this conversation' : undefined}
                  tone="gm"
                  autoFocus={!compose.locked && !context.draftId}
                />
              </div>
              {!showCopies && (
                <button
                  type="button"
                  onClick={() => setShowCopies(true)}
                  className="ml-2 text-sm text-gm-muted hover:underline"
                >
                  Cc Bcc
                </button>
              )}
            </div>
            {(showCopies || compose.cc.length > 0 || compose.bcc.length > 0) && (
              <>
                {!compose.locked && (
                  <div className="border-b border-gm-line">
                    <RecipientInput label="Cc" value={compose.cc} onChange={compose.setCc} tone="gm" />
                  </div>
                )}
                <div className="border-b border-gm-line">
                  <RecipientInput label="Bcc" value={compose.bcc} onChange={compose.setBcc} tone="gm" />
                </div>
              </>
            )}
            <input
              value={compose.subject}
              onChange={(e) => compose.setSubject(e.target.value)}
              readOnly={compose.isReply}
              placeholder="Subject"
              aria-label="Subject"
              className="h-10 w-full border-b border-gm-line bg-transparent text-sm outline-none read-only:text-gm-muted"
            />
          </div>

          <div
            ref={editor}
            contentEditable
            role="textbox"
            aria-multiline
            aria-label="Message Body"
            onInput={syncEditor}
            className="mail-html min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed outline-none"
          />

          {compose.attachments.length > 0 && (
            <ul className="flex shrink-0 flex-wrap gap-2 px-4 pb-2">
              {compose.attachments.map((file, i) => (
                <li
                  key={`${file.filename}-${i}`}
                  className="flex items-center gap-2 rounded bg-gm-hover px-2 py-1 text-xs"
                >
                  <span className="max-w-48 truncate font-medium text-gm-blue">{file.filename}</span>
                  <span className="text-gm-muted">({fileSize(file.size)})</span>
                  <button type="button" aria-label="Remove attachment" onClick={() => compose.removeAttachment(i)}>
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex shrink-0 items-center gap-0.5 border-t border-gm-line px-2 py-1">
            {FORMATS.map((f) => (
              <button
                key={f.command}
                type="button"
                aria-label={f.label}
                title={f.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => format(f.command)}
                className="rounded p-1.5 text-gm-muted hover:bg-gm-hover"
              >
                <f.icon size={17} />
              </button>
            ))}
            <button
              type="button"
              aria-label="Insert link"
              title="Insert link"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => format('createLink')}
              className="rounded p-1.5 text-gm-muted hover:bg-gm-hover"
            >
              <Link2 size={17} />
            </button>
          </div>

          <footer className="flex shrink-0 items-center gap-2 px-4 py-3">
            <button
              type="button"
              disabled={compose.sending || !compose.to.length}
              onClick={() => void send()}
              className="rounded-full bg-gm-blue px-6 py-2 text-sm font-medium text-white hover:shadow-md disabled:opacity-50"
            >
              {compose.sending ? 'Sending...' : 'Send'}
            </button>
            <button
              type="button"
              aria-label="Attach files"
              title="Attach files"
              onClick={() => fileInput.current?.click()}
              className="rounded-full p-2 text-gm-muted hover:bg-gm-hover"
            >
              <Paperclip size={18} />
            </button>
            <span className="flex-1 truncate text-xs text-gm-muted">
              {error ? <span className="text-red-500">{error}</span> : savedAt && `Draft saved ${savedAt}`}
            </span>
            <button
              type="button"
              aria-label="Discard draft"
              title="Discard draft"
              onClick={() => void compose.discard().then(onClose)}
              className="rounded-full p-2 text-gm-muted hover:bg-gm-hover"
            >
              <Trash2 size={18} />
            </button>
          </footer>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={async (e) => {
              if (e.target.files) await compose.addFiles(e.target.files).catch((err: Error) => setError(err.message));
              e.target.value = '';
            }}
          />
        </div>
      </section>
    </>
  );
}
