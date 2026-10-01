import type { MailQuery, MailView as View } from '@dialox/shared';
import { Navigate, useParams, useSearchParams } from 'react-router';
import { DraftList } from './DraftList';
import { MailList } from './MailList';
import { MailView } from './MailView';

const VIEWS: View[] = ['inbox', 'starred', 'snoozed', 'sent', 'spam', 'trash'];

/** Routes /web/:view and /web/label/:id to the list, draft list or reading view (?open=). */
export function MailPane() {
  const { view = 'inbox', labelId } = useParams();
  const [params] = useSearchParams();
  const openId = params.get('open');

  if (openId) return <MailView id={openId} />;
  if (view === 'drafts' && !labelId) return <DraftList />;
  if (!labelId && !VIEWS.includes(view as View)) return <Navigate to="/web/inbox" replace />;

  const query: MailQuery = {
    view: labelId ? 'inbox' : (view as View),
    labelId,
    q: params.get('q') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    subject: params.get('subject') ?? undefined,
    after: params.get('after') ?? undefined,
    before: params.get('before') ?? undefined,
    hasAttachment: params.get('hasAttachment') === 'true' || undefined,
    page: Number(params.get('page') ?? 1),
  };
  return <MailList query={query} />;
}
