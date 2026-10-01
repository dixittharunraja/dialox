import { LogOut, Menu, Search, Settings, SlidersHorizontal, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Avatar } from '@/components/Avatar';
import { useLogout, useMe } from '@/lib/queries';
import { useShell } from './WebApp';
import { GmIconButton, Popover } from './widgets';

const FILTER_FIELDS = [
  { key: 'from', label: 'From' },
  { key: 'to', label: 'To' },
  { key: 'subject', label: 'Subject' },
  { key: 'q', label: 'Has the words' },
] as const;

export function TopBar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { data: me } = useMe();
  const logout = useLogout();
  const { openSettings } = useShell();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [advanced, setAdvanced] = useState(false);
  const [account, setAccount] = useState(false);

  // Search keeps the current folder/label and replaces the filter params.
  const search = (filters: Record<string, string>) => {
    const next = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    navigate(`${location.pathname}?${next}`);
    setAdvanced(false);
  };

  const submitAdvanced = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const filters = Object.fromEntries([...data.entries()].map(([k, v]) => [k, String(v).trim()]));
    setQuery(filters.q ?? '');
    search(filters);
  };

  const active = [...params.keys()].some((k) => k !== 'open' && k !== 'page');

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 px-2 sm:px-4">
      <GmIconButton icon={Menu} label="Main menu" onClick={onToggleSidebar} />
      <Link to="/web/inbox" className="mr-4 hidden items-center gap-2 sm:flex">
        <img src="/icon.svg" alt="" className="h-9 w-9 rounded-lg" />
        <span className="text-[22px] text-gm-muted">Dialox</span>
      </Link>
      <div className="relative max-w-3xl flex-1">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            search({ q: query });
          }}
          className="flex h-12 items-center rounded-full bg-gm-hover px-2 focus-within:bg-gm-surface focus-within:shadow-md"
        >
          <GmIconButton icon={Search} label="Search" type="submit" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mail"
            aria-label="Search mail"
            className="min-w-0 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-gm-muted"
          />
          {active && (
            <GmIconButton
              icon={X}
              label="Clear search"
              onClick={() => {
                setQuery('');
                search({});
              }}
            />
          )}
          <GmIconButton icon={SlidersHorizontal} label="Show search options" onClick={() => setAdvanced((v) => !v)} />
        </form>
        <Popover open={advanced} onClose={() => setAdvanced(false)} className="top-14 right-0 left-0 p-6">
          <form onSubmit={submitAdvanced} className="grid gap-4 text-sm">
            {FILTER_FIELDS.map((field) => (
              <label key={field.key} className="grid grid-cols-[8rem_1fr] items-center gap-3">
                <span className="text-gm-muted">{field.label}</span>
                <input
                  name={field.key}
                  defaultValue={params.get(field.key) ?? ''}
                  className="border-b border-gm-line bg-transparent py-1 outline-none focus:border-gm-blue"
                />
              </label>
            ))}
            <label className="grid grid-cols-[8rem_1fr] items-center gap-3">
              <span className="text-gm-muted">Date after</span>
              <input
                type="date"
                name="after"
                defaultValue={params.get('after') ?? ''}
                className="border-b border-gm-line bg-transparent py-1 outline-none"
              />
            </label>
            <label className="grid grid-cols-[8rem_1fr] items-center gap-3">
              <span className="text-gm-muted">Date before</span>
              <input
                type="date"
                name="before"
                defaultValue={params.get('before') ?? ''}
                className="border-b border-gm-line bg-transparent py-1 outline-none"
              />
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="hasAttachment"
                value="true"
                defaultChecked={params.get('hasAttachment') === 'true'}
              />
              Has attachment
            </label>
            <div className="flex justify-end">
              <button type="submit" className="rounded-full bg-gm-blue px-6 py-2 font-medium text-white">
                Search
              </button>
            </div>
          </form>
        </Popover>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <GmIconButton icon={Settings} label="Settings" onClick={openSettings} />
        <div className="relative">
          <button
            type="button"
            aria-label="Account"
            onClick={() => setAccount((v) => !v)}
            className="rounded-full p-1 hover:bg-gm-hover"
          >
            <Avatar name={me?.displayName || me?.address || '?'} src={me?.avatarUrl} size={32} variant="gm" />
          </button>
          <Popover
            open={account}
            onClose={() => setAccount(false)}
            className="top-12 right-0 w-[min(20rem,calc(100vw-4rem))] p-5 text-center"
          >
            <div className="flex justify-center">
              <Avatar name={me?.displayName || me?.address || '?'} src={me?.avatarUrl} size={72} variant="gm" />
            </div>
            <p className="mt-3 text-lg">Hi, {me?.displayName || 'there'}!</p>
            <p className="text-sm text-gm-muted">{me?.address}</p>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-gm-line py-2 text-sm hover:bg-gm-hover"
            >
              <LogOut size={16} /> Sign out
            </button>
          </Popover>
        </div>
      </div>
    </header>
  );
}
