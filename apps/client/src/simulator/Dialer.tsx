import { formatPhone } from '@dialox/shared';
import { Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { request } from '@/lib/api';
import { parseTwiml, type TwimlStep } from './twiml';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
const GATHER_TIMEOUT_MS = 12_000;

type Line = { who: 'ivr' | 'you' | 'system'; text: string };

/** Virtual handset: dials the toll-free IVR and plays its TwiML (speech + DTMF keypad). */
export function Dialer({ devicePhone, tollFree }: { devicePhone: string | null; tollFree: string }) {
  const [state, setState] = useState<'idle' | 'in-call' | 'ended'>('idle');
  const [lines, setLines] = useState<Line[]>([]);
  const [awaitingDigits, setAwaitingDigits] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const pending = useRef<TwimlStep[]>([]);
  const gatherTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const transcript = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: 'smooth' });
  }, [lines]);
  useEffect(
    () => () => {
      clearTimeout(gatherTimer.current);
      speechSynthesis.cancel();
    },
    [],
  );

  const say = (text: string) => {
    setLines((l) => [...l, { who: 'ivr', text }]);
    if (speaker && 'speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  const hangUp = (note = 'Call ended') => {
    clearTimeout(gatherTimer.current);
    setAwaitingDigits(false);
    setState('ended');
    setLines((l) => [...l, { who: 'system', text: note }]);
  };

  // Executes steps until a Gather pauses for keypad input (or the call ends).
  const run = (steps: TwimlStep[]) => {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.verb === 'say') say(step.text);
      else if (step.verb === 'hangup') return hangUp();
      else if (step.verb === 'redirect') return void dial();
      else if (step.verb === 'gather') {
        step.prompts.forEach(say);
        pending.current = steps.slice(i + 1);
        setAwaitingDigits(true);
        gatherTimer.current = setTimeout(() => {
          setAwaitingDigits(false);
          run(pending.current);
        }, GATHER_TIMEOUT_MS);
        return;
      }
    }
  };

  async function dial() {
    if (!devicePhone) return;
    setState('in-call');
    setLines((l) => (l.length ? l : [{ who: 'system', text: `Calling ${formatPhone(tollFree)}...` }]));
    try {
      run(parseTwiml(await request<string>('/api/simulator/call', { method: 'POST', body: { from: devicePhone } })));
    } catch (e) {
      hangUp((e as Error).message);
    }
  }

  const press = async (digit: string) => {
    if (!awaitingDigits || !devicePhone) return;
    clearTimeout(gatherTimer.current);
    setAwaitingDigits(false);
    speechSynthesis.cancel();
    setLines((l) => [...l, { who: 'you', text: `Pressed ${digit}` }]);
    try {
      const xml = await request<string>('/api/simulator/call/gather', {
        method: 'POST',
        body: { from: devicePhone, digits: digit },
      });
      run(parseTwiml(xml));
    } catch (e) {
      hangUp((e as Error).message);
    }
  };

  const inCall = state === 'in-call';
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 text-center">
        <p className="text-xs tracking-widest text-white/50 uppercase">{inCall ? 'Dialox IVR' : 'Toll-free'}</p>
        <p className="mt-1 text-2xl font-light text-white">{formatPhone(tollFree)}</p>
        {inCall && (
          <p className="mt-1 text-xs text-[#25d366]">{awaitingDigits ? 'Waiting for keypad input' : 'Connected'}</p>
        )}
      </div>
      <div
        ref={transcript}
        aria-live="polite"
        className="mx-4 mt-3 min-h-24 flex-1 space-y-2 overflow-y-auto rounded-xl bg-white/5 p-3 text-sm"
      >
        {lines.length === 0 && <p className="text-white/40">Press call to dial the IVR from this virtual phone.</p>}
        {lines.map((line, i) => (
          <p
            key={i}
            className={
              line.who === 'you'
                ? 'text-right text-[#53bdeb]'
                : line.who === 'system'
                  ? 'text-center text-xs text-white/40'
                  : 'text-white/90'
            }
          >
            {line.text}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 px-8 pt-4">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => void press(key)}
            className={`h-14 rounded-full text-2xl font-light text-white transition ${awaitingDigits ? 'bg-white/20 hover:bg-white/30' : 'bg-white/5'}`}
          >
            {key}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-6 py-5">
        <button
          type="button"
          aria-label={speaker ? 'Mute speaker' : 'Unmute speaker'}
          onClick={() => setSpeaker((s) => !s)}
          className="rounded-full bg-white/10 p-3 text-white"
        >
          {speaker ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
        {inCall ? (
          <button
            type="button"
            aria-label="Hang up"
            onClick={() => hangUp()}
            className="rounded-full bg-red-500 p-4 text-white"
          >
            <PhoneOff size={26} />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Call"
            disabled={!devicePhone}
            onClick={() => {
              setLines([]);
              void dial();
            }}
            className="rounded-full bg-[#25d366] p-4 text-white disabled:opacity-40"
          >
            <Phone size={26} />
          </button>
        )}
        <span className="w-11" />
      </div>
    </div>
  );
}
