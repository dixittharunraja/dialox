import type { EntryPatch, Label } from '@dialox/shared';
import { Clock, Tag } from 'lucide-react';
import { useState } from 'react';
import { useLabels, usePatchEntries } from '@/lib/queries';
import { GmIconButton, MenuItem, Popover } from './widgets';

function at(days: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function snoozeOptions() {
  const now = new Date();
  const laterToday = now.getHours() < 17 ? at(0, 18) : new Date(now.getTime() + 3 * 3_600_000);
  const nextMonday = at((8 - now.getDay()) % 7 || 7, 8);
  return [
    { label: 'Later today', date: laterToday },
    { label: 'Tomorrow', date: at(1, 8) },
    { label: 'Next week', date: nextMonday },
  ];
}

/** Snooze dropdown: preset times plus a custom date-time; "Unsnooze" when already snoozed. */
export function SnoozeMenu({ ids, snoozed, onDone }: { ids: string[]; snoozed?: boolean; onDone?: () => void }) {
  const patch = usePatchEntries();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const apply = (snoozedUntil: string | null) => {
    patch.mutate({ ids, patch: { snoozedUntil } });
    setOpen(false);
    onDone?.();
  };
  return (
    <div className="relative">
      <GmIconButton icon={Clock} label="Snooze" onClick={() => setOpen((v) => !v)} />
      <Popover open={open} onClose={() => setOpen(false)} className="top-11 left-0 w-72 py-2">
        <p className="px-4 py-2 text-sm font-medium">Snooze until...</p>
        {snoozeOptions().map((option) => (
          <MenuItem key={option.label} onClick={() => apply(option.date.toISOString())}>
            <span className="flex-1">{option.label}</span>
            <span className="text-xs text-gm-muted">
              {option.date.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
            </span>
          </MenuItem>
        ))}
        <div className="flex items-center gap-2 px-4 py-2">
          <input
            type="datetime-local"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-label="Pick date and time"
            className="min-w-0 flex-1 rounded border border-gm-line bg-transparent px-2 py-1 text-sm"
          />
          <button
            type="button"
            disabled={!custom}
            onClick={() => apply(new Date(custom).toISOString())}
            className="text-sm font-medium text-gm-blue disabled:opacity-40"
          >
            Save
          </button>
        </div>
        {snoozed && <MenuItem onClick={() => apply(null)}>Unsnooze</MenuItem>}
      </Popover>
    </div>
  );
}

/** Label picker: toggles labels on the selection (applied/removed as a set). */
export function LabelMenu({ ids, current }: { ids: string[]; current: string[] }) {
  const { data: labels = [] } = useLabels();
  const patch = usePatchEntries();
  const [open, setOpen] = useState(false);
  const toggle = (label: Label) => {
    const next: EntryPatch = {
      labelIds: current.includes(label.id) ? current.filter((id) => id !== label.id) : [...current, label.id],
    };
    patch.mutate({ ids, patch: next });
  };
  return (
    <div className="relative">
      <GmIconButton icon={Tag} label="Labels" onClick={() => setOpen((v) => !v)} />
      <Popover open={open} onClose={() => setOpen(false)} className="top-11 left-0 w-60 py-2">
        <p className="px-4 py-2 text-sm font-medium">Label as:</p>
        {labels.length === 0 && (
          <p className="px-4 py-2 text-sm text-gm-muted">Create a label from the sidebar first.</p>
        )}
        {labels.map((label) => (
          <MenuItem key={label.id} onClick={() => toggle(label)}>
            <input type="checkbox" readOnly checked={current.includes(label.id)} className="pointer-events-none" />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: label.color }} />
            {label.name}
          </MenuItem>
        ))}
      </Popover>
    </div>
  );
}

export function LabelChips({ ids }: { ids: string[] }) {
  const { data: labels = [] } = useLabels();
  return (
    <>
      {labels
        .filter((label) => ids.includes(label.id))
        .map((label) => (
          <span
            key={label.id}
            className="shrink-0 rounded px-1.5 py-px text-xs font-medium text-white"
            style={{ background: label.color }}
          >
            {label.name}
          </span>
        ))}
    </>
  );
}
