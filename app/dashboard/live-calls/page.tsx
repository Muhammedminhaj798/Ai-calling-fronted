'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Async, Badge, Banner, Card, Empty, Field, Input, LinkButton, PageHeader, Select, Status, Table, Td, Th, Toolbar, enumOptions } from '@/components/ui';
import { qs } from '@/lib/api';
import { fmtDuration, fmtTime, isMockProvider, languageName, providerName, secondsSince } from '@/lib/format';
import { LANGUAGES, type CallListItem, type Page, type Settings } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const STATUSES = ['in_progress', 'ringing', 'handed_over'];

export default function LiveCallsPage() {
  const [status, setStatus] = useState('in_progress');
  const [language, setLanguage] = useState('');
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const settings = useApi<Settings>('/api/settings');
  const q = useApi<Page<CallListItem>>('/api/calls' + qs({ status, pageSize: 200, sort: '-startedAt' }), { refreshMs: 5000 });
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (q.data?.data ?? []).filter((c) => (!language || c.language === language) && (!needle || `${c.fromNumber} ${c.customer?.name ?? ''} ${c.customer?.externalCode ?? ''}`.toLowerCase().includes(needle)));
  }, [q.data, language, search]);
  const telephony = settings.data?.providers.telephony.provider;

  return (
    <>
      <PageHeader
        title="Live Calls"
        description="Sessions the conversation engine is handling right now. Refreshes every 5 seconds."
        actions={telephony && <Badge tone={telephony === 'mock' ? 'amber' : 'green'}>Telephony provider: {telephony === 'mock' ? 'mock' : providerName(telephony)}</Badge>}
      />
      {telephony === 'mock' && (
        <Banner>
          The telephony provider is <strong>mock</strong>: sessions listed here come from the text simulator or the mock media stream, not from real customer phone calls.
        </Banner>
      )}
      <Toolbar>
        <Field label="Search">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Caller number or customer" />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} options={enumOptions(STATUSES)} />
        </Field>
        <Field label="Language">
          <Select value={language} onChange={(e) => setLanguage(e.target.value)} options={LANGUAGES.map((l) => ({ value: l, label: languageName(l) }))} placeholder="All" />
        </Field>
      </Toolbar>
      <Card padded={false}>
        <Async q={q} isEmpty={() => rows.length === 0} empty={<Empty title="No active calls" hint="New sessions appear here automatically." />}>
          {() => (
            <Table>
              <thead>
                <tr>
                  <Th>Caller</Th>
                  <Th>Customer</Th>
                  <Th>Started</Th>
                  <Th right>Duration</Th>
                  <Th>Language</Th>
                  <Th>Conversation state</Th>
                  <Th>Order</Th>
                  <Th>Status</Th>
                  <Th>Source</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <Td mono>{c.fromNumber}</Td>
                    <Td>
                      {c.customer ? (
                        <Link href={`/dashboard/customers/${c.customer.id}`} className="text-blue-700 hover:underline">
                          {c.customer.name}
                        </Link>
                      ) : (
                        <span className="text-slate-400">Unregistered</span>
                      )}
                    </Td>
                    <Td>{fmtTime(c.startedAt)}</Td>
                    <Td right>{fmtDuration(c.endedAt ? c.durationSeconds : secondsSince(c.startedAt, now))}</Td>
                    <Td>{languageName(c.language)}</Td>
                    <Td>
                      <Status value={c.conversationState} />
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
                    <Td>
                      <Status value={c.status} />
                    </Td>
                    <Td>
                      <Badge tone={isMockProvider(c.provider) ? 'amber' : 'green'}>{providerName(c.provider)}</Badge>
                    </Td>
                    <Td right>
                      <LinkButton size="sm" href={`/dashboard/calls/${c.id}`}>
                        Open
                      </LinkButton>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Async>
      </Card>
    </>
  );
}
