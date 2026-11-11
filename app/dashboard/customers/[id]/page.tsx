'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Async, Badge, Card, Empty, KeyValue, LinkButton, PageHeader, Status, Table, Td, Th } from '@/components/ui';
import { qs } from '@/lib/api';
import { fmtDateTime, fmtDuration, languageName, money } from '@/lib/format';
import type { CallListItem, Customer, OrderListItem, Page } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useApi<{ customer: Customer }>(`/api/customers/${id}`);
  const orders = useApi<Page<OrderListItem>>('/api/orders' + qs({ customerId: id, pageSize: 10, sort: '-createdAt' }));
  const calls = useApi<Page<CallListItem>>('/api/calls' + qs({ customerId: id, pageSize: 10, sort: '-startedAt' }));

  return (
    <Async q={q}>
      {({ customer: c }) => (
        <>
          <PageHeader title={c.name} description={<span className="font-mono">{c.externalCode}</span>} actions={<Status value={c.status} />} />
          {c.status !== 'active' && <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">Only active customers go through automated phone ordering; calls from this number are handed over to staff.</p>}
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="flex flex-col gap-4 xl:col-span-2">
              <Card title="Customer">
                <KeyValue
                  columns={3}
                  items={[
                    ['Primary phone', <span key="p" className="font-mono">{c.phonePrimary}</span>],
                    ['Alternate phones', c.phoneAlternates.length ? <span key="a" className="font-mono">{c.phoneAlternates.join(', ')}</span> : 'None'],
                    ['Email', c.email ?? '—'],
                    ['Preferred language', languageName(c.preferredLanguage)],
                    ['GSTIN', c.gstin ?? '—'],
                    ['Drug licence', c.drugLicenseNo ?? '—'],
                    ['Status', <Status key="s" value={c.status} />],
                    ['Created', fmtDateTime(c.createdAt)],
                    ['Updated', fmtDateTime(c.updatedAt)],
                  ]}
                />
              </Card>
              <Card title={`Delivery addresses (${c.addresses.length})`} padded={false}>
                {c.addresses.length === 0 ? (
                  <Empty title="No delivery address on file" />
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Label</Th>
                        <Th>Address</Th>
                        <Th>City</Th>
                        <Th>State</Th>
                        <Th>Pincode</Th>
                        <Th />
                      </tr>
                    </thead>
                    <tbody>
                      {c.addresses.map((a) => (
                        <tr key={a.id}>
                          <Td>{a.label}</Td>
                          <Td>
                            {a.line1}
                            {a.line2 && <span className="block text-slate-500">{a.line2}</span>}
                          </Td>
                          <Td>{a.city}</Td>
                          <Td>{a.state}</Td>
                          <Td mono>{a.pincode}</Td>
                          <Td>{a.isDefault && <Badge tone="blue">Default</Badge>}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>
            </div>
            <div className="flex flex-col gap-4">
              <Card title="Recent orders" actions={<LinkButton size="sm" href={`/dashboard/orders`}>All orders</LinkButton>} padded={false}>
                <Async q={orders} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No orders" />}>
                  {(d) => (
                    <ul className="divide-y divide-slate-100 text-sm">
                      {d.data.map((o) => (
                        <li key={o.id} className="flex items-center justify-between gap-2 px-4 py-2">
                          <span>
                            <Link href={`/dashboard/orders/${o.id}`} className="font-mono text-blue-700 hover:underline">
                              {o.orderNumber}
                            </Link>
                            <span className="block text-xs text-slate-500">
                              {fmtDateTime(o.createdAt)} · {o.items.length} items · {money(o.totalPaise)}
                            </span>
                          </span>
                          <Status value={o.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </Async>
              </Card>
              <Card title="Recent calls" padded={false}>
                <Async q={calls} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No calls" />}>
                  {(d) => (
                    <ul className="divide-y divide-slate-100 text-sm">
                      {d.data.map((call) => (
                        <li key={call.id} className="flex items-center justify-between gap-2 px-4 py-2">
                          <span>
                            <Link href={`/dashboard/calls/${call.id}`} className="text-blue-700 hover:underline">
                              {fmtDateTime(call.startedAt)}
                            </Link>
                            <span className="block text-xs text-slate-500">
                              {languageName(call.language)} · {fmtDuration(call.durationSeconds)}
                            </span>
                          </span>
                          <Status value={call.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </Async>
              </Card>
            </div>
          </div>
        </>
      )}
    </Async>
  );
}
