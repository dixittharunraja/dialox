import type { AttachmentMeta } from '@dialox/shared';
import DOMPurify from 'dompurify';
import { Download, Paperclip } from 'lucide-react';
import { useMemo } from 'react';
import { useApi } from '@/lib/api';
import { fileSize } from '@/lib/format';

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/** Renders an email body. HTML is sanitised so inbound mail cannot run script in the app. */
export function MailBody({ text, html }: { text: string; html: string | null }) {
  const safeHtml = useMemo(() => (html ? DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'form'] }) : null), [html]);
  if (safeHtml)
    return <div className="mail-html text-[15px] leading-relaxed" dangerouslySetInnerHTML={{ __html: safeHtml }} />;
  return <div className="text-[15px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</div>;
}

/** Attachment downloads need the bearer token, so they go through fetch + a temporary blob URL. */
function useDownloadAttachment() {
  const { token } = useApi();
  return async (file: AttachmentMeta) => {
    const response = await fetch(`/api/attachments/${file.id}`, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) return;
    const url = URL.createObjectURL(await response.blob());
    const link = Object.assign(document.createElement('a'), { href: url, download: file.filename });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
}

export function AttachmentList({ files, tone = 'wa' }: { files: AttachmentMeta[]; tone?: 'wa' | 'gm' }) {
  const download = useDownloadAttachment();
  if (!files.length) return null;
  const chip =
    tone === 'wa' ? 'bg-black/5 dark:bg-white/10 text-wa-text' : 'border border-gm-line text-gm-text hover:bg-gm-hover';
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {files.map((file) => (
        <button
          key={file.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void download(file);
          }}
          className={`flex max-w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${chip}`}
        >
          <Paperclip size={16} className="shrink-0 opacity-70" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{file.filename}</span>
            <span className="text-xs opacity-70">{fileSize(file.size)}</span>
          </span>
          <Download size={16} className="shrink-0 opacity-70" />
        </button>
      ))}
    </div>
  );
}
