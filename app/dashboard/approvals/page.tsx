'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Async, Badge, Banner, Card, CustomerPicker, Empty, Field, LinkButton, PageHeader, Pagination, Status, Table, Td, Th, Toolbar, cx } from '@/components/ui';
import { qs } from '@/lib/api';
import { fmtDateTime, money } from '@/lib/format';
import type { OrderListItem, OrderRecord, Page } from '@/lib/types';
import { useApi, useSession } from '@/lib/use-api';

type Tab = 'pending' | 'approved' | 'rejected';
const PAGE_SIZE = 25;

export default function ApprovalsPage() {
  const user = useSession().user;
  // null while the session is restoring: no role-dependent hint until the user is known
  const canDecide = !user || user.role === 'admin' || user.role === 'approver';
  const [tab, setTab] = useState<Tab>('pending');
  const [customerId, setCustomerId] = useState('');
  const [page, setPage] = useState(1);
  const pending = useApi<Page<OrderRecord>>(tab === 'pending' ? '/api/approvals/pending' + qs({ customerId, page, pageSize: PAGE_SIZE }) : null, { refreshMs: 30_000 });
  const decided = useApi<Page<OrderListItem>>(tab !== 'pending' ? '/api/orders' + qs({ status: tab, customerId, page, pageSize: PAGE_SIZE, sort: '-createdAt' }) : null);

  return (
    <>
      <PageHeader title="Staff Approvals" description="The mandatory human gate: nothing is fulfilled until an approver accepts the order." />
      {!canDecide && <Banner tone="blue">You can review the queue; approving or rejecting requires the approver or admin role.</Banner>}
      <div className="mb-4 flex gap-1 border-b border-slate-200" role="tablist">
        {(['pending', 'approved', 'rejected'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
            className={cx('-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize', tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >
            {t}
          </button>
        ))}
      </div>
      <Toolbar>
        <Field label="Customer">
          <CustomerPicker
            value={customerId}
            onChange={(id) => {
              setCustomerId(id);
              setPage(1);
            }}
          />
        </Field>
      </Toolbar>
      <Card padded={false}>
        {tab === 'pending' ? (
          <Async q={pending} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No orders waiting for approval" />}>
            {(data) => (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>Order</Th>
                      <Th>Customer</Th>
                      <Th right>Items</Th>
                      <Th right>Total</Th>
                      <Th>Reservation</Th>
                      <Th>Customer confirmed</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((o) => {
                      const active = o.reservations.filter((r) => r.status === 'active');
                      const expiry = active.map((r) => new Date(r.expiresAt).getTime()).sort()[0];
                      const expired = expiry !== undefined && expiry < Date.now();
                      const flagged = o.items.filter((i) => i.status === 'flagged').length;
                      return (
                        <tr key={o.id} className="hover:bg-slate-50">
                          <Td mono>
                            <Link href={`/dashboard/orders/${o.id}`} className="text-blue-700 hover:underline">
                              {o.orderNumber}
                            </Link>
                          </Td>
                          <Td>{o.customer.name}</Td>
                          <Td right>
                            {o.items.length}
                            {flagged > 0 && <span className="ml-1 text-xs text-amber-700">({flagged} flagged)</span>}
                          </Td>
                          <Td right>{money(o.totalPaise)}</Td>
                          <Td>
                            {active.length === 0 ? (
                              <Badge tone="red">No active reservation</Badge>
                            ) : (
                              <span className="flex flex-col">
                                <Badge tone={expired ? 'red' : 'green'}>
                                  {active.length} active{active[0]?.provider === 'mock' ? ' · mock' : ''}
                                </Badge>
                                <span className="text-xs text-slate-500">{expired ? 'expired' : 'expires'} {fmtDateTime(new Date(expiry!).toISOString())}</span>
                              </span>
                            )}
                          </Td>
                          <Td>{fmtDateTime(o.customerConfirmedAt)}</Td>
                          <Td right>
                            <LinkButton size="sm" variant={canDecide ? 'primary' : 'secondary'} href={`/dashboard/orders/${o.id}`}>
                              Review
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
        ) : (
          <Async q={decided} isEmpty={(d) => d.data.length === 0} empty={<Empty title={`No ${tab} orders`} />}>
            {(data) => (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>Order</Th>
                      <Th>Customer</Th>
                      <Th right>Items</Th>
                      <Th right>Total</Th>
                      <Th>Status</Th>
                      <Th>Customer confirmed</Th>
                      <Th>Decided</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50">
                        <Td mono>
                          <Link href={`/dashboard/orders/${o.id}`} className="text-blue-700 hover:underline">
                            {o.orderNumber}
                          </Link>
                        </Td>
                        <Td>{o.customer.name}</Td>
                        <Td right>{o.items.length}</Td>
                        <Td right>{money(o.totalPaise)}</Td>
                        <Td>
                          <Status value={o.status} />
                        </Td>
                        <Td>{fmtDateTime(o.customerConfirmedAt)}</Td>
                        <Td>{fmtDateTime(o.updatedAt)}</Td>
                        <Td right>
                          <LinkButton size="sm" href={`/dashboard/orders/${o.id}`}>
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
        )}
      </Card>
    </>
  );
}
