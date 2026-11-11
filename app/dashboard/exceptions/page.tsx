'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Async, Card, CustomerPicker, Empty, Field, LinkButton, PageHeader, Pagination, Select, Spinner, Status, Table, Td, Th, Toolbar, enumOptions } from '@/components/ui';
import { qs } from '@/lib/api';
import { fmtDateTime, label, shortId } from '@/lib/format';
import { EXCEPTION_STATUSES, EXCEPTION_TYPES, type ExceptionRecord, type Page, type StaffUser } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const PAGE_SIZE = 25;

function ExceptionsList() {
  const params = useSearchParams();
  const orderId = params.get('orderId') ?? '';
  const [filters, setFilters] = useState({ type: '', status: '', assignedTo: '', customerId: '' });
  const [page, setPage] = useState(1);
  const set = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const staff = useApi<{ staff: StaffUser[] }>('/api/staff');
  const q = useApi<Page<ExceptionRecord>>('/api/exceptions' + qs({ ...filters, orderId, page, pageSize: PAGE_SIZE, sort: '-createdAt' }));

  return (
    <>
      <PageHeader title="Exceptions" description={orderId ? `Exceptions linked to order ${shortId(orderId)}.` : 'Everything the automated flow could not resolve on its own.'} actions={orderId && <LinkButton href="/dashboard/exceptions">Clear order filter</LinkButton>} />
      <Toolbar>
        <Field label="Type">
          <Select value={filters.type} onChange={(e) => set({ type: e.target.value })} options={enumOptions(EXCEPTION_TYPES)} placeholder="All types" />
        </Field>
        <Field label="Status">
          <Select value={filters.status} onChange={(e) => set({ status: e.target.value })} options={enumOptions(EXCEPTION_STATUSES)} placeholder="All" />
        </Field>
        <Field label="Assigned to">
          <Select
            value={filters.assignedTo}
            onChange={(e) => set({ assignedTo: e.target.value })}
            options={[{ value: 'me', label: 'Me' }, { value: 'unassigned', label: 'Unassigned' }, ...(staff.data?.staff ?? []).map((s) => ({ value: s.id, label: s.name }))]}
            placeholder="Anyone"
          />
        </Field>
        <Field label="Customer">
          <CustomerPicker value={filters.customerId} onChange={(customerId) => set({ customerId })} />
        </Field>
        <p className="self-center text-xs text-slate-400">Date-range filtering is not supported by GET /api/exceptions; sort is newest first.</p>
      </Toolbar>
      <Card padded={false}>
        <Async q={q} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No exceptions match these filters" />}>
          {(data) => (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>ID</Th>
                    <Th>Type</Th>
                    <Th>Customer</Th>
                    <Th>Order</Th>
                    <Th>Description</Th>
                    <Th>Assigned</Th>
                    <Th>Created</Th>
                    <Th>Status</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((x) => (
                    <tr key={x.id} className="hover:bg-slate-50">
                      <Td mono>
                        <Link href={`/dashboard/exceptions/${x.id}`} className="text-blue-700 hover:underline" title={x.id}>
                          {shortId(x.id)}
                        </Link>
                      </Td>
                      <Td>{label(x.type)}</Td>
                      <Td>
                        {x.customer ? (
                          <Link href={`/dashboard/customers/${x.customer.id}`} className="text-blue-700 hover:underline">
                            {x.customer.name}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td mono>
                        {x.order ? (
                          <Link href={`/dashboard/orders/${x.order.id}`} className="text-blue-700 hover:underline">
                            {x.order.orderNumber}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td className="max-w-md">
                        <span className="line-clamp-2" title={x.description}>
                          {x.description}
                        </span>
                      </Td>
                      <Td>{x.assignee?.name ?? <span className="text-slate-400">Unassigned</span>}</Td>
                      <Td>{fmtDateTime(x.createdAt)}</Td>
                      <Td>
                        <Status value={x.status} />
                      </Td>
                      <Td right>
                        <LinkButton size="sm" href={`/dashboard/exceptions/${x.id}`}>
                          Open
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

export default function ExceptionsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ExceptionsList />
    </Suspense>
  );
}
