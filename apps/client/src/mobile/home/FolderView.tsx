import type { MailView } from '@dialox/shared';
import { File, Inbox, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Avatar } from '@/components/Avatar';
import { shortTime, useDisplayName } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { useDeleteDraft, useDeleteForever, useDrafts, useMailList } from '@/lib/queries';
import { EmptyState, IconButton, TopBar } from '../ui';

interface RowProps {
  title: string;
  subject: string;
  snippet: string;
  at: string;
  onOpen: () => void;
  children?: ReactNode;
}

function Row({ title, subject, snippet, at, onOpen, children }: RowProps) {
  const t = useT();
  const language = useLanguage();
  return (
    <li className="flex items-center gap-3 border-b border-wa-line pr-2 pl-4 hover:bg-wa-panel-2">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left">
        <Avatar name={title} size={42} />
        <span className="min-w-0 flex-1">
          <span className="flex gap-2">
            <span className="flex-1 truncate font-medium">{title}</span>
            <span className="shrink-0 text-xs text-wa-muted">{shortTime(at, language, t('yesterday'))}</span>
          </span>
          <span className="block truncate text-sm">{subject || t('noSubject')}</span>
          <span className="block truncate text-sm text-wa-muted">{snippet}</span>
        </span>
      </button>
      {children}
    </li>
  );
}

function DraftList() {
  const t = useT();
  const navigate = useNavigate();
  const displayName = useDisplayName();
  const { data: drafts = [] } = useDrafts();
  const remove = useDeleteDraft();
  if (!drafts.length) return <EmptyState icon={File} text={t('nothingHere')} />;
  return (
    <ul>
      {drafts.map((d) => (
        <Row
          key={d.id}
          title={d.to.map((a) => displayName(a)).join(', ') || t('drafts')}
          subject={d.subject}
          snippet={d.text}
          at={d.updatedAt}
          onOpen={() => navigate(`/compose?draft=${d.id}`)}
        >
          <IconButton icon={Trash2} label={t('discard')} size={18} onClick={() => remove.mutate(d.id)} />
        </Row>
      ))}
    </ul>
  );
}

function MailFolder({ view }: { view: MailView }) {
  const t = useT();
  const navigate = useNavigate();
  const displayName = useDisplayName();
  const { data } = useMailList({ view });
  const deleteForever = useDeleteForever();
  const items = data?.items ?? [];
  if (!items.length) return <EmptyState icon={view === 'trash' ? Trash2 : Inbox} text={t('nothingHere')} />;
  return (
    <>
      {view === 'trash' && (
        <button
          type="button"
          onClick={() => deleteForever.mutate(items.map((i) => i.id))}
          className="w-full bg-wa-panel-2 py-2.5 text-sm font-medium text-red-500"
        >
          {t('deleteForever')} ({items.length})
        </button>
      )}
      <ul>
        {items.map((m) => (
          <Row
            key={m.id}
            title={m.outgoing ? `${t('to')}: ${m.to.map((a) => displayName(a)).join(', ')}` : displayName(m.from)}
            subject={m.subject}
            snippet={m.snippet}
            at={m.createdAt}
            onOpen={() => navigate(`/mail/${m.id}`)}
          />
        ))}
      </ul>
    </>
  );
}

const FOLDERS = { drafts: 'drafts', spam: 'spam', trash: 'trash' } as const;

export function FolderView() {
  const t = useT();
  const { name = '' } = useParams();
  const folder = FOLDERS[name as keyof typeof FOLDERS];
  if (!folder) return <Navigate to="/" replace />;
  return (
    <div className="flex h-full flex-col bg-wa-panel text-wa-text">
      <TopBar title={t(folder)} back="/" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {folder === 'drafts' ? <DraftList /> : <MailFolder view={folder} />}
      </div>
    </div>
  );
}
