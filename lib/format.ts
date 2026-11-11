// Display helpers: money (paise → INR), dates, durations, enum labels and the status → colour map.
import type { Language } from './types';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });
const timeOnly = new Intl.DateTimeFormat('en-IN', { timeStyle: 'medium' });

export const money = (paise: number | null | undefined): string => (paise == null ? '—' : inr.format(paise / 100));
export const fmtDateTime = (iso?: string | null): string => (iso ? dateTime.format(new Date(iso)) : '—');
export const fmtDate = (iso?: string | null): string => (iso ? dateOnly.format(new Date(iso)) : '—');
export const fmtTime = (iso?: string | null): string => (iso ? timeOnly.format(new Date(iso)) : '—');

export function fmtDuration(seconds?: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m ? `${m}m ${s}s` : `${s}s`;
}
export const secondsSince = (iso: string, now = Date.now()): number => Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));

export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', ml: 'Malayalam', ta: 'Tamil', hi: 'Hindi' };
export const languageName = (l?: string | null): string => (l ? (LANGUAGE_NAMES[l as Language] ?? l) : '—');

export const PROVIDER_NAMES: Record<string, string> = { simulator: 'Text simulation', mock: 'Mock telephony', exotel: 'Exotel' };
export const providerName = (p?: string | null): string => (p ? (PROVIDER_NAMES[p] ?? p) : '—');
export const isMockProvider = (p?: string | null): boolean => p === 'mock' || p === 'simulator';

/** "pending_staff_approval" → "Pending staff approval" */
export const label = (v?: string | null): string => (v ? v.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—');

export const shortId = (id?: string | null): string => (id ? id.slice(0, 8) : '—');

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'slate' | 'violet';
const TONES: Record<string, Tone> = {
  // calls
  ringing: 'blue',
  in_progress: 'blue',
  completed: 'green',
  handed_over: 'amber',
  failed: 'red',
  handover_required: 'amber',
  // orders
  draft: 'slate',
  pending_customer_confirmation: 'amber',
  customer_confirmed: 'blue',
  pending_stock_reservation: 'blue',
  pending_staff_approval: 'amber',
  approved: 'green',
  rejected: 'red',
  cancelled: 'slate',
  fulfilled: 'green',
  // exceptions / customers / products / reservations / lines
  open: 'red',
  resolved: 'green',
  dismissed: 'slate',
  active: 'green',
  inactive: 'slate',
  blocked: 'red',
  discontinued: 'red',
  consumed: 'green',
  released: 'slate',
  expired: 'red',
  in_stock: 'green',
  insufficient: 'amber',
  out_of_stock: 'red',
  unknown: 'slate',
  unchecked: 'slate',
  error: 'red',
  flagged: 'amber',
  accepted: 'green',
  declined: 'red',
  pending: 'amber',
  confirmed: 'green',
  superseded: 'slate',
  mock: 'amber',
  simulator: 'violet',
};
export const toneOf = (v?: string | null): Tone => (v && TONES[v]) || 'slate';
