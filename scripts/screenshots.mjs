// Dashboard screenshots through headless Chrome/Edge + raw CDP (Node 22 global WebSocket; no extra deps).
// Development only: backend on 4000 with seeded mock data, dashboard on 3000. Logs in through the API with the
// SEED_ADMIN_* credentials from ../backend/.env (never printed), injects the token, visits every route, writes PNGs.
// Usage: npm run screenshots [-- <outDir> [admin|staff|approver]]   (default ../Ai-calling-docs/screenshots/dashboard)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const FRONT = 'http://localhost:3000';
const API = 'http://localhost:4000';
const OUT = process.argv[2] ?? path.resolve(HERE, '../../Ai-calling-docs/screenshots/dashboard');
const PORT = 9333;
fs.mkdirSync(OUT, { recursive: true });

const env = Object.fromEntries(
  fs.readFileSync(path.resolve(HERE, '../../backend/.env'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const role = process.argv[3] ?? 'admin';
const email = role === 'admin' ? env.SEED_ADMIN_EMAIL : `${role}@example.com`;
const loginRes = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: env.SEED_ADMIN_PASSWORD }) });
if (!loginRes.ok) throw new Error('login failed ' + loginRes.status);
const { accessToken } = await loginRes.json();

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
if (!chrome) throw new Error('no Chrome/Edge binary found');
const profile = path.join(process.env.TEMP ?? '.', 'pharmacy-shots-profile');
const proc = spawn(chrome, [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${profile}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });

async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('chrome did not expose a page target');
}
const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener('open', r));
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const cdp = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, (msg) => (msg.error ? reject(new Error(method + ': ' + JSON.stringify(msg.error))) : resolve(msg.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evaluate = async (expression) => (await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

async function settle(maxMs = 12000) {
  // wait until no spinner/loading text remains (role=status) or timeout
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const busy = await evaluate(`document.querySelectorAll('[role="status"]').length`);
    if (!busy) break;
    await sleep(300);
  }
  await sleep(700);
}

await cdp('Page.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await cdp('Page.navigate', { url: FRONT + '/login' });
await sleep(2500);
await evaluate(`sessionStorage.setItem('pharmacy.accessToken', ${JSON.stringify(accessToken)}); 'ok'`);

async function shot(name, url, { width = 1440, height = 900, mobile = false, fullPage = true, before } = {}) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await cdp('Page.navigate', { url: FRONT + url });
  await sleep(1500);
  await settle();
  if (before) {
    await evaluate(before);
    await sleep(800);
  }
  const docHeight = fullPage ? Math.min(await evaluate('document.documentElement.scrollHeight'), 4000) : height;
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: Math.max(height, docHeight), deviceScaleFactor: 1, mobile });
  await sleep(300);
  const { data } = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  const title = await evaluate('document.title');
  console.log(name.padEnd(22), url.padEnd(34), `${width}x${Math.max(height, docHeight)}`, title);
}

const firstHref = async (selector) => evaluate(`(document.querySelector(${JSON.stringify(selector)}) || {}).getAttribute?.('href') || ''`);

// a fresh simulated session (unregistered caller) so the live-calls table has a row
await fetch(API + '/api/conversations', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ fromNumber: '+919222222222' }) });
await shot('01-overview', '/dashboard');
await shot('02-live-calls', '/dashboard/live-calls');
await shot('03-calls', '/dashboard/calls');
const callHref = await firstHref('a[href^="/dashboard/calls/"]');
if (callHref) await shot('04-call-detail', callHref);
await shot('05-orders', '/dashboard/orders');
await shot('06-approvals', '/dashboard/approvals');
const pendingHref = await firstHref('a[href^="/dashboard/orders/"]');
if (pendingHref) await shot('07-order-detail', pendingHref);
await shot('08-exceptions', '/dashboard/exceptions');
const excHref = await firstHref('a[href^="/dashboard/exceptions/"]');
if (excHref) await shot('09-exception-detail', excHref);
await shot('10-customers', '/dashboard/customers');
const custHref = await firstHref('a[href^="/dashboard/customers/"]');
if (custHref) await shot('11-customer-detail', custHref);
await shot('12-products', '/dashboard/products');
const prodHref = await firstHref('a[href^="/dashboard/products/"]');
if (prodHref) await shot('13-product-detail', prodHref);
await shot('14-reports', '/dashboard/reports');
await shot('15-settings', '/dashboard/settings');
await shot('16-overview-1366', '/dashboard', { width: 1366, height: 768 });
await shot('17-mobile-overview', '/dashboard', { width: 390, height: 844, mobile: true });
await shot('18-mobile-drawer', '/dashboard/orders', { width: 390, height: 844, mobile: true, fullPage: false, before: `document.querySelector('button[aria-label="Open menu"]').click(); 'ok'` });
await evaluate(`sessionStorage.removeItem('pharmacy.accessToken'); 'ok'`);
await shot('19-login', '/login', { fullPage: false });

ws.close();
proc.kill();
console.log('done →', OUT);
