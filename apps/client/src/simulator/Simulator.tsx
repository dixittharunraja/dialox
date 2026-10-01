import { formatPhone, normalizePhone, type SmsLog } from '@dialox/shared';
import { ExternalLink, MessageSquareText, Phone, SendHorizontal, Smartphone } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { request } from '@/lib/api';
import { detectedPhone, rememberDevicePhone } from '@/lib/device';
import { clockTime } from '@/lib/format';
import { useConfig } from '@/lib/queries';
import { useSmsFeed } from '@/lib/realtime';
import { useThemePreference } from '@/lib/theme';
import { Dialer } from './Dialer';

const DEFAULT_DEVICE = '+919000012345';

/** Keeps an SMS log list in sync: initial fetch plus live pushes over the simulator channel. */
function useSmsLog(phone: string | null, enabled: boolean) {
  const [logs, setLogs] = useState<SmsLog[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const query = phone ? `?phone=${encodeURIComponent(phone)}` : '';
    void request<SmsLog[]>(`/api/simulator/sms${query}`)
      .then(setLogs)
      .catch(() => setLogs([]));
  }, [phone, enabled]);
  const onSms = useCallback(
    (log: SmsLog) => setLogs((current) => [log, ...current.filter((l) => l.id !== log.id)]),
    [],
  );
  useSmsFeed(enabled, phone, onSms);
  return logs;
}

function Messages({ devicePhone, tollFree }: { devicePhone: string; tollFree: string }) {
  const logs = useSmsLog(devicePhone, true);
  const [body, setBody] = useState('START');
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    setError(null);
    try {
      await request('/api/simulator/sms', { method: 'POST', body: { from: devicePhone, body } });
      setBody('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="flex h-full flex-col bg-[#0b141a]">
      <div className="bg-[#1f2c34] px-4 py-3 text-sm text-white">
        <p className="font-medium">Dialox</p>
        <p className="text-xs text-white/60">{formatPhone(tollFree)} and system alerts</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col-reverse gap-2 overflow-y-auto p-3">
        {logs.map((log) => (
          <div
            key={log.id}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm text-white ${log.direction === 'inbound' ? 'self-end bg-[#005c4b]' : 'self-start bg-[#202c33]'}`}
          >
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{log.body}</p>
            <p className="mt-1 text-right text-[10px] text-white/50">
              {clockTime(log.createdAt, navigator.language)} {log.status === 'failed' && '· failed'}
            </p>
          </div>
        ))}
        {logs.length === 0 && (
          <p className="m-auto text-center text-sm text-white/40">No messages yet. Text START to register.</p>
        )}
      </div>
      {error && <p className="px-3 text-xs text-red-400">{error}</p>}
      <form
        className="flex gap-2 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) void send();
        }}
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Text message"
          aria-label="Text message"
          className="min-w-0 flex-1 rounded-full bg-[#2a3942] px-4 py-2 text-sm text-white outline-none placeholder:text-white/40"
        />
        <button type="submit" aria-label="Send SMS" className="rounded-full bg-[#00a884] p-2.5 text-[#111b21]">
          <SendHorizontal size={18} />
        </button>
      </form>
    </div>
  );
}

function GatewayLog() {
  const logs = useSmsLog(null, true);
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-gm-line bg-gm-surface">
      <header className="border-b border-gm-line px-5 py-3">
        <h2 className="font-medium">SMS gateway log</h2>
        <p className="text-xs text-gm-muted">
          Every SMS in or out of the system, live: OTPs, welcome messages and new-mail alerts.
        </p>
      </header>
      <ul className="min-h-0 flex-1 divide-y divide-gm-line overflow-y-auto text-sm">
        {logs.map((log) => (
          <li key={log.id} className="grid grid-cols-[5.5rem_1fr] gap-3 px-5 py-2.5">
            <span className="text-xs text-gm-muted">
              {clockTime(log.createdAt, navigator.language)}
              <span
                className={`mt-1 block w-fit rounded px-1.5 text-[10px] font-medium uppercase ${log.direction === 'inbound' ? 'bg-[#e8f0fe] text-[#1967d2] dark:bg-[#1967d2]/30 dark:text-[#8ab4f8]' : 'bg-[#e6f4ea] text-[#137333] dark:bg-[#137333]/30 dark:text-[#81c995]'}`}
              >
                {log.direction === 'inbound' ? 'in' : 'out'}
              </span>
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium">
                {formatPhone(log.phone)} · {log.provider}
                {log.status === 'failed' && <span className="text-red-500"> · failed</span>}
              </span>
              <span className="block whitespace-pre-wrap text-gm-muted [overflow-wrap:anywhere]">{log.body}</span>
            </span>
          </li>
        ))}
        {logs.length === 0 && <li className="px-5 py-10 text-center text-gm-muted">No SMS traffic yet.</li>}
      </ul>
    </section>
  );
}

export function Simulator() {
  useThemePreference('system');
  const { data: config } = useConfig();
  const [tab, setTab] = useState<'phone' | 'sms'>('phone');
  const [input, setInput] = useState(() => detectedPhone() ?? DEFAULT_DEVICE);
  const devicePhone = config ? normalizePhone(input, config.defaultCountry) : null;

  useEffect(() => {
    if (devicePhone) rememberDevicePhone(devicePhone);
  }, [devicePhone]);

  if (config && !config.simulatorEnabled) {
    return (
      <p className="p-10 text-center">
        The telephony simulator is disabled on this deployment (SIMULATOR_ENABLED=false).
      </p>
    );
  }

  return (
    <div className="min-h-full bg-gm-bg p-4 font-google text-gm-text sm:p-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[380px_1fr]">
        <div>
          <h1 className="text-2xl">Virtual telephony simulator</h1>
          <p className="mt-1 text-sm text-gm-muted">
            A virtual phone wired to the same IVR and SMS webhooks Twilio calls.
          </p>
          <label className="mt-5 block text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Smartphone size={16} /> This virtual phone's number
            </span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={`mt-1 w-full rounded-md border bg-transparent px-3 py-2 outline-none ${devicePhone ? 'border-gm-line focus:border-gm-blue' : 'border-red-500'}`}
            />
            <span className="mt-1 block text-xs text-gm-muted">
              The mobile app "detects" this number as its SIM during onboarding.
            </span>
          </label>

          <div className="mx-auto mt-6 h-[640px] w-[340px] overflow-hidden rounded-[44px] border-[10px] border-[#1c1c1e] bg-[#111b21] shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="min-h-0 flex-1">
                {devicePhone && config ? (
                  tab === 'phone' ? (
                    <Dialer devicePhone={devicePhone} tollFree={config.tollFreeNumber} />
                  ) : (
                    <Messages devicePhone={devicePhone} tollFree={config.tollFreeNumber} />
                  )
                ) : (
                  <p className="p-8 text-center text-sm text-white/50">Enter a valid phone number above.</p>
                )}
              </div>
              <nav className="flex shrink-0 border-t border-white/10 bg-[#1f2c34]">
                {[
                  { id: 'phone' as const, icon: Phone, label: 'Phone' },
                  { id: 'sms' as const, icon: MessageSquareText, label: 'Messages' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs ${tab === item.id ? 'text-[#25d366]' : 'text-white/60'}`}
                  >
                    <item.icon size={20} />
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>

        <div className="flex min-h-[640px] flex-col gap-6 lg:pt-14">
          <section className="rounded-2xl border border-gm-line bg-gm-surface p-5 text-sm">
            <h2 className="font-medium">Try it</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-gm-muted">
              <li>
                Phone tab: call the toll-free number and press 1 to create an account (welcome SMS arrives in Messages).
              </li>
              <li>Messages tab: text START to register by SMS, STOP to pause alerts, HELP for help.</li>
              <li>Email the new address from another account: users without the mobile app get an SMS alert.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { to: '/', label: 'Mobile app' },
                { to: '/web', label: 'Web client' },
                { to: '/register', label: 'Registration portal' },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  target="_blank"
                  className="flex items-center gap-1.5 rounded-full border border-gm-line px-4 py-1.5 text-gm-blue hover:bg-gm-hover"
                >
                  {link.label} <ExternalLink size={14} />
                </Link>
              ))}
            </div>
          </section>
          <GatewayLog />
        </div>
      </div>
    </div>
  );
}
