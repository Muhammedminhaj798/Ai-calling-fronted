'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Async, Badge, Card, CustomerPicker, Empty, Field, Input, LinkButton, PageHeader, Pagination, Select, Status, Table, Td, Th, Toolbar, enumOptions } from '@/components/ui';
import { qs } from '@/lib/api';
import { fmtDateTime, fmtDuration, isMockProvider, languageName, providerName, shortId } from '@/lib/format';
import { endOfDay, startOfDay } from '@/lib/metrics';
import { CALL_STATUSES, LANGUAGES, type CallListItem, type Page } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const PAGE_SIZE = 25;

export default function CallsPage() {
  const [filters, setFilters] = useState({ from: '', to: '', status: '', handover: '', language: '', customerId: '' });
  const [page, setPage] = useState(1);
  const set = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const status = filters.handover === 'yes' ? 'handed_over' : filters.status;
  const q = useApi<Page<CallListItem>>(
    '/api/calls' +
      qs({
        status,
        customerId: filters.customerId,
        from: filters.from ? startOfDay(new Date(filters.from)).toISOString() : '',
        to: filters.to ? endOfDay(new Date(filters.to)).toISOString() : '',
        page,
        pageSize: PAGE_SIZE,
        sort: '-startedAt',
      }),
  );
  // Language and "not handed over" are not server-side filters (listCallsSchema): applied to the loaded page.
  const visible = (q.data?.data ?? []).filter((c) => (!filters.language || c.language === filters.language) && (filters.handover !== 'no' || c.status !== 'handed_over'));

  return (
    <>
      <PageHeader title="Call History" description="Every conversation session, including simulations and mock calls." />
      <Toolbar>
        <Field label="From">
          <Input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} />
        </Field>
        <Field label="To">
          <Input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
        </Field>
        <Field label="Outcome">
          <Select value={filters.status} onChange={(e) => set({ status: e.target.value })} options={enumOptions(CALL_STATUSES)} placeholder="All" disabled={filters.handover === 'yes'} />
        </Field>
        <Field label="Handover">
          <Select
            value={filters.handover}
            onChange={(e) => set({ handover: e.target.value })}
            options={[
              { value: 'yes', label: 'Handed over' },
              { value: 'no', label: 'Not handed over' },
            ]}
            placeholder="Any"
          />
        </Field>
        <Field label="Language" hint="Applies to the loaded page">
          <Select value={filters.language} onChange={(e) => set({ language: e.target.value })} options={LANGUAGES.map((l) => ({ value: l, label: languageName(l) }))} placeholder="All" />
        </Field>
        <Field label="Customer">
          <CustomerPicker value={filters.customerId} onChange={(customerId) => set({ customerId })} />
        </Field>
      </Toolbar>
      <Card padded={false}>
        <Async q={q} isEmpty={() => visible.length === 0} empty={<Empty title="No calls match these filters" />}>
          {(data) => (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Call</Th>
                    <Th>Customer</Th>
                    <Th>Caller</Th>
                    <Th>Started</Th>
                    <Th right>Duration</Th>
                    <Th>Language</Th>
                    <Th>Outcome</Th>
                    <Th>Order</Th>
                    <Th>Handover</Th>
                    <Th>Source</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <Td mono>
                        <Link href={`/dashboard/calls/${c.id}`} className="text-blue-700 hover:underline" title={c.id}>
                          {shortId(c.id)}
                        </Link>
                      </Td>
                      <Td>
                        {c.customer ? (
                          <Link href={`/dashboard/customers/${c.customer.id}`} className="text-blue-700 hover:underline">
                            {c.customer.name}
                          </Link>
                        ) : (
                          <span className="text-slate-400">Unregistered</span>
                        )}
                      </Td>
                      <Td mono>{c.fromNumber}</Td>
                      <Td>{fmtDateTime(c.startedAt)}</Td>
                      <Td right>{fmtDuration(c.durationSeconds)}</Td>
                      <Td>{languageName(c.language)}</Td>
                      <Td>
                        <Status value={c.status} />
                      </Td>
                      <Td>
                        {c.order ? (
                          <Link href={`/dashboard/orders/${c.order.id}`} className="font-mono text-xs text-blue-700 hover:underline">
                            {c.order.orderNumber}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td>{c.status === 'handed_over' ? <Badge tone="amber">{c.handoverReason ?? 'handed over'}</Badge> : '—'}</Td>
                      <Td>
                        <Badge tone={isMockProvider(c.provider) ? 'amber' : 'green'}>{providerName(c.provider)}</Badge>
                      </Td>
                      <Td right>
                        <LinkButton size="sm" href={`/dashboard/calls/${c.id}`}>
                          View
                        </LinkButton>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
            </>
          )}
        </Async>
      </Card>
    </>
  );
}
