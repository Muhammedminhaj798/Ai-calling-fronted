// Browser-driven interaction checks for the dashboard (headless Chrome/Edge driven over raw CDP; no extra deps).
// Development only: needs the backend (port 4000) with the seeded mock data (`npm run seed -- --samples`) and the
// dashboard (port 3000, `npm run build && npm run start`). Reads SEED_ADMIN_* from ../backend/.env and never prints them.
// Usage: npm run check:ui   — prints PASS/FAIL per check and exits non-zero on any failure.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.resolve(HERE, '../../backend/.env');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
if (!CHROME) throw new Error('no Chrome/Edge binary found');

const FRONT = 'http://localhost:3000';
const API = 'http://localhost:4000';
const PORT = 9335;
const env = Object.fromEntries(fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const PASSWORD = env.SEED_ADMIN_PASSWORD;
const USERS = { admin: env.SEED_ADMIN_EMAIL, staff: 'staff@example.com', approver: 'approver@example.com' };
const downloads = path.join(process.env.TEMP ?? '/tmp', 'pharmacy-ui-downloads');
fs.rmSync(downloads, { recursive: true, force: true });
fs.mkdirSync(downloads, { recursive: true });

async function apiCall(method, pathname, body, token, attempt = 1) {
  const res = await fetch(API + pathname, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (res.status >= 500 && attempt < 4) {
    await new Promise((r) => setTimeout(r, 3000 * attempt)); // Neon drops connections intermittently
    return apiCall(method, pathname, body, token, attempt + 1);
  }
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : undefined;
}
const adminToken = (await apiCall('POST', '/api/auth/login', { email: USERS.admin, password: PASSWORD })).accessToken;

const profile = path.join(process.env.TEMP ?? '/tmp', 'pharmacy-ui-check-profile');
fs.rmSync(profile, { recursive: true, force: true });
const proc = spawn(CHROME, [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--disable-gpu', `--user-data-dir=${profile}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  try {
    wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl;
  } catch {}
  if (!wsUrl) await new Promise((r) => setTimeout(r, 200));
}
const ws = new WebSocket(wsUrl);
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
const cdp = (method, params = {}) => new Promise((res, rej) => {
  const id = ++seq;
  pending.set(id, (msg) => (msg.error ? rej(new Error(method + ': ' + JSON.stringify(msg.error))) : res(msg.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (expression) => {
  const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('evaluate failed: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text) + ' in ' + expression.slice(0, 120));
  return r.result.value;
};
async function waitFor(expression, ms = 15000, label = expression) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await ev(expression)) return true;
    await sleep(250);
  }
  throw new Error(`timeout waiting for: ${label} (at ${await ev('location.pathname')}; dialog: ${JSON.stringify(await ev("document.querySelector('dialog[open]')?.innerText.slice(0,160) ?? null"))})`);
}
const go = async (url) => {
  await cdp('Page.navigate', { url: FRONT + url });
  await sleep(1200);
};
// React controlled inputs need the native setter + input event
const setValue = (selector, value) => ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; })()`);
const clickText = (tag, text) => ev(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(tag)})].find(e => e.textContent.trim() === ${JSON.stringify(text)}); if (!el) return false; el.click(); return true; })()`);
const clickSel = (selector) => ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
const bodyHas = (text) => `document.body.innerText.includes(${JSON.stringify(text)})`;
const dialogConfirm = async () => {
  await waitFor(`document.querySelector('dialog[open]') !== null`, 5000, 'dialog open');
  if (!(await ev(`(() => { const b = [...document.querySelectorAll('dialog[open] button')].find(e => e.textContent.trim() === 'Confirm'); if (!b || b.disabled) return false; b.click(); return true; })()`))) throw new Error('Confirm button missing or disabled');
};

await cdp('Page.enable');
await cdp('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', `${name} — ${e.message.split('\n')[0]}`]);
  }
}
async function loginAs(role) {
  await go('/login');
  await waitFor(`document.querySelector('input[name=email]') !== null`);
  await ev(`document.querySelector('input[name=email]').value = ${JSON.stringify(USERS[role])}; document.querySelector('input[name=password]').value = ${JSON.stringify(PASSWORD)}; true`);
  await clickSel('button[type=submit]');
  await waitFor(`location.pathname === '/dashboard'`, 15000, 'redirect to /dashboard after login');
  await waitFor(`document.querySelector('header')?.innerText.includes(${JSON.stringify(role === 'admin' ? 'Administrator' : 'Mock ' + role)})`, 15000, 'header shows the user');
}
async function logoutViaMenu() {
  await waitFor(`!!document.querySelector('header button[aria-haspopup=menu]')`, 15000, 'profile button (session restored)');
  await clickSel('header button[aria-haspopup=menu]');
  await waitFor(`!!document.querySelector('[role=menu]')`, 5000, 'profile menu');
  await clickText('button', 'Log out');
  await waitFor(`location.pathname === '/login'`, 10000, 'redirect to /login after logout');
}

// 1. login + logout + protected route
await check('login form signs in and lands on /dashboard', () => loginAs('admin'));
await check('wrong password shows an error and stays on /login', async () => {
  await logoutViaMenu();
  await waitFor(`document.querySelector('input[name=email]') !== null`);
  await ev(`document.querySelector('input[name=email]').value = ${JSON.stringify(USERS.admin)}; document.querySelector('input[name=password]').value = 'definitely-wrong-password'; true`);
  await clickSel('button[type=submit]');
  await waitFor(`!!document.querySelector('[role=alert]') && location.pathname === '/login'`, 10000, 'error alert');
});
await check('protected route redirects anonymous visitors to /login', async () => {
  await go('/dashboard/orders');
  await waitFor(`location.pathname === '/login'`, 10000, 'redirect');
});

// 2. role-based navigation
await check('staff user does not see the Approvals menu entry', async () => {
  await loginAs('staff');
  await waitFor(`document.querySelectorAll('aside nav a').length >= 9`);
  if (await ev(`!!document.querySelector('aside nav a[href="/dashboard/approvals"]')`)) throw new Error('Approvals link visible to staff');
  await go('/dashboard/approvals');
  await waitFor(`document.querySelector('header')?.innerText.includes('Mock staff')`, 15000, 'session restored after full load');
  await waitFor(bodyHas('approving or rejecting requires the approver or admin role'), 10000, 'read-only notice');
  await logoutViaMenu();
});
await check('approver user sees the Approvals menu entry', async () => {
  await loginAs('approver');
  await waitFor(`!!document.querySelector('aside nav a[href="/dashboard/approvals"]')`);
});

// 3. approve / reject / reserve-failure through the UI (as approver)
// a fresh pending-approval order of our own (mock product, mock customer)
const customer = (await apiCall('GET', '/api/customers?q=MOCK-CUST-001', undefined, adminToken)).data[0];
const products = (await apiCall('GET', '/api/products?pageSize=50', undefined, adminToken)).data;
const para = products.find((p) => p.externalCode === 'MOCK-PARA-650');
async function confirmedOrder(items, po) {
  const o = (await apiCall('POST', '/api/orders', { customerId: customer.id, customerPoReference: po, items }, adminToken)).order;
  const rb = (await apiCall('POST', `/api/orders/${o.id}/readback`, {}, adminToken)).readback;
  await apiCall('POST', `/api/orders/${o.id}/confirm`, { revision: rb.revision, source: 'manual' }, adminToken);
  return o;
}
const pendingOrder = await confirmedOrder([{ productId: para.id, requestedText: 'Mockamol 650 (ui check)', quantity: 2 }], 'MOCK-PO-UI-APPROVE');
await apiCall('POST', `/api/orders/${pendingOrder.id}/reserve`, undefined, adminToken);
await check('approver approves the pending order through the dialog', async () => {
  if (!pendingOrder) throw new Error('no pending order in the demo data');
  await go(`/dashboard/orders/${pendingOrder.id}`);
  await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Approve')`);
  await clickText('button', 'Approve');
  await setValue('dialog[open] textarea', 'UI check approval (mock data)');
  await dialogConfirm();
  await waitFor(`!document.querySelector('dialog[open]') && document.body.innerText.includes('Approved')`, 25000, 'status Approved');
  const fresh = await apiCall('GET', `/api/orders/${pendingOrder.id}`, undefined, adminToken);
  if (fresh.order.status !== 'approved') throw new Error('backend status is ' + fresh.order.status);
});
// a customer_confirmed order whose reservation fails (out-of-stock line) → reserve shows the failure, then reject with a reason
const oos = products.find((p) => p.externalCode === 'MOCK-AMOX-500-OOS');
const draft = await confirmedOrder([{ productId: oos.id, requestedText: 'Mockxicillin 500 (ui check)', quantity: 4 }], 'MOCK-PO-UI-REJECT');
await check('reserve-stock failure is reported from the backend outcome', async () => {
  await go(`/dashboard/orders/${draft.id}`);
  await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Reserve stock')`);
  await clickText('button', 'Reserve stock');
  await dialogConfirm();
  await waitFor(bodyHas('Reservation failed'), 15000, 'failure banner');
});
await check('reject requires a reason and moves the order to rejected', async () => {
  await clickText('button', 'Reject');
  await waitFor(`document.querySelector('dialog[open]') !== null`, 5000, 'dialog');
  if (!(await ev(`[...document.querySelectorAll('dialog[open] button')].find(e => e.textContent.trim() === 'Confirm').disabled`))) throw new Error('Confirm enabled without a reason');
  await setValue('dialog[open] textarea', 'UI check rejection (mock data)');
  await dialogConfirm();
  await waitFor(`!document.querySelector('dialog[open]') && document.body.innerText.includes('Rejected')`, 25000, 'status Rejected');
  const fresh = await apiCall('GET', `/api/orders/${draft.id}`, undefined, adminToken);
  if (fresh.order.status !== 'rejected') throw new Error('backend status is ' + fresh.order.status);
});

// 4. exceptions: assign + resolve
const openException = (await apiCall('GET', '/api/exceptions?status=open&pageSize=1', undefined, adminToken)).data[0];
await check('exception can be assigned to a staff member from the list', async () => {
  if (!openException) throw new Error('no open exception in the demo data');
  await go(`/dashboard/exceptions/${openException.id}`);
  await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Assign')`);
  await clickText('button', 'Assign');
  await waitFor(`document.querySelectorAll('dialog[open] select option').length >= 2`, 5000, 'staff options');
  const staffId = await ev(`[...document.querySelectorAll('dialog[open] select option')].find(o => o.textContent.includes('Mock staff'))?.value`);
  if (!staffId) throw new Error('Mock staff not in the assignee list');
  await setValue('dialog[open] select', staffId);
  await dialogConfirm();
  await waitFor(`!document.querySelector('dialog[open]') && document.body.innerText.includes('Mock staff (staff@example.com)')`, 15000, 'assignee shown');
});
await check('exception resolve requires a note and closes it', async () => {
  await clickText('button', 'Resolve');
  await waitFor(`document.querySelector('dialog[open]') !== null`, 5000, 'dialog');
  await setValue('dialog[open] textarea', 'UI check resolution (mock data)');
  await dialogConfirm();
  await waitFor(bodyHas('Closed as Resolved'), 15000, 'closed banner');
});

// 5. calls listing + detail transcript
await check('call history lists calls and the detail renders the transcript and tool table', async () => {
  await go('/dashboard/calls');
  await waitFor(`document.querySelectorAll('tbody tr').length >= 3`);
  await clickSel('tbody tr a[href^="/dashboard/calls/"]');
  await waitFor(bodyHas('Tool execution history'), 15000, 'detail');
  await waitFor(bodyHas('AI assistant'), 15000, 'transcript entry');
  await waitFor(bodyHas('identify_customer'), 15000, 'tool row');
});

// 6. search, filters, pagination text
await check('customer search narrows the list', async () => {
  await go('/dashboard/customers');
  await waitFor(`document.querySelectorAll('tbody tr').length >= 1`);
  await setValue('input[placeholder="Search customers"]', 'sample');
  await sleep(1500);
  await waitFor(`document.querySelectorAll('tbody tr').length === 1 && document.body.innerText.includes('Sample Medicals (mock)')`, 10000, 'one matching row');
  await setValue('input[placeholder="Search customers"]', 'zzz-no-such-customer');
  await waitFor(bodyHas('No customers found'), 10000, 'empty state');
});
await check('product search and status filter work', async () => {
  await go('/dashboard/products');
  await waitFor(`document.querySelectorAll('tbody tr').length >= 4`);
  await setValue('input[placeholder="Search products"]', 'mockzine');
  await waitFor(`document.querySelectorAll('tbody tr').length === 1`, 10000, 'one product');
  await setValue('input[placeholder="Search products"]', '');
  await ev(`(() => { const s = [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.value === 'discontinued')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s, 'discontinued'); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await waitFor(bodyHas('No products found'), 10000, 'empty state for discontinued');
});
await check('orders status filter and pagination summary', async () => {
  await go('/dashboard/orders');
  await waitFor(`document.querySelectorAll('tbody tr').length >= 6`);
  await ev(`(() => { const s = [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.value === 'approved')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s, 'approved'); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await waitFor(`document.querySelectorAll('tbody tr').length >= 1 && [...document.querySelectorAll('tbody tr')].every(r => r.innerText.includes('Approved'))`, 10000, 'only approved rows');
  await waitFor(`/1–\\d+ of \\d+/.test(document.body.innerText)`, 5000, 'pagination summary');
});
await check('live calls search filters the polled rows', async () => {
  await apiCall('POST', '/api/conversations', { fromNumber: '+919333333333' }, adminToken);
  await go('/dashboard/live-calls');
  await waitFor(`document.querySelectorAll('tbody tr').length >= 1`);
  await setValue('input[placeholder="Caller number or customer"]', '+919333');
  await waitFor(`document.querySelectorAll('tbody tr').length >= 1 && [...document.querySelectorAll('tbody tr')].every(r => r.innerText.includes('+919333333333'))`, 10000, 'only matching rows');
});

// 7. CSV export
await check('reports CSV export downloads a file with a header row', async () => {
  await go('/dashboard/reports');
  await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('Calls CSV'))`);
  await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Calls CSV')).click(); true`);
  const start = Date.now();
  let file;
  while (Date.now() - start < 10000 && !file) {
    file = fs.readdirSync(downloads).find((f) => f.startsWith('calls-') && f.endsWith('.csv'));
    if (!file) await sleep(300);
  }
  if (!file) throw new Error('no csv downloaded');
  const head = fs.readFileSync(path.join(downloads, file), 'utf8').split(/\r?\n/)[0];
  if (!head.startsWith('id,startedAt,')) throw new Error('unexpected header: ' + head);
});

// 8. responsive drawer
await check('mobile drawer opens and closes on navigation', async () => {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await go('/dashboard');
  await waitFor(`!!document.querySelector('button[aria-label="Open menu"]')`);
  await clickSel('button[aria-label="Open menu"]');
  await waitFor(`!!document.querySelector('button[aria-label="Close menu"]')`, 5000, 'drawer open');
  await clickSel('div.fixed.inset-0 aside nav a[href="/dashboard/products"]');
  await waitFor(`location.pathname === '/dashboard/products' && !document.querySelector('button[aria-label="Close menu"]')`, 10000, 'navigated and drawer closed');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
});

// 9. settings shows provider modes without secrets
await check('settings shows Mock providers and never a credential value', async () => {
  await go('/dashboard/settings');
  await waitFor(bodyHas('Not verified live'));
  const text = await ev('document.body.innerText');
  if (text.includes(env.JWT_SECRET ?? '\u0000')) throw new Error('secret leaked');
  if ((text.match(/\bMock\b/g) ?? []).length < 4) throw new Error('mock badges missing');
});

ws.close();
proc.kill();
report();
function report() {
  for (const [s, n] of results) console.log(s, n);
  const passed = results.filter((r) => r[0] === 'PASS').length;
  console.log(`${passed}/${results.length} passed`);
  if (passed !== results.length) process.exitCode = 1;
}
process.on('uncaughtException', (e) => { console.error('ABORTED:', e.message); report(); proc.kill(); process.exit(1); });
