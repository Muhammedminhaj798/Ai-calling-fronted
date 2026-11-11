'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Async, Card, CustomerPicker, Empty, Field, Input, LinkButton, PageHeader, Pagination, Select, Status, Table, Td, Th, Toolbar, enumOptions } from '@/components/ui';
import { qs } from '@/lib/api';
import { fmtDateTime, money, shortId } from '@/lib/format';
import { endOfDay, startOfDay } from '@/lib/metrics';
import { ORDER_STATUSES, type OrderListItem, type Page } from '@/lib/types';
import { useApi, useDebounce } from '@/lib/use-api';

const PAGE_SIZE = 25;

export default function OrdersPage() {
  const [filters, setFilters] = useState({ q: '', status: '', from: '', to: '', customerId: '' });
  const [page, setPage] = useState(1);
  const set = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const q = useDebounce(filters.q.trim());
  const list = useApi<Page<OrderListItem>>(
    '/api/orders' +
      qs({
        q,
        status: filters.status,
        customerId: filters.customerId,
        from: filters.from ? startOfDay(new Date(filters.from)).toISOString() : '',
        to: filters.to ? endOfDay(new Date(filters.to)).toISOString() : '',
        page,
        pageSize: PAGE_SIZE,
        sort: '-createdAt',
      }),
  );

  return (
    <>
      <PageHeader title="Orders" description="Orders taken by the AI agent or entered by staff. Totals use catalogue PTR prices; tax is 0 until pricing rules arrive." />
      <Toolbar>
        <Field label="Order number">
          <Input value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="PO-2026…" />
        </Field>
        <Field label="Status">
          <Select value={filters.status} onChange={(e) => set({ status: e.target.value })} options={enumOptions(ORDER_STATUSES)} placeholder="All" />
        </Field>
        <Field label="From">
          <Input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} />
        </Field>
        <Field label="To">
          <Input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
        </Field>
        <Field label="Customer">
          <CustomerPicker value={filters.customerId} onChange={(customerId) => set({ customerId })} />
        </Field>
      </Toolbar>
      <Card padded={false}>
        <Async q={list} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No orders match these filters" />}>
          {(data) => (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Order</Th>
                    <Th>Customer</Th>
                    <Th>PO reference</Th>
                    <Th right>Items</Th>
                    <Th right>Total</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                    <Th>Call</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((o) => {
                    const flagged = o.items.filter((i) => i.status === 'flagged').length;
                    return (
                      <tr key={o.id} className="hover:bg-slate-50">
                        <Td mono>
                          <Link href={`/dashboard/orders/${o.id}`} className="text-blue-700 hover:underline">
                            {o.orderNumber}
                          </Link>
                        </Td>
                        <Td>
                          <Link href={`/dashboard/customers/${o.customer.id}`} className="text-blue-700 hover:underline">
                            {o.customer.name}
                          </Link>
                          <span className="block text-xs text-slate-400">{o.customer.externalCode}</span>
                        </Td>
                        <Td>{o.customerPoReference ?? '—'}</Td>
                        <Td right>
                          {o.items.length}
                          {flagged > 0 && <span className="ml-1 text-xs text-amber-700">({flagged} flagged)</span>}
                        </Td>
                        <Td right>{money(o.totalPaise)}</Td>
                        <Td>
                          <Status value={o.status} />
                        </Td>
                        <Td>{fmtDateTime(o.createdAt)}</Td>
                        <Td mono>
                          {o.callId ? (
                            <Link href={`/dashboard/calls/${o.callId}`} className="text-blue-700 hover:underline" title={o.callId}>
                              {shortId(o.callId)}
                            </Link>
                          ) : (
                            <span className="text-slate-400">manual</span>
                          )}
                        </Td>
                        <Td right>
                          <LinkButton size="sm" href={`/dashboard/orders/${o.id}`}>
                            View
                          </LinkButton>
                        </Td>
                      </tr>
                    );
                  })}
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
