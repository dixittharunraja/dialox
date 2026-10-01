import { formatPhone, normalizePhone, splitAddress, type Conversation, type Participant } from '@dialox/shared';
import { useCallback } from 'react';
import { useConfig } from './queries';

/** Names a participant: profile name, else a formatted phone for local numbers, else the address. */
export function useDisplayName() {
  const { data: config } = useConfig();
  return useCallback(
    (participant: Participant | string) => {
      const p = typeof participant === 'string' ? { address: participant, name: null } : participant;
      if (p.name) return p.name;
      const { local, domain } = splitAddress(p.address);
      if (config && domain === config.mailDomain) {
        const phone = normalizePhone(local, config.defaultCountry);
        if (phone) return formatPhone(phone);
      }
      return p.address;
    },
    [config],
  );
}

export function useConversationTitle() {
  const name = useDisplayName();
  return useCallback((c: Conversation) => c.participants.map((p) => name(p)).join(', '), [name]);
}

export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .trim()
    .split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 1)).toUpperCase() || '?';
}

const PALETTE = ['#1a73e8', '#d93025', '#188038', '#e37400', '#9334e6', '#007b83', '#c5221f', '#5f6368'];

export function colorFor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

const DAY = 86_400_000;

/** WhatsApp/Gmail style: time today, "Yesterday", weekday this week, date otherwise. */
export function shortTime(iso: string, locale: string, yesterday: string): string {
  const date = new Date(iso);
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  if (date.getTime() >= startOfToday) return date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  if (date.getTime() >= startOfToday - DAY) return yesterday;
  if (date.getTime() >= startOfToday - 6 * DAY) return date.toLocaleDateString(locale, { weekday: 'long' });
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: '2-digit' });
}

/** Chat day separator: "Today", "Yesterday" or a medium date. */
export function dayLabel(iso: string, locale: string, labels: { today: string; yesterday: string }): string {
  const time = new Date(iso).getTime();
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  if (time >= startOfToday) return labels.today;
  if (time >= startOfToday - DAY) return labels.yesterday;
  return new Date(iso).toLocaleDateString(locale, { dateStyle: 'medium' });
}

export function clockTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

export function fullDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
