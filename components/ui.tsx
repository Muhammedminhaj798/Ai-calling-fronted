'use client';
// The whole UI kit in one file: badges, buttons, cards, tables, pagination, states, fields, dialog.
// Native elements first (<dialog>, <select>, <input type="date">); Tailwind classes only.
import { AlertCircle, ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { qs, type ApiError } from '@/lib/api';
import { label as enumLabel, toneOf, type Tone } from '@/lib/format';
import type { Customer, Page } from '@/lib/types';
import { useApi, useDebounce, type Query } from '@/lib/use-api';

export const cx = (...parts: Array<string | false | null | undefined>): string => parts.filter(Boolean).join(' ');

// --- badges ---
const TONE_CLASS: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
};
export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap', TONE_CLASS[tone], className)}>{children}</span>;
}
/** Enum value → coloured badge with a readable label */
export function Status({ value }: { value?: string | null }) {
  return <Badge tone={toneOf(value)}>{enumLabel(value)}</Badge>;
}

// --- buttons ---
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  ghost: 'text-slate-600 hover:bg-slate-100 disabled:text-slate-400',
};
export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={cx('inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm', VARIANT[variant], className)}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
export function LinkButton({ href, children, className, variant = 'secondary', size = 'md' }: { href: string; children: ReactNode; className?: string; variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <Link href={href} className={cx('inline-flex items-center gap-1.5 rounded-md font-medium transition-colors', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm', VARIANT[variant], className)}>
      {children}
    </Link>
  );
}

// --- layout ---
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
export function Card({ title, actions, children, className, padded = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cx('rounded-lg border border-slate-200 bg-white shadow-sm', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {actions}
        </header>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  );
}
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">{children}</div>;
}
export function KeyValue({ items, columns = 2 }: { items: Array<[string, ReactNode]>; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cx('grid gap-x-6 gap-y-3 text-sm', columns === 1 ? 'grid-cols-1' : columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{k}</dt>
          <dd className="mt-0.5 break-words text-slate-800">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Banner({ tone = 'amber', children }: { tone?: 'amber' | 'blue' | 'red'; children: ReactNode }) {
  const c = { amber: 'border-amber-300 bg-amber-50 text-amber-900', blue: 'border-blue-300 bg-blue-50 text-blue-900', red: 'border-red-300 bg-red-50 text-red-900' }[tone];
  return (
    <div className={cx('mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm', c)}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

// --- tables ---
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className, right }: { children?: ReactNode; className?: string; right?: boolean }) {
  return <th className={cx('sticky top-0 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500', right ? 'text-right' : 'text-left', className)}>{children}</th>;
}
export function Td({ children, className, right, mono }: { children?: ReactNode; className?: string; right?: boolean; mono?: boolean }) {
  return <td className={cx('border-b border-slate-100 px-3 py-2 align-top text-slate-700', right && 'text-right tabular-nums', mono && 'font-mono text-xs', className)}>{children}</td>;
}
export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  return (
    <nav className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-slate-500" aria-label="Pagination">
      <span>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        <Button size="sm" variant="ghost" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}

// --- states ---
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-slate-500" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}
export function ErrorBox({ error, retry }: { error: ApiError | Error; retry?: () => void }) {
  const code = 'code' in error ? error.code : undefined;
  return (
    <div className="m-3 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1">
        <p className="font-medium">{error.message}</p>
        {code && <p className="mt-0.5 text-xs text-red-600">{code}</p>}
      </div>
      {retry && (
        <Button size="sm" onClick={retry}>
          Retry
        </Button>
      )}
    </div>
  );
}
export function Empty({ title = 'Nothing here yet', hint }: { title?: string; hint?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 p-10 text-center text-sm text-slate-500">
      <Inbox className="mb-1 h-6 w-6 text-slate-300" aria-hidden />
      <p className="font-medium text-slate-600">{title}</p>
      {hint && <p className="text-xs">{hint}</p>}
    </div>
  );
}
/** Loading / error / empty / data in one place. */
export function Async<T>({ q, isEmpty, empty, children }: { q: Query<T>; isEmpty?: (d: T) => boolean; empty?: ReactNode; children: (data: T) => ReactNode }) {
  if (q.data === undefined) return q.error ? <ErrorBox error={q.error} retry={q.reload} /> : <Spinner />;
  if (isEmpty?.(q.data)) return <>{empty ?? <Empty />}</>;
  return (
    <div className={cx(q.refreshing && 'opacity-60 transition-opacity')}>
      {q.error && <ErrorBox error={q.error} retry={q.reload} />}
      {children(q.data)}
    </div>
  );
}

// --- forms ---
export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cx('flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600', className)}>
      {label}
      {children}
      {hint && <span className="font-normal text-slate-400">{hint}</span>}
    </label>
  );
}
const CONTROL = 'rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-normal text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50';
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(CONTROL, props.className)} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(CONTROL, 'min-h-20', props.className)} />;
}
export function Select({ options, placeholder, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: Array<{ value: string; label: string }>; placeholder?: string }) {
  return (
    <select {...props} className={cx(CONTROL, props.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
export const enumOptions = (values: readonly string[]) => values.map((v) => ({ value: v, label: enumLabel(v) }));

// --- dialog (native <dialog>) ---
export function Dialog({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-full max-w-lg rounded-lg border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/40">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="px-4 py-3 text-sm text-slate-700">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">{footer}</div>}
    </dialog>
  );
}

// --- pickers ---

/** Customer filter: native <datalist> fed by GET /api/customers?q=; emits the chosen customer's id. */
export function CustomerPicker({ value, onChange, className }: { value: string; onChange: (id: string) => void; className?: string }) {
  const [text, setText] = useState('');
  const q = useDebounce(text.trim());
  const listId = useId();
  const res = useApi<Page<Customer>>(q.length >= 2 ? '/api/customers' + qs({ q, pageSize: 10 }) : null);
  const options = res.data?.data ?? [];
  return (
    <>
      <input
        list={listId}
        value={text}
        placeholder={value ? 'Selected' : 'Name, code or phone'}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          const hit = options.find((c) => `${c.name} (${c.externalCode})` === v);
          onChange(hit ? hit.id : '');
        }}
        className={cx(CONTROL, className)}
        aria-label="Customer"
      />
      <datalist id={listId}>
        {options.map((c) => (
          <option key={c.id} value={`${c.name} (${c.externalCode})`} />
        ))}
      </datalist>
    </>
  );
}
