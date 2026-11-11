'use client';
import { Bot, Phone, User } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Async, Badge, Banner, Card, Empty, KeyValue, LinkButton, PageHeader, Status, Table, Td, Th, cx } from '@/components/ui';
import { api, qs } from '@/lib/api';
import { fmtDateTime, fmtTime, isMockProvider, label, languageName, money, providerName } from '@/lib/format';
import type { CallDetail, CallEvent, ExceptionRecord, Page, ToolEventData, Transcript } from '@/lib/types';
import { useApi, useLoad } from '@/lib/use-api';

const TOOL_EVENTS = new Set(['tool_called', 'tool_failed']);
const compact = (v: unknown, max = 140): string => {
  const s = typeof v === 'string' ? v : JSON.stringify(v) ?? '';
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [live, setLive] = useState(false);
  const refreshMs = live ? 5000 : undefined;
  const callQ = useLoad(
    () =>
      api<{ call: CallDetail }>(`/api/calls/${id}`).then((d) => {
        setLive(d.call.status === 'in_progress');
        return d;
      }),
    [id],
    { refreshMs },
  );
  const transcriptQ = useApi<{ transcript: Transcript[] }>(`/api/calls/${id}/transcript`, { refreshMs });
  const eventsQ = useApi<{ events: CallEvent[] }>(`/api/calls/${id}/events` + qs({ limit: 1000 }), { refreshMs });
  const exceptionsQ = useApi<Page<ExceptionRecord>>('/api/exceptions' + qs({ callId: id, pageSize: 50 }));

  return (
    <Async q={callQ}>
      {({ call }) => {
        const transcript = transcriptQ.data?.transcript ?? [];
        const events = eventsQ.data?.events ?? [];
        const timeline = [
          ...transcript.map((t) => ({ kind: 'transcript' as const, at: t.createdAt, seq: t.sequence, t })),
          ...events.filter((e) => !TOOL_EVENTS.has(e.type)).map((e) => ({ kind: 'event' as const, at: e.createdAt, seq: 0, e })),
        ].sort((a, b) => a.at.localeCompare(b.at) || a.seq - b.seq);
        const tools = events.filter((e) => TOOL_EVENTS.has(e.type));
        const handoverExceptions = (exceptionsQ.data?.data ?? []).filter((x) => x.type === 'human_handover_required' || x.type === 'customer_not_registered' || x.type === 'customer_not_eligible');
        return (
          <>
            <PageHeader
              title={`Call ${call.id.slice(0, 8)}`}
              description={
                <>
                  {providerName(call.provider)} · started {fmtDateTime(call.startedAt)}
                </>
              }
              actions={
                <>
                  <Status value={call.status} />
                  <Badge tone={isMockProvider(call.provider) ? 'amber' : 'green'}>{isMockProvider(call.provider) ? 'Mock / simulated session' : 'Live provider'}</Badge>
                  {call.order && <LinkButton href={`/dashboard/orders/${call.order.id}`}>Open order {call.order.orderNumber}</LinkButton>}
                </>
              }
            />
            {call.live && (
              <Banner tone="blue">
                Session is live in memory: state <strong>{label(call.live.state)}</strong>, {call.live.turns} customer turns, {call.live.candidates} catalogue candidates offered. This page refreshes every 5 seconds.
              </Banner>
            )}
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="flex flex-col gap-4 xl:col-span-2">
                <Card title="Call information">
                  <KeyValue
                    columns={3}
                    items={[
                      ['Call ID', <span key="id" className="font-mono text-xs">{call.id}</span>],
                      ['Provider call SID', <span key="sid" className="font-mono text-xs">{call.providerCallSid}</span>],
                      ['Provider type', providerName(call.provider)],
                      ['Caller number', <span key="from" className="font-mono">{call.fromNumber}</span>],
                      ['Called number', <span key="to" className="font-mono">{call.toNumber}</span>],
                      [
                        'Customer',
                        call.customer ? (
                          <Link key="c" href={`/dashboard/customers/${call.customer.id}`} className="text-blue-700 hover:underline">
                            {call.customer.name} ({call.customer.externalCode})
                          </Link>
                        ) : (
                          'Unregistered caller'
                        ),
                      ],
                      ['Started', fmtDateTime(call.startedAt)],
                      ['Ended', fmtDateTime(call.endedAt)],
                      ['Duration', call.durationSeconds == null ? '—' : `${call.durationSeconds}s`],
                      ['Language', languageName(call.language)],
                      ['Conversation state', <Status key="st" value={call.conversationState} />],
                      ['Final status', <Status key="fs" value={call.status} />],
                      ['Recording', call.recordingUrl ? <span key="rec" className="break-all font-mono text-xs">{call.recordingUrl}</span> : 'None'],
                      ['AI summary', call.aiSummary ?? '—'],
                      ['Transcript / events', `${call._count.transcripts} / ${call._count.events}`],
                    ]}
                  />
                </Card>

                <Card title="Conversation" padded={false}>
                  {transcriptQ.error && <Banner tone="red">{transcriptQ.error.message}</Banner>}
                  {timeline.length === 0 ? (
                    <Empty title="No transcript yet" />
                  ) : (
                    <ol className="divide-y divide-slate-100">
                      {timeline.map((row) =>
                        row.kind === 'transcript' ? (
                          <li key={`t${row.t.id}`} className={cx('flex gap-3 px-4 py-3', row.t.speaker === 'customer' ? 'bg-white' : row.t.speaker === 'agent' ? 'bg-blue-50/40' : 'bg-slate-50')}>
                            <span className={cx('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', row.t.speaker === 'customer' ? 'bg-slate-200 text-slate-700' : row.t.speaker === 'agent' ? 'bg-blue-600 text-white' : 'bg-slate-400 text-white')} aria-hidden>
                              {row.t.speaker === 'customer' ? <User className="h-4 w-4" /> : row.t.speaker === 'agent' ? <Bot className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className="font-semibold text-slate-700">{row.t.speaker === 'agent' ? 'AI assistant' : label(row.t.speaker)}</span>
                                <span>{fmtTime(row.t.createdAt)}</span>
                                {row.t.language && <Badge>{languageName(row.t.language)}</Badge>}
                                {row.t.confidence && <span title="Speech recognition confidence">conf {Number(row.t.confidence).toFixed(2)}</span>}
                                {row.t.toolCalls?.map((tc, i) => (
                                  <Badge key={i} tone={tc.ok ? 'slate' : 'red'}>
                                    {tc.name}
                                  </Badge>
                                ))}
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{row.t.text}</p>
                            </div>
                          </li>
                        ) : (
                          <li key={`e${row.e.id}`} className="flex items-center gap-3 px-4 py-1.5 text-xs text-slate-500">
                            <span className="w-16 shrink-0 tabular-nums">{fmtTime(row.e.createdAt)}</span>
                            <Badge tone={row.e.ok === false ? 'red' : row.e.type === 'handover_requested' ? 'amber' : 'slate'}>{label(row.e.type)}</Badge>
                            {row.e.fromState && row.e.toState && (
                              <span>
                                {label(row.e.fromState)} → {label(row.e.toState)}
                              </span>
                            )}
                            {row.e.data != null && <span className="truncate font-mono text-[11px] text-slate-400" title={compact(row.e.data, 2000)}>{compact(row.e.data, 100)}</span>}
                          </li>
                        ),
                      )}
                    </ol>
                  )}
                </Card>

                <Card title="Tool execution history" padded={false}>
                  {tools.length === 0 ? (
                    <Empty title="No tool calls recorded" />
                  ) : (
                    <Table>
                      <thead>
                        <tr>
                          <Th>Time</Th>
                          <Th>Tool</Th>
                          <Th>Arguments</Th>
                          <Th>Result</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {tools.map((e) => {
                          const d = (e.data ?? {}) as ToolEventData;
                          const r = d.result;
                          return (
                            <tr key={e.id}>
                              <Td className="whitespace-nowrap">{fmtTime(e.createdAt)}</Td>
                              <Td mono>{e.toolName}</Td>
                              <Td mono>
                                <span title={compact(d.arguments, 2000)}>{compact(d.arguments)}</span>
                              </Td>
                              <Td>
                                {r?.ok === false ? (
                                  <span className="flex flex-col gap-0.5">
                                    <Badge tone="red">Failed · {r.code}</Badge>
                                    <span className="text-xs text-red-700">{r.error}</span>
                                  </span>
                                ) : (
                                  <span className="flex flex-col gap-0.5">
                                    <Badge tone="green">OK</Badge>
                                    <span className="font-mono text-[11px] text-slate-500" title={compact(r?.data, 2000)}>
                                      {compact(r?.data)}
                                    </span>
                                  </span>
                                )}
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  )}
                  <p className="px-4 py-2 text-xs text-slate-400">Execution duration is not recorded by the backend (call_events has no timing field).</p>
                </Card>
              </div>

              <div className="flex flex-col gap-4">
                <Card title="Linked order">
                  {call.order ? (
                    <KeyValue
                      columns={1}
                      items={[
                        [
                          'Order number',
                          <Link key="o" href={`/dashboard/orders/${call.order.id}`} className="font-mono text-blue-700 hover:underline">
                            {call.order.orderNumber}
                          </Link>,
                        ],
                        ['Status', <Status key="s" value={call.order.status} />],
                        ['Revision', call.order.revision],
                        ['Total', money(call.order.totalPaise)],
                      ]}
                    />
                  ) : (
                    <p className="text-sm text-slate-500">No order was created in this call.</p>
                  )}
                </Card>
                <Card title="Handover">
                  {call.status === 'handed_over' || call.handoverReason || handoverExceptions.length > 0 ? (
                    <KeyValue
                      columns={1}
                      items={[
                        ['Reason', call.handoverReason ?? '—'],
                        ['Status', <Status key="s" value={call.status} />],
                        ...handoverExceptions.map((x): [string, React.ReactNode] => [
                          `Exception ${x.id.slice(0, 8)}`,
                          <span key={x.id} className="flex flex-col gap-1">
                            <Link href={`/dashboard/exceptions/${x.id}`} className="text-blue-700 hover:underline">
                              {label(x.type)} · {label(x.status)}
                            </Link>
                            <span className="text-xs text-slate-500">Assigned to: {x.assignee?.name ?? 'nobody'}</span>
                          </span>,
                        ]),
                      ]}
                    />
                  ) : (
                    <p className="text-sm text-slate-500">No handover was requested.</p>
                  )}
                </Card>
                {call.exceptions.length > 0 && (
                  <Card title="Open exceptions">
                    <ul className="flex flex-col gap-2 text-sm">
                      {call.exceptions.map((x) => (
                        <li key={x.id}>
                          <Link href={`/dashboard/exceptions/${x.id}`} className="text-blue-700 hover:underline">
                            {label(x.type)}
                          </Link>
                          <p className="text-xs text-slate-500">{x.description}</p>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            </div>
          </>
        );
      }}
    </Async>
  );
}
