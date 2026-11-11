'use client';
// Read-only view of the server configuration (GET /api/settings exposes modes and booleans, never values).
// There is no backend mechanism for editing environment variables or managing users, so none is offered.
import { Async, Badge, Card, KeyValue, PageHeader, Status } from '@/components/ui';
import { fmtDateTime, label, languageName } from '@/lib/format';
import type { ProviderStatus, Settings } from '@/lib/types';
import { useApi, useSession } from '@/lib/use-api';

function ProviderBadge({ p }: { p: ProviderStatus }) {
  if (p.provider === 'mock') return <Badge tone="amber">Mock</Badge>;
  return p.configured ? <Badge tone="green">Configured</Badge> : <Badge tone="red">Not configured</Badge>;
}
/** Live verification happened for none of the providers (docs/step-4.1-live-provider-verification.md). */
const NotVerified = () => <Badge tone="slate">Not verified live</Badge>;

export default function SettingsPage() {
  const user = useSession().user;
  const q = useApi<Settings>('/api/settings');
  return (
    <>
      <PageHeader title="Settings" description="Server configuration as reported by the backend. Values are set in backend/.env and cannot be changed from the browser." />
      <Async q={q}>
        {(s) => (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="General">
              <KeyValue items={[['Environment', label(s.environment)], ['Default conversation language', languageName(s.conversation.defaultLanguage)], ['Idle session timeout', `${s.conversation.idleTimeoutMinutes} min`], ['Max tool rounds per utterance', s.conversation.maxToolRounds], ['Model-visible history', `${s.conversation.historyMessages} messages`]]} />
            </Card>
            <Card title="Reservation configuration">
              <KeyValue items={[['Reservation TTL', `${s.reservation.ttlHours} h`], ['Expiry sweep interval', s.reservation.sweepIntervalSeconds ? `${s.reservation.sweepIntervalSeconds} s` : 'disabled'], ['Max lines per order', s.reservation.maxOrderItems]]} />
            </Card>
            <Card title="AI configuration">
              <KeyValue items={[['Provider', s.providers.ai.provider], ['Status', <ProviderBadge key="b" p={s.providers.ai} />], ['Model', s.providers.ai.model], ['Verified', <NotVerified key="v" />]]} />
            </Card>
            <Card title="Speech providers">
              <KeyValue items={[['Speech-to-text', s.providers.stt.provider], ['STT status', <ProviderBadge key="a" p={s.providers.stt} />], ['Text-to-speech', s.providers.tts.provider], ['TTS status', <ProviderBadge key="b" p={s.providers.tts} />], ['Verified per language', <NotVerified key="v" />]]} />
            </Card>
            <Card title="Telephony provider">
              <KeyValue
                items={[
                  ['Provider', s.providers.telephony.provider],
                  ['Status', <ProviderBadge key="b" p={s.providers.telephony} />],
                  ['Handover number', s.providers.telephony.handoverNumberConfigured ? <Badge key="h" tone="green">Set</Badge> : <Badge key="h" tone="red">Not set</Badge>],
                  ['Webhook IP allow-list', s.providers.telephony.ipAllowListConfigured ? 'Enabled' : 'Disabled (secret only)'],
                  ['Verified', <NotVerified key="v" />],
                ]}
              />
            </Card>
            <Card title="Inventory provider">
              <KeyValue items={[['Adapter', s.providers.inventory.provider], ['Status', <ProviderBadge key="b" p={s.providers.inventory} />], ['Note', s.providers.inventory.provider === 'mock' ? 'Stock and reservations are simulated from the local inventory table.' : 'Client inventory API']]} />
            </Card>
            <Card title="Your profile">
              {user && <KeyValue items={[['Name', user.name], ['Email', user.email], ['Role', <Status key="r" value={user.role} />], ['Last login', fmtDateTime(user.lastLoginAt)]]} />}
            </Card>
            <Card title="User management">
              <p className="text-sm text-slate-500">Not available: the backend has no user-management API. Staff accounts are created with the seed script (backend/prisma/seed.ts).</p>
            </Card>
          </div>
        )}
      </Async>
    </>
  );
}
