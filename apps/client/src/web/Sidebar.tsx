import {
  Clock,
  File,
  Inbox,
  OctagonAlert,
  PenLine,
  Plus,
  SendHorizontal,
  Star,
  Tag,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import { useCounts, useCreateLabel, useDeleteLabel, useLabels } from '@/lib/queries';
import { useShell } from './WebApp';

const LABEL_COLORS = ['#1a73e8', '#d93025', '#188038', '#e37400', '#9334e6', '#007b83'];

function NavItem({
  to,
  icon: Icon,
  label,
  count,
  collapsed,
  color,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  count?: number;
  collapsed: boolean;
  color?: string;
}) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        `flex h-8 items-center gap-4 rounded-full pr-3 pl-3 text-sm ${collapsed ? 'w-8 justify-center pl-0 pr-0' : 'pl-6'} ${
          isActive ? 'bg-gm-active font-semibold text-gm-text' : 'text-gm-text hover:bg-gm-hover'
        }`
      }
    >
      <Icon size={18} style={color ? { color, fill: color } : undefined} className="shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {!!count && <span className="text-xs font-semibold">{count}</span>}
        </>
      )}
    </NavLink>
  );
}

function NewLabelDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createLabel = useCreateLabel();
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState(LABEL_COLORS[0]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal
        aria-label="New label"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          createLabel.mutate(
            { name: labelName.trim(), color: labelColor },
            {
              onSuccess: () => {
                setLabelName('');
                onClose();
              },
            },
          );
        }}
        className="w-full max-w-sm rounded-2xl bg-gm-surface p-6 font-google text-gm-text shadow-2xl"
      >
        <p className="mb-4 text-lg">New label</p>
        <input
          autoFocus
          value={labelName}
          onChange={(e) => setLabelName(e.target.value)}
          maxLength={40}
          placeholder="Label name"
          className="w-full rounded-md border border-gm-line bg-transparent px-3 py-2 text-sm outline-none focus:border-gm-blue"
        />
        <div className="mt-4 flex gap-2">
          {LABEL_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              onClick={() => setLabelColor(c)}
              style={{ background: c }}
              className={`h-6 w-6 rounded-full ${labelColor === c ? 'ring-2 ring-gm-text ring-offset-2 ring-offset-gm-surface' : ''}`}
            />
          ))}
        </div>
        {createLabel.error && <p className="mt-2 text-xs text-red-500">{createLabel.error.message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-1.5 text-sm font-medium hover:bg-gm-hover"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!labelName.trim()}
            className="rounded-full bg-gm-blue px-5 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}

function useWideScreen() {
  const query = '(min-width: 768px)';
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setWide(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return wide;
}

export function Sidebar({ collapsed: collapsedByUser }: { collapsed: boolean }) {
  // Narrow screens always get Gmail's icon rail so the list keeps its width.
  const wide = useWideScreen();
  const collapsed = collapsedByUser || !wide;
  const { openCompose } = useShell();
  const { data: counts } = useCounts();
  const { data: labels = [] } = useLabels();
  const deleteLabel = useDeleteLabel();
  const [creating, setCreating] = useState(false);

  const folders = [
    { to: '/web/inbox', icon: Inbox, label: 'Inbox', count: counts?.inbox },
    { to: '/web/starred', icon: Star, label: 'Starred' },
    { to: '/web/snoozed', icon: Clock, label: 'Snoozed' },
    { to: '/web/sent', icon: SendHorizontal, label: 'Sent' },
    { to: '/web/drafts', icon: File, label: 'Drafts', count: counts?.drafts },
    { to: '/web/spam', icon: OctagonAlert, label: 'Spam', count: counts?.spam },
    { to: '/web/trash', icon: Trash2, label: 'Trash' },
  ];

  return (
    <nav
      aria-label="Mail folders"
      className={`flex shrink-0 flex-col overflow-y-auto pb-4 ${collapsed ? 'w-18 items-center' : 'w-64 pr-4'}`}
    >
      <button
        type="button"
        onClick={() => openCompose()}
        className={`mb-4 ml-2 flex h-14 items-center gap-3 rounded-2xl bg-gm-compose text-sm font-medium text-gm-text shadow-sm transition hover:shadow-md ${collapsed ? 'w-14 justify-center' : 'w-36 px-5'}`}
      >
        <PenLine size={22} />
        {!collapsed && 'Compose'}
      </button>
      {folders.map((f) => (
        <NavItem key={f.to} {...f} collapsed={collapsed} />
      ))}
      {!collapsed && (
        <div className="mt-4 flex items-center justify-between pr-2 pl-6">
          <span className="text-base font-medium">Labels</span>
          <button
            type="button"
            aria-label="Create new label"
            onClick={() => setCreating(true)}
            className="rounded-full p-1.5 hover:bg-gm-hover"
          >
            <Plus size={18} />
          </button>
        </div>
      )}
      <NewLabelDialog open={creating} onClose={() => setCreating(false)} />
      {labels.map((label) => (
        <div key={label.id} className="group relative">
          <NavItem
            to={`/web/label/${label.id}`}
            icon={Tag}
            label={label.name}
            color={label.color}
            collapsed={collapsed}
          />
          {!collapsed && (
            <button
              type="button"
              aria-label={`Delete label ${label.name}`}
              onClick={() => deleteLabel.mutate(label.id)}
              className="absolute top-1 right-2 hidden rounded-full p-1 hover:bg-gm-hover group-hover:block"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
    </nav>
  );
}
