// API client against a stubbed fetch: same-origin paths and how proxy-level failures are reported.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { api, ApiError, getSession } from './api.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(...responses: Array<() => Response>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return (responses.shift() ?? responses.at(-1)!)();
  }) as typeof fetch;
  return calls;
}

test('requests are same-origin relative /api paths with credentials included', async () => {
  const calls = stubFetch(() => Response.json({ data: [], total: 0 }));
  await api('/api/calls?page=1');
  assert.equal(calls[0]!.url, '/api/calls?page=1');
  assert.equal(calls[0]!.init.credentials, 'include');
});

test('a proxy-generated 5xx (no backend JSON body) becomes API_UNAVAILABLE and a GET is retried once', async () => {
  const calls = stubFetch(() => new Response('Internal Server Error', { status: 500 }), () => new Response('<html>502</html>', { status: 502 }));
  await assert.rejects(api('/api/calls'), (e: unknown) => e instanceof ApiError && e.code === 'API_UNAVAILABLE' && e.status === 502);
  assert.equal(calls.length, 2);
});

test('a GET that succeeds on the retry returns the data', async () => {
  stubFetch(() => new Response('Bad Gateway', { status: 502 }), () => Response.json({ ok: 1 }));
  assert.deepEqual(await api('/api/settings'), { ok: 1 });
});

test('mutations are not retried, and backend JSON errors keep their code and message', async () => {
  const calls = stubFetch(() => new Response('Bad Gateway', { status: 502 }));
  await assert.rejects(api('/api/orders/x/cancel', { method: 'POST', body: { reason: 'abc' } }), (e: unknown) => e instanceof ApiError && e.code === 'API_UNAVAILABLE');
  assert.equal(calls.length, 1);
  stubFetch(() => Response.json({ error: { code: 'DB_DOWN', message: 'Database unavailable' } }, { status: 503 }));
  await assert.rejects(api('/api/orders', { method: 'POST', body: {} }), (e: unknown) => e instanceof ApiError && e.code === 'DB_DOWN' && e.message === 'Database unavailable');
});

const expired = () => Response.json({ error: { code: 'TOKEN_EXPIRED', message: 'Access token expired' } }, { status: 401 });
const superseded = () => Response.json({ error: { code: 'REFRESH_TOKEN_SUPERSEDED', message: 'Refresh token was already rotated' } }, { status: 401 });
const user = { id: 'u1', email: 'a@b.c', name: 'A', role: 'staff', isActive: true, lastLoginAt: null, createdAt: '2026-11-12T00:00:00Z' };

test('refresh survives a page unload (keepalive) and retries once when another request already rotated the cookie', async () => {
  const calls = stubFetch(expired, superseded, () => Response.json({ accessToken: 'new', tokenType: 'Bearer', expiresIn: 900, user }), () => Response.json({ ok: 1 }));
  assert.deepEqual(await api('/api/settings'), { ok: 1 });
  assert.deepEqual(calls.map((c) => c.url), ['/api/settings', '/api/auth/refresh', '/api/auth/refresh', '/api/settings']);
  for (const c of calls.filter((x) => x.url === '/api/auth/refresh')) assert.equal(c.init.keepalive, true);
  assert.equal(getSession().status, 'authenticated');
});

test('still superseded after the retry: logs out with that cookie (the server ends the undelivered successor) and signs out', async () => {
  const calls = stubFetch(expired, superseded, superseded, () => new Response(null, { status: 204 }));
  await assert.rejects(api('/api/settings'), (e: unknown) => e instanceof ApiError && e.status === 401);
  assert.deepEqual(calls.map((c) => c.url), ['/api/settings', '/api/auth/refresh', '/api/auth/refresh', '/api/auth/logout']);
  assert.equal(getSession().status, 'anonymous');
});
