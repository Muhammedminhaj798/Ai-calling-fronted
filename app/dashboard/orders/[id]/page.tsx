'use client';
// Order detail doubles as the approval review screen: every section the approver needs plus the
// decision actions, gated by role here and enforced by the backend (approvals.service assertApprovable).
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Async, Badge, Banner, Button, Card, Dialog, Empty, ErrorBox, KeyValue, LinkButton, PageHeader, Status, Table, Td, Textarea, Th, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, label, money } from '@/lib/format';
import type { Customer, OrderDetail, OrderItem, OrderStatus, ReservationOutcome } from '@/lib/types';
import { useAction, useApi, useSession } from '@/lib/use-api';

// Mirrors backend/src/modules/orders/orders.state.ts; the server re-checks every transition.
const REJECTABLE: OrderStatus[] = ['pending_staff_approval', 'customer_confirmed', 'failed'];
const RESERVABLE: OrderStatus[] = ['customer_confirmed', 'failed'];
const STAFF_CANCELLABLE: OrderStatus[] = ['draft', 'pending_customer_confirmation'];
const APPROVER_CANCELLABLE: OrderStatus[] = [...STAFF_CANCELLABLE, 'customer_confirmed', 'pending_staff_approval', 'approved', 'failed'];
const FLAGGED_REMOVABLE: OrderStatus[] = [...STAFF_CANCELLABLE, 'customer_confirmed', 'failed'];

type DialogKind = 'approve' | 'reject' | 'cancel' | 'reserve' | { removeItem: OrderItem } | null;

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useSession().user;
  const canDecide = user?.role === 'admin' || user?.role === 'approver';
  const orderQ = useApi<{ order: OrderDetail }>(`/api/orders/${id}`);
  const order = orderQ.data?.order;
  const customerQ = useApi<{ customer: Customer }>(order ? `/api/customers/${order.customerId}` : null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState<ReservationOutcome | null>(null);
  const action = useAction(async (kind: Exclude<DialogKind, null>) => {
    if (kind === 'approve') await api(`/api/approvals/${id}/approve`, { method: 'POST', body: note.trim() ? { note: note.trim() } : {} });
    else if (kind === 'reject') await api(`/api/approvals/${id}/reject`, { method: 'POST', body: { reason: note.trim() } });
    else if (kind === 'cancel') await api(`/api/orders/${id}/cancel`, { method: 'POST', body: { reason: note.trim() } });
    else if (kind === 'reserve') setOutcome(await api<ReservationOutcome>(`/api/orders/${id}/reserve`, { method: 'POST' }));
    else await api(`/api/orders/${id}/items/${kind.removeItem.id}`, { method: 'DELETE' });
    setDialog(null);
    setNote('');
    orderQ.reload();
  });
  const close = () => {
    setDialog(null);
    setNote('');
    action.clearError();
  };

  return (
    <Async q={orderQ}>
      {({ order }) => {
        const address = customerQ.data?.customer.addresses.find((a) => a.id === order.deliveryAddressId);
        const activeRes = order.reservations.filter((r) => r.status === 'active');
        const flagged = order.items.filter((i) => i.status === 'flagged');
        const confirmed = order.confirmations.find((c) => c.status === 'confirmed');
        const latestReadback = order.confirmations[0];
        const itemName = (itemId: string) => order.items.find((i) => i.id === itemId)?.nameSnapshot ?? itemId.slice(0, 8);
        const canCancel = user && (user.role === 'staff' ? STAFF_CANCELLABLE : APPROVER_CANCELLABLE).includes(order.status);
        const needsNote = dialog === 'reject' || dialog === 'cancel';
        return (
          <>
            <PageHeader
              title={order.orderNumber}
              description={
                <>
                  Created {fmtDateTime(order.createdAt)} by {order.createdBy === 'ai' ? 'the AI agent' : order.createdBy === 'system' ? 'the system' : 'staff'} · revision {order.revision}
                </>
              }
              actions={
                <>
                  <Status value={order.status} />
                  {RESERVABLE.includes(order.status) && (
                    <Button onClick={() => setDialog('reserve')} disabled={flagged.length > 0} title={flagged.length ? 'Remove or resolve flagged lines first' : undefined}>
                      Reserve stock
                    </Button>
                  )}
                  {canDecide && order.status === 'pending_staff_approval' && (
                    <Button variant="primary" onClick={() => setDialog('approve')}>
                      Approve
                    </Button>
                  )}
                  {canDecide && REJECTABLE.includes(order.status) && (
                    <Button variant="danger" onClick={() => setDialog('reject')}>
                      Reject
                    </Button>
                  )}
                  {canCancel && <Button onClick={() => setDialog('cancel')}>Cancel order</Button>}
                </>
              }
            />
            {!canDecide && order.status === 'pending_staff_approval' && <Banner tone="blue">This order is waiting for staff approval. Only approvers and admins can approve or reject it.</Banner>}
            {flagged.length > 0 && (
              <Banner>
                {flagged.length} line{flagged.length > 1 ? 's' : ''} could not be matched to the catalogue. Flagged lines block reservation and approval; resolve the linked exception or remove the line.
              </Banner>
            )}
            {outcome && (
              <Banner tone={outcome.outcome === 'reserved' ? 'blue' : 'red'}>
                {outcome.outcome === 'reserved' ? (
                  <>
                    Stock reserved{outcome.replay ? ' (idempotent replay)' : ''} via <strong>{outcome.source}</strong>
                    {outcome.isMock && ' (mock inventory, not real stock)'}; expires {fmtDateTime(outcome.expiresAt)}.
                  </>
                ) : (
                  <>
                    Reservation failed: {label(outcome.reason)}.{' '}
                    <Link href={`/dashboard/exceptions/${outcome.exceptionId}`} className="underline">
                      Open the exception
                    </Link>
                    .
                  </>
                )}
              </Banner>
            )}

            <div className="grid gap-4 xl:grid-cols-3">
              <div className="flex flex-col gap-4 xl:col-span-2">
                <Card title="Order summary">
                  <KeyValue
                    columns={3}
                    items={[
                      ['Order number', <span key="n" className="font-mono">{order.orderNumber}</span>],
                      [
                        'Customer',
                        <Link key="c" href={`/dashboard/customers/${order.customer.id}`} className="text-blue-700 hover:underline">
                          {order.customer.name} ({order.customer.externalCode})
                        </Link>,
                      ],
                      ['Customer phone', <span key="p" className="font-mono">{order.customer.phonePrimary}</span>],
                      [
                        'Delivery address',
                        address ? (
                          <span key="a">
                            {address.label}: {address.line1}
                            {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} {address.pincode}
                          </span>
                        ) : order.deliveryAddressId ? (
                          customerQ.loading ? (
                            'Loading…'
                          ) : (
                            'Address no longer on file'
                          )
                        ) : (
                          'Not confirmed'
                        ),
                      ],
                      ['PO reference', order.customerPoReference ?? '—'],
                      ['Status', <Status key="s" value={order.status} />],
                      ['Created', fmtDateTime(order.createdAt)],
                      ['Customer confirmed', fmtDateTime(order.customerConfirmedAt)],
                      [
                        'Call',
                        order.callId ? (
                          <Link key="call" href={`/dashboard/calls/${order.callId}`} className="font-mono text-xs text-blue-700 hover:underline">
                            {order.callId.slice(0, 8)}
                          </Link>
                        ) : (
                          'Entered manually'
                        ),
                      ],
                      ['Subtotal', money(order.subtotalPaise)],
                      ['Tax', money(order.taxPaise)],
                      ['Total', <strong key="t">{money(order.totalPaise)}</strong>],
                      ['Notes', order.notes ?? '—'],
                    ]}
                  />
                </Card>

                <Card title={`Order items (${order.items.length})`} padded={false}>
                  {order.items.length === 0 ? (
                    <Empty title="No lines yet" />
                  ) : (
                    <Table>
                      <thead>
                        <tr>
                          <Th>#</Th>
                          <Th>Product</Th>
                          <Th>Brand</Th>
                          <Th>Strength</Th>
                          <Th>Form</Th>
                          <Th>Pack</Th>
                          <Th right>Qty</Th>
                          <Th>Unit</Th>
                          <Th right>PTR</Th>
                          <Th>Stock</Th>
                          <Th>Customer</Th>
                          <Th right>Line total</Th>
                          <Th />
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((i) => (
                          <tr key={i.id} className={cx(i.status === 'flagged' && 'bg-amber-50/60', i.customerDecision === 'declined' && 'text-slate-400 line-through')}>
                            <Td>{i.lineNo}</Td>
                            <Td>
                              {i.nameSnapshot ? (
                                <Link href={i.productId ? `/dashboard/products/${i.productId}` : '#'} className="text-blue-700 hover:underline">
                                  {i.nameSnapshot}
                                </Link>
                              ) : (
                                <span className="italic text-amber-800">“{i.requestedText}”</span>
                              )}
                              {i.status === 'flagged' && (
                                <span className="mt-0.5 block">
                                  <Badge tone="amber">Flagged · {label(i.flagReason)}</Badge>
                                </span>
                              )}
                              {i.nameSnapshot && i.requestedText !== i.nameSnapshot && <span className="block text-xs text-slate-400">asked: “{i.requestedText}”</span>}
                            </Td>
                            <Td>{i.brandSnapshot ?? '—'}</Td>
                            <Td>{i.strengthSnapshot ?? '—'}</Td>
                            <Td>{i.formSnapshot ?? '—'}</Td>
                            <Td>{i.packSizeSnapshot ?? '—'}</Td>
                            <Td right>{i.quantity}</Td>
                            <Td>{i.unitSnapshot ?? '—'}</Td>
                            <Td right>{money(i.unitPricePaise)}</Td>
                            <Td>
                              <Status value={i.stockStatus} />
                              {i.availableAtCheck != null && <span className="block text-xs text-slate-400">{i.availableAtCheck} available</span>}
                            </Td>
                            <Td>
                              <Status value={i.customerDecision} />
                            </Td>
                            <Td right>{money(i.lineTotalPaise)}</Td>
                            <Td right>
                              {i.status === 'flagged' && FLAGGED_REMOVABLE.includes(order.status) && (
                                <Button size="sm" variant="danger" onClick={() => setDialog({ removeItem: i })}>
                                  Remove
                                </Button>
                              )}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Card>

                <Card title="Order timeline" padded={false}>
                  {order.events.length === 0 ? (
                    <Empty title="No events" />
                  ) : (
                    <ol className="divide-y divide-slate-100 text-sm">
                      {order.events.map((e) => (
                        <li key={e.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                          <span className="w-36 shrink-0 text-xs tabular-nums text-slate-500">{fmtDateTime(e.createdAt)}</span>
                          <Badge tone={e.type.includes('failed') || e.type === 'rejected' || e.type === 'cancelled' ? 'red' : e.type === 'approved' || e.type.includes('succeeded') || e.type === 'customer_confirmed' ? 'green' : 'slate'}>{label(e.type)}</Badge>
                          {e.fromStatus && e.toStatus && (
                            <span className="text-xs text-slate-500">
                              {label(e.fromStatus)} → {label(e.toStatus)}
                            </span>
                          )}
                          <span className="text-xs text-slate-400">by {e.actorType === 'ai' ? 'AI agent' : e.actorType}</span>
                          {e.reason && <span className="text-xs text-slate-600">· {e.reason}</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>
              </div>

              <div className="flex flex-col gap-4">
                <Card title="Customer confirmation">
                  {confirmed ? (
                    <KeyValue columns={1} items={[['Confirmed at', fmtDateTime(confirmed.confirmedAt)], ['Order revision', confirmed.revision], ['Source', label(confirmed.source)], ['Confirmed by', confirmed.actorType === 'ai' ? 'AI agent (phone)' : (confirmed.actorType ?? '—')]]} />
                  ) : (
                    <p className="text-sm text-slate-500">{latestReadback ? `Read-back for revision ${latestReadback.revision} issued ${fmtDateTime(latestReadback.readbackAt)}; not confirmed yet.` : 'No read-back has been issued.'}</p>
                  )}
                  {latestReadback && (
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-xs font-medium text-blue-700">Read-back text (revision {latestReadback.revision})</summary>
                      <p className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-700">{latestReadback.readbackText}</p>
                    </details>
                  )}
                </Card>

                <Card title="Stock reservations">
                  {order.reservations.length === 0 ? (
                    <p className="text-sm text-slate-500">No reservation has been attempted.</p>
                  ) : (
                    <ul className="flex flex-col gap-3 text-sm">
                      {order.reservations.map((r) => (
                        <li key={r.id} className="rounded-md border border-slate-200 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{itemName(r.orderItemId)}</span>
                            <Status value={r.status} />
                          </div>
                          <dl className="mt-1 grid grid-cols-2 gap-x-2 text-xs text-slate-500">
                            <dt>Quantity</dt>
                            <dd className="text-slate-700">{r.quantity}</dd>
                            <dt>Provider</dt>
                            <dd className="text-slate-700">
                              {r.provider} {r.provider === 'mock' && <Badge tone="amber">mock</Badge>}
                            </dd>
                            <dt>Reference</dt>
                            <dd className="font-mono text-slate-700">{r.externalReservationRef ?? '—'}</dd>
                            <dt>Expires</dt>
                            <dd className={cx('text-slate-700', r.status === 'active' && new Date(r.expiresAt).getTime() < Date.now() && 'text-red-700')}>{fmtDateTime(r.expiresAt)}</dd>
                            <dt>Released</dt>
                            <dd className="text-slate-700">{fmtDateTime(r.releasedAt)}</dd>
                          </dl>
                        </li>
                      ))}
                    </ul>
                  )}
                  {order.status === 'pending_staff_approval' && (
                    <p className="mt-3 text-xs text-slate-500">
                      {activeRes.length} active reservation{activeRes.length === 1 ? '' : 's'} for {order.items.filter((i) => i.status === 'active' && i.customerDecision === 'accepted').length} accepted line(s).
                    </p>
                  )}
                </Card>

                <Card title="Staff decisions">
                  {order.approvals.length === 0 ? (
                    <p className="text-sm text-slate-500">No decision recorded yet.</p>
                  ) : (
                    <ul className="flex flex-col gap-2 text-sm">
                      {order.approvals.map((a) => (
                        <li key={a.id}>
                          <Status value={a.decision} /> <span className="text-slate-700">by {a.staffUser.name}</span>
                          <span className="block text-xs text-slate-500">
                            {fmtDateTime(a.createdAt)}
                            {a.note ? ` · ${a.note}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card title={`Open exceptions (${order.exceptions.length})`}>
                  {order.exceptions.length === 0 ? (
                    <p className="text-sm text-slate-500">None.</p>
                  ) : (
                    <ul className="flex flex-col gap-2 text-sm">
                      {order.exceptions.map((x) => (
                        <li key={x.id}>
                          <Link href={`/dashboard/exceptions/${x.id}`} className="text-blue-700 hover:underline">
                            {label(x.type)}
                          </Link>{' '}
                          <Status value={x.status} />
                          <p className="text-xs text-slate-500">{x.description}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3">
                    <LinkButton size="sm" href={`/dashboard/exceptions?orderId=${order.id}`}>
                      All exceptions for this order
                    </LinkButton>
                  </div>
                </Card>
              </div>
            </div>

            <Dialog
              open={dialog !== null}
              onClose={close}
              title={dialog === 'approve' ? 'Approve order' : dialog === 'reject' ? 'Reject order' : dialog === 'cancel' ? 'Cancel order' : dialog === 'reserve' ? 'Reserve stock' : 'Remove flagged line'}
              footer={
                <>
                  <Button onClick={close}>Back</Button>
                  <Button variant={dialog === 'approve' || dialog === 'reserve' ? 'primary' : 'danger'} loading={action.pending} disabled={needsNote && note.trim().length < 3} onClick={() => dialog && action.run(dialog)}>
                    Confirm
                  </Button>
                </>
              }
            >
              {dialog === 'approve' && (
                <>
                  <p>
                    Approve <strong>{order.orderNumber}</strong> for {order.customer.name}, {order.items.filter((i) => i.customerDecision !== 'declined').length} line(s), total {money(order.totalPaise)}? The backend re-validates the customer confirmation and every reservation before approving.
                  </p>
                  <Textarea className="mt-3 w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" maxLength={500} aria-label="Approval note" />
                </>
              )}
              {dialog === 'reject' && (
                <>
                  <p>Reject {order.orderNumber}? Active reservations are released. A reason is required.</p>
                  <Textarea className="mt-3 w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (at least 3 characters)" required maxLength={500} aria-label="Rejection reason" />
                </>
              )}
              {dialog === 'cancel' && (
                <>
                  <p>Cancel {order.orderNumber}? This cannot be undone. A reason is required.</p>
                  <Textarea className="mt-3 w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (at least 3 characters)" required maxLength={500} aria-label="Cancellation reason" />
                </>
              )}
              {dialog === 'reserve' && <p>Ask the inventory provider to reserve stock for every accepted line of {order.orderNumber}. On success the order moves to pending staff approval.</p>}
              {dialog && typeof dialog === 'object' && (
                <p>
                  Remove line {dialog.removeItem.lineNo} (“{dialog.removeItem.requestedText}”, quantity {dialog.removeItem.quantity})? Its open exception is marked resolved.
                </p>
              )}
              {action.error && <ErrorBox error={action.error} />}
            </Dialog>
          </>
        );
      }}
    </Async>
  );
}
