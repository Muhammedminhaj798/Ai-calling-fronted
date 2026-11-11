'use client';
// Operational reporting computed client-side from the list APIs (no analytics endpoint yet). Every
// number states its basis; CSV exports contain the rows the figures were computed from.
import { Download } from 'lucide-react';
import { useState } from 'react';
import { RankedBars } from '@/components/charts';
import { Async, Banner, Button, Card, Field, Input, PageHeader, Select, Table, Td, Th, Toolbar } from '@/components/ui';
import { api, fetchAll, qs } from '@/lib/api';
import { fmtDuration, label, languageName, money } from '@/lib/format';
import { countBy, dayKey, downloadCsv, percent, rangeFor, summariseCalls, toCsv, type Preset } from '@/lib/metrics';
import type { CallListItem, OrderListItem, Page } from '@/lib/types';
import { useLoad } from '@/lib/use-api';

export default function ReportsPage() {
  const [preset, setPreset] = useState<Preset>('7d');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const ready = preset !== 'custom' || (custom.from && custom.to && custom.from <= custom.to);
  const report = useLoad(
    async () => {
      const { from, to } = rangeFor(preset, new Date(), custom);
      const range = { from: from.toISOString(), to: to.toISOString() };
      const [calls, orders, open, inProgress] = await Promise.all([
        fetchAll<CallListItem>('/api/calls', range),
        fetchAll<OrderListItem>('/api/orders', range),
        api<Page<unknown>>('/api/exceptions' + qs({ status: 'open', pageSize: 1 })).then((p) => p.total),
        api<Page<unknown>>('/api/exceptions' + qs({ status: 'in_progress', pageSize: 1 })).then((p) => p.total),
      ]);
      const openExceptions = open + inProgress;
      const summary = summariseCalls(calls.rows);
      return {
        from,
        to,
        calls,
        orders,
        summary,
        ordersApproved: orders.rows.filter((o) => o.status === 'approved' || o.status === 'fulfilled').length,
        openExceptions,
        languages: countBy(calls.rows, (c) => (c.language ? languageName(c.language) : null), 'Not detected'),
      };
    },
    [preset, custom.from, custom.to],
    { enabled: Boolean(ready) },
  );

  return (
    <>
      <PageHeader
        title="Reports"
        description="Operational metrics for the selected period."
        actions={
          report.data && (
            <>
              <Button onClick={() => downloadCsv(`calls-${dayKey(report.data!.from)}-${dayKey(report.data!.to)}.csv`, toCsv(report.data!.calls.rows.map((c) => ({ id: c.id, startedAt: c.startedAt, endedAt: c.endedAt, durationSeconds: c.durationSeconds, provider: c.provider, fromNumber: c.fromNumber, customer: c.customer?.name ?? '', customerCode: c.customer?.externalCode ?? '', language: c.language ?? '', status: c.status, conversationState: c.conversationState, handoverReason: c.handoverReason ?? '', orderNumber: c.order?.orderNumber ?? '' }))))}>
                <Download className="h-4 w-4" /> Calls CSV
              </Button>
              <Button onClick={() => downloadCsv(`orders-${dayKey(report.data!.from)}-${dayKey(report.data!.to)}.csv`, toCsv(report.data!.orders.rows.map((o) => ({ orderNumber: o.orderNumber, createdAt: o.createdAt, customer: o.customer.name, customerCode: o.customer.externalCode, status: o.status, items: o.items.length, flaggedItems: o.items.filter((i) => i.status === 'flagged').length, subtotalInr: o.subtotalPaise / 100, totalInr: o.totalPaise / 100, customerConfirmedAt: o.customerConfirmedAt ?? '', callId: o.callId ?? '' }))))}>
                <Download className="h-4 w-4" /> Orders CSV
              </Button>
            </>
          )
        }
      />
      <Toolbar>
        <Field label="Period">
          <Select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} options={[{ value: 'today', label: 'Today' }, { value: '7d', label: 'Last 7 days' }, { value: '30d', label: 'Last 30 days' }, { value: 'custom', label: 'Custom range' }]} />
        </Field>
        {preset === 'custom' && (
          <>
            <Field label="From">
              <Input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            </Field>
            <Field label="To">
              <Input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </Field>
          </>
        )}
      </Toolbar>
      {!ready && <Banner tone="blue">Pick a start and end date to run the custom report.</Banner>}
      <Async q={report}>
        {(r) => {
          const s = r.summary;
          const rows: Array<[string, string | number, string]> = [
            ['Total calls', s.total, 'Calls started in the period'],
            ['Completed calls', s.completed, 'status = completed'],
            ['Failed calls', s.failed, 'status = failed'],
            ['Human handovers', s.handedOver, 'status = handed_over'],
            ['Calls still in progress', s.inProgress, 'status = in_progress'],
            ['Orders created', r.orders.total, 'Orders created in the period'],
            ['Orders approved', r.ordersApproved, 'Of the orders created in the period, those now approved or fulfilled'],
            ['Pending exceptions', r.openExceptions, 'Open or in progress right now (not date-filtered: the API has no date filter)'],
            ['Average call duration', fmtDuration(s.avgDurationSeconds), s.durationSamples ? `Mean of ${s.durationSamples} calls with a recorded duration` : 'No call has a recorded duration (set by the telephony status webhook or session end)'],
            ['Order conversion rate', percent(s.conversionRate), `${s.withOrder} of ${s.total} calls produced an order`],
            ['Successful call rate', percent(s.successRate), `${s.completed} of ${s.total} calls completed`],
            ['Order value (created)', money(r.orders.rows.reduce((sum, o) => sum + o.totalPaise, 0)), 'Sum of order totals; tax is 0 until pricing rules arrive'],
          ];
          return (
            <>
              {(!r.calls.complete || !r.orders.complete) && <Banner>The period has more rows than the dashboard fetches ({r.calls.rows.length} of {r.calls.total} calls, {r.orders.rows.length} of {r.orders.total} orders). Per-row figures are partial; add a server-side report endpoint for exact numbers.</Banner>}
              <div className="grid gap-4 lg:grid-cols-3">
                <Card title="Summary" padded={false} className="lg:col-span-2">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Metric</Th>
                        <Th right>Value</Th>
                        <Th>Basis</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(([name, value, basis]) => (
                        <tr key={name}>
                          <Td className="font-medium text-slate-800">{name}</Td>
                          <Td right className="text-base font-semibold">
                            {value}
                          </Td>
                          <Td className="text-xs text-slate-500">{basis}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  <div className="flex justify-end px-3 py-2">
                    <Button size="sm" onClick={() => downloadCsv(`summary-${dayKey(r.from)}-${dayKey(r.to)}.csv`, toCsv(rows.map(([metric, value, basis]) => ({ metric, value, basis }))))}>
                      <Download className="h-3.5 w-3.5" /> Summary CSV
                    </Button>
                  </div>
                </Card>
                <div className="flex flex-col gap-4">
                  <Card title="Language distribution">{r.languages.length ? <RankedBars data={r.languages} /> : <p className="text-sm text-slate-500">No calls in this period.</p>}</Card>
                  <Card title="Call outcomes">{s.total ? <RankedBars data={countBy(r.calls.rows, (c) => label(c.status))} /> : <p className="text-sm text-slate-500">No calls in this period.</p>}</Card>
                </div>
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}
