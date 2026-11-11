'use client';
// Overview. KPIs are exact counts (`total` of filtered list calls); charts bucket the rows of the selected
// period fetched through the same list APIs (see lib/metrics.ts and fetchAll's row cap).
import Link from 'next/link';
import { useState } from 'react';
import { DayBars, RankedBars } from '@/components/charts';
import { Async, Card, Empty, PageHeader, Select, Status, cx } from '@/components/ui';
import { api, fetchAll, qs } from '@/lib/api';
import { fmtDateTime, fmtTime, label, languageName, money } from '@/lib/format';
import { countBy, countPerDay, percent, rangeFor, startOfDay, summariseCalls, type Preset } from '@/lib/metrics';
import type { CallListItem, ExceptionRecord, OrderListItem, OrderRecord, Page } from '@/lib/types';
import { useLoad } from '@/lib/use-api';

const total = (path: string, params: Record<string, string | number | undefined>) => api<Page<unknown>>(path + qs({ ...params, pageSize: 1 })).then((p) => p.total);

function Stat({ label: name, value, hint, href }: { label: string; value: string | number; hint?: string; href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{name}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </Link>
  );
}

export default function OverviewPage() {
  const [preset, setPreset] = useState<Preset>('7d');
  const kpis = useLoad(
    async () => {
      const today = startOfDay(new Date()).toISOString();
      const [callsToday, completedToday, activeCalls, ordersToday, pendingApprovals, openExceptions, inProgressExceptions] = await Promise.all([
        total('/api/calls', { from: today }),
        total('/api/calls', { from: today, status: 'completed' }),
        total('/api/calls', { status: 'in_progress' }),
        total('/api/orders', { from: today }),
        total('/api/approvals/pending', {}),
        total('/api/exceptions', { status: 'open' }),
        total('/api/exceptions', { status: 'in_progress' }),
      ]);
      return { callsToday, completedToday, activeCalls, ordersToday, pendingApprovals, openExceptions: openExceptions + inProgressExceptions };
    },
    [],
    { refreshMs: 30_000 },
  );
  const charts = useLoad(
    async () => {
      const { from, to } = rangeFor(preset);
      const range = { from: from.toISOString(), to: to.toISOString() };
      const [calls, orders] = await Promise.all([fetchAll<CallListItem>('/api/calls', range), fetchAll<OrderListItem>('/api/orders', range)]);
      return {
        complete: calls.complete && orders.complete,
        callsPerDay: countPerDay(calls.rows, (c) => c.startedAt, from, to),
        ordersPerDay: countPerDay(orders.rows, (o) => o.createdAt, from, to),
        outcomes: countBy(calls.rows, (c) => label(c.status)),
        languages: countBy(calls.rows, (c) => (c.language ? languageName(c.language) : null), 'Not detected'),
        summary: summariseCalls(calls.rows),
        rows: calls.rows.length,
      };
    },
    [preset],
  );
  const recent = useLoad(
    () =>
      Promise.all([
        api<Page<CallListItem>>('/api/calls' + qs({ pageSize: 5, sort: '-startedAt' })),
        api<Page<OrderListItem>>('/api/orders' + qs({ pageSize: 5, sort: '-createdAt' })),
        api<Page<ExceptionRecord>>('/api/exceptions' + qs({ status: 'open', pageSize: 5, sort: '-createdAt' })),
        api<Page<OrderRecord>>('/api/approvals/pending' + qs({ pageSize: 5 })),
      ]).then(([calls, orders, exceptions, approvals]) => ({ calls: calls.data, orders: orders.data, exceptions: exceptions.data, approvals: approvals.data })),
    [],
    { refreshMs: 30_000 },
  );

  return (
    <>
      <PageHeader title="Overview" description="Today's operations at a glance. KPIs refresh every 30 seconds." />
      <Async q={kpis}>
        {(k) => (
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Calls today" value={k.callsToday} href="/dashboard/calls" />
            <Stat label="Active calls" value={k.activeCalls} href="/dashboard/live-calls" />
            <Stat label="Orders created today" value={k.ordersToday} href="/dashboard/orders" />
            <Stat label="Pending approvals" value={k.pendingApprovals} href="/dashboard/approvals" />
            <Stat label="Open exceptions" value={k.openExceptions} hint="open + in progress" href="/dashboard/exceptions" />
            <Stat label="Successful call rate" value={k.callsToday ? percent(k.completedToday / k.callsToday) : '—'} hint={k.callsToday ? `${k.completedToday} of ${k.callsToday} completed today` : 'no calls today'} href="/dashboard/reports" />
          </div>
        )}
      </Async>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Trends</h2>
        <Select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} options={[{ value: 'today', label: 'Today' }, { value: '7d', label: 'Last 7 days' }, { value: '30d', label: 'Last 30 days' }]} aria-label="Period" />
      </div>
      <Async q={charts}>
        {(c) => (
          <div className={cx('mb-4 grid gap-4 lg:grid-cols-2', charts.refreshing && 'opacity-60')}>
            {!c.complete && <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 lg:col-span-2">Charts are based on the first {c.rows} rows of the period (row cap reached); counts above remain exact.</p>}
            <Card title="Calls per day">{c.rows ? <DayBars data={c.callsPerDay} name="Calls" /> : <Empty title="No calls in this period" />}</Card>
            <Card title="Orders per day">{c.ordersPerDay.some((d) => d.count) ? <DayBars data={c.ordersPerDay} name="Orders" /> : <Empty title="No orders in this period" />}</Card>
            <Card title="Call outcome distribution">{c.outcomes.length ? <RankedBars data={c.outcomes} /> : <Empty title="No calls in this period" />}</Card>
            <Card title="Language distribution">{c.languages.length ? <RankedBars data={c.languages} /> : <Empty title="No calls in this period" />}</Card>
          </div>
        )}
      </Async>

      <h2 className="mb-3 text-sm font-semibold text-slate-700">Recent activity</h2>
      <Async q={recent}>
        {(r) => (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <Card title="Recent calls" padded={false}>
              {r.calls.length === 0 ? (
                <Empty title="No calls yet" />
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {r.calls.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2">
                      <Link href={`/dashboard/calls/${c.id}`} className="min-w-0">
                        <span className="block truncate text-blue-700 hover:underline">{c.customer?.name ?? c.fromNumber}</span>
                        <span className="block text-xs text-slate-500">{fmtTime(c.startedAt)} · {languageName(c.language)}</span>
                      </Link>
                      <Status value={c.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Recent orders" padded={false}>
              {r.orders.length === 0 ? (
                <Empty title="No orders yet" />
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {r.orders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 px-4 py-2">
                      <Link href={`/dashboard/orders/${o.id}`} className="min-w-0">
                        <span className="block truncate font-mono text-xs text-blue-700 hover:underline">{o.orderNumber}</span>
                        <span className="block text-xs text-slate-500">{o.customer.name} · {money(o.totalPaise)}</span>
                      </Link>
                      <Status value={o.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Open exceptions" padded={false}>
              {r.exceptions.length === 0 ? (
                <Empty title="Queue is clear" />
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {r.exceptions.map((x) => (
                    <li key={x.id} className="px-4 py-2">
                      <Link href={`/dashboard/exceptions/${x.id}`} className="text-blue-700 hover:underline">
                        {label(x.type)}
                      </Link>
                      <span className="block truncate text-xs text-slate-500" title={x.description}>
                        {x.description}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Pending staff approvals" padded={false}>
              {r.approvals.length === 0 ? (
                <Empty title="Nothing to approve" />
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {r.approvals.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 px-4 py-2">
                      <Link href={`/dashboard/orders/${o.id}`} className="min-w-0">
                        <span className="block truncate font-mono text-xs text-blue-700 hover:underline">{o.orderNumber}</span>
                        <span className="block text-xs text-slate-500">{o.customer.name} · confirmed {fmtDateTime(o.customerConfirmedAt)}</span>
                      </Link>
                      <span className="text-sm tabular-nums">{money(o.totalPaise)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </Async>
    </>
  );
}
