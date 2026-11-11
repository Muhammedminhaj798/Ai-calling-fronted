'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Async, Banner, Button, Card, Dialog, ErrorBox, Field, KeyValue, PageHeader, Select, Status, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, label, shortId } from '@/lib/format';
import type { ExceptionRecord, StaffUser } from '@/lib/types';
import { useAction, useApi, useSession } from '@/lib/use-api';

type DialogKind = 'assign' | 'update' | 'resolve' | 'dismiss' | null;

export default function ExceptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const me = useSession().user;
  const q = useApi<{ exception: ExceptionRecord }>(`/api/exceptions/${id}`);
  const staff = useApi<{ staff: StaffUser[] }>('/api/staff');
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [form, setForm] = useState({ assigneeId: '', status: '', description: '', note: '' });
  const open = (kind: DialogKind, x: ExceptionRecord) => {
    setForm({ assigneeId: x.assignedTo ?? '', status: x.status, description: x.description, note: '' });
    setDialog(kind);
  };
  const action = useAction(async (kind: Exclude<DialogKind, null>) => {
    if (kind === 'assign') await api(`/api/exceptions/${id}/assign`, { method: 'POST', body: { assigneeId: form.assigneeId || null } });
    else if (kind === 'update') await api(`/api/exceptions/${id}`, { method: 'PATCH', body: { status: form.status, description: form.description.trim() } });
    else await api(`/api/exceptions/${id}/resolve`, { method: 'POST', body: { status: kind === 'resolve' ? 'resolved' : 'dismissed', resolutionNote: form.note.trim() } });
    setDialog(null);
    q.reload();
  });
  const close = () => {
    setDialog(null);
    action.clearError();
  };

  return (
    <Async q={q}>
      {({ exception: x }) => {
        const closed = x.status === 'resolved' || x.status === 'dismissed';
        return (
          <>
            <PageHeader
              title={label(x.type)}
              description={
                <>
                  Exception <span className="font-mono">{shortId(x.id)}</span> · raised {fmtDateTime(x.createdAt)}
                </>
              }
              actions={
                <>
                  <Status value={x.status} />
                  {!closed && (
                    <>
                      <Button onClick={() => open('assign', x)}>Assign</Button>
                      <Button onClick={() => open('update', x)}>Update</Button>
                      <Button variant="primary" onClick={() => open('resolve', x)}>
                        Resolve
                      </Button>
                      <Button variant="danger" onClick={() => open('dismiss', x)}>
                        Dismiss
                      </Button>
                    </>
                  )}
                </>
              }
            />
            {closed && (
              <Banner tone="blue">
                Closed as <strong>{label(x.status)}</strong> by {x.resolvedBy?.name ?? 'unknown'} on {fmtDateTime(x.resolvedAt)}.
              </Banner>
            )}
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="flex flex-col gap-4 xl:col-span-2">
                <Card title="Description">
                  <p className="whitespace-pre-wrap text-sm text-slate-800">{x.description}</p>
                  {x.details != null && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-medium text-blue-700">Structured details</summary>
                      <pre className="mt-2 max-h-80 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-700">{JSON.stringify(x.details, null, 2)}</pre>
                    </details>
                  )}
                </Card>
                <Card title="Resolution">
                  {x.resolutionNote ? (
                    <KeyValue items={[['Outcome', <Status key="s" value={x.status} />], ['Resolved by', x.resolvedBy?.name ?? '—'], ['Resolved at', fmtDateTime(x.resolvedAt)], ['Note', x.resolutionNote]]} />
                  ) : (
                    <p className="text-sm text-slate-500">Not resolved yet.</p>
                  )}
                </Card>
              </div>
              <div className="flex flex-col gap-4">
                <Card title="Assignment">
                  <KeyValue columns={1} items={[['Assigned to', x.assignee ? `${x.assignee.name} (${x.assignee.email})` : 'Unassigned'], ['Last updated', fmtDateTime(x.updatedAt)]]} />
                  <p className="mt-3 text-xs text-slate-400">Assignment history is written to the audit log, which has no API yet; only the current assignee is shown.</p>
                </Card>
                <Card title="Related records">
                  <KeyValue
                    columns={1}
                    items={[
                      [
                        'Call',
                        x.callId ? (
                          <Link key="c" href={`/dashboard/calls/${x.callId}`} className="font-mono text-xs text-blue-700 hover:underline">
                            {shortId(x.callId)}
                          </Link>
                        ) : (
                          '—'
                        ),
                      ],
                      [
                        'Order',
                        x.order ? (
                          <Link key="o" href={`/dashboard/orders/${x.order.id}`} className="font-mono text-blue-700 hover:underline">
                            {x.order.orderNumber} · {label(x.order.status)}
                          </Link>
                        ) : (
                          '—'
                        ),
                      ],
                      ['Order line', x.orderItem ? `#${x.orderItem.lineNo} “${x.orderItem.requestedText}” × ${x.orderItem.quantity} (${x.orderItem.status})` : '—'],
                      [
                        'Customer',
                        x.customer ? (
                          <Link key="cu" href={`/dashboard/customers/${x.customer.id}`} className="text-blue-700 hover:underline">
                            {x.customer.name} ({x.customer.externalCode})
                          </Link>
                        ) : (
                          '—'
                        ),
                      ],
                    ]}
                  />
                </Card>
              </div>
            </div>

            <Dialog
              open={dialog !== null}
              onClose={close}
              title={dialog === 'assign' ? 'Assign exception' : dialog === 'update' ? 'Update exception' : dialog === 'resolve' ? 'Resolve exception' : 'Dismiss exception'}
              footer={
                <>
                  <Button onClick={close}>Back</Button>
                  <Button variant={dialog === 'dismiss' ? 'danger' : 'primary'} loading={action.pending} disabled={(dialog === 'resolve' || dialog === 'dismiss') && form.note.trim().length < 3} onClick={() => dialog && action.run(dialog)}>
                    Confirm
                  </Button>
                </>
              }
            >
              {dialog === 'assign' && (
                <Field label="Staff member">
                  <Select
                    value={form.assigneeId}
                    onChange={(e) => setForm((f) => ({ ...f, assigneeId: e.target.value }))}
                    options={(staff.data?.staff ?? []).map((s) => ({ value: s.id, label: `${s.name} (${label(s.role)})${s.id === me?.id ? ' — me' : ''}` }))}
                    placeholder="Unassigned"
                  />
                </Field>
              )}
              {dialog === 'update' && (
                <div className="flex flex-col gap-3">
                  <Field label="Status">
                    <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} options={[{ value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' }]} />
                  </Field>
                  <Field label="Description">
                    <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} minLength={3} maxLength={2000} />
                  </Field>
                </div>
              )}
              {(dialog === 'resolve' || dialog === 'dismiss') && (
                <Field label={dialog === 'resolve' ? 'Resolution note (required)' : 'Reason for dismissal (required)'}>
                  <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} minLength={3} maxLength={2000} autoFocus />
                </Field>
              )}
              {action.error && <ErrorBox error={action.error} />}
            </Dialog>
          </>
        );
      }}
    </Async>
  );
}
