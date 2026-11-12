import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEV_API_PROXY_TARGET, resolveApiProxyTarget } from './proxy-target.ts';

test('production requires API_PROXY_TARGET; development falls back to the local backend', () => {
  assert.throws(() => resolveApiProxyTarget({ NODE_ENV: 'production' }), /API_PROXY_TARGET is not set/);
  assert.throws(() => resolveApiProxyTarget({ NODE_ENV: 'production', API_PROXY_TARGET: '   ' }), /API_PROXY_TARGET is not set/);
  assert.equal(resolveApiProxyTarget({ NODE_ENV: 'development' }), DEV_API_PROXY_TARGET);
  assert.equal(resolveApiProxyTarget({}), DEV_API_PROXY_TARGET);
});

test('accepts an https origin and normalises a trailing slash', () => {
  assert.equal(resolveApiProxyTarget({ NODE_ENV: 'production', API_PROXY_TARGET: 'https://ai-calling-backend-1kmy.onrender.com/' }), 'https://ai-calling-backend-1kmy.onrender.com');
  assert.equal(resolveApiProxyTarget({ NODE_ENV: 'production', API_PROXY_TARGET: 'http://127.0.0.1:4100' }), 'http://127.0.0.1:4100', 'local production-mode testing');
});

test('rejects plain http to a remote host, paths, credentials and garbage', () => {
  assert.throws(() => resolveApiProxyTarget({ NODE_ENV: 'production', API_PROXY_TARGET: 'http://api.example.com' }), /must use https/);
  assert.throws(() => resolveApiProxyTarget({ API_PROXY_TARGET: 'https://api.example.com/api' }), /origin only/);
  assert.throws(() => resolveApiProxyTarget({ API_PROXY_TARGET: 'https://user:pw@api.example.com' }), /origin only/);
  assert.throws(() => resolveApiProxyTarget({ API_PROXY_TARGET: 'not a url' }), /not a valid URL/);
  assert.throws(() => resolveApiProxyTarget({ API_PROXY_TARGET: 'ftp://api.example.com' }), /must use https/);
});
