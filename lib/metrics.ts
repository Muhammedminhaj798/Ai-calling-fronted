// Pure aggregation for the overview and reports: the backend has no analytics endpoints yet, so rows
// fetched through the existing list APIs are bucketed here. Nothing in this file touches the DOM
// except downloadCsv, so `node --test` can check it.

export type Preset = 'today' | '7d' | '30d' | 'custom';

const DAY_MS = 86_400_000;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Local calendar key YYYY-MM-DD */
export function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function rangeFor(preset: Preset, now = new Date(), custom?: { from: string; to: string }): { from: Date; to: Date } {
  if (preset === 'custom' && custom?.from && custom?.to) {
    return { from: startOfDay(new Date(custom.from)), to: endOfDay(new Date(custom.to)) };
  }
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 1;
  return { from: startOfDay(new Date(now.getTime() - (days - 1) * DAY_MS)), to: now };
}

export function daysBetween(from: Date, to: Date): string[] {
  const keys: string[] = [];
  for (let d = startOfDay(from); d.getTime() <= to.getTime(); d = new Date(d.getTime() + DAY_MS)) keys.push(dayKey(d));
  return keys;
}

/** One bucket per calendar day in [from, to], zero-filled. */
export function countPerDay<T>(rows: T[], at: (row: T) => string, from: Date, to: Date): Array<{ day: string; count: number }> {
  const counts = new Map<string, number>(daysBetween(from, to).map((k) => [k, 0]));
  for (const row of rows) {
    const k = dayKey(new Date(at(row)));
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].map(([day, count]) => ({ day, count }));
}

/** Distribution sorted by count, descending. */
export function countBy<T>(rows: T[], pick: (row: T) => string | null | undefined, fallback = 'unknown'): Array<{ name: string; value: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const k = pick(row) ?? fallback;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export interface CallLike {
  status: string;
  language: string | null;
  durationSeconds: number | null;
  order: { id: string } | null;
}

export interface CallSummary {
  total: number;
  completed: number;
  failed: number;
  handedOver: number;
  inProgress: number;
  withOrder: number;
  /** Mean of calls that have a recorded duration; null when none has one */
  avgDurationSeconds: number | null;
  durationSamples: number;
  successRate: number | null;
  conversionRate: number | null;
}

export function summariseCalls(calls: CallLike[]): CallSummary {
  const by = (s: string) => calls.filter((c) => c.status === s).length;
  const withDuration = calls.filter((c) => c.durationSeconds != null);
  const total = calls.length;
  const completed = by('completed');
  const withOrder = calls.filter((c) => c.order !== null).length;
  return {
    total,
    completed,
    failed: by('failed'),
    handedOver: by('handed_over'),
    inProgress: by('in_progress') + by('ringing'),
    withOrder,
    avgDurationSeconds: withDuration.length ? Math.round(withDuration.reduce((s, c) => s + (c.durationSeconds ?? 0), 0) / withDuration.length) : null,
    durationSamples: withDuration.length,
    successRate: total ? completed / total : null,
    conversionRate: total ? withOrder / total : null,
  };
}

export const percent = (ratio: number | null | undefined): string => (ratio == null ? '—' : `${Math.round(ratio * 100)}%`);

/** RFC 4180-style CSV: every cell quoted when it contains a comma, quote or newline. */
export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  const cols = columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: unknown): string => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
