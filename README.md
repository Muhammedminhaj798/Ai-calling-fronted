# Pharmacy AI Operations dashboard

Next.js 16 (App Router, Cache Components) · React 19 · Tailwind 4 · Lucide icons · Recharts. Staff-facing dashboard for the AI phone order agent; every screen reads and writes through the backend API (`../backend`), which stays the authority for authentication, roles and order state.

## Run

```bash
# 1. backend (port 4000) — see ../backend/.env.example
cd ../backend && npm install && npm run dev

# 2. dashboard (port 3000)
cp .env.example .env.local        # API_PROXY_TARGET=http://localhost:4000
npm install
npm run dev                       # or: npm run build && npm run start
```

The browser calls only same-origin `/api/...` paths. `next.config.ts` rewrites them to `API_PROXY_TARGET` (on Vercel, an external rewrite acting as a reverse proxy), so the backend's `HttpOnly; Secure; SameSite=Strict` refresh cookie is first-party and CORS is not involved. `API_PROXY_TARGET` is server-side only (never `NEXT_PUBLIC_`) and must be an origin such as `https://ai-calling-backend-1kmy.onrender.com`. `next build` and `next start` fail without it; `next dev` falls back to `http://localhost:4000`. Plain `http` is accepted only for localhost.

**Vercel:** set `API_PROXY_TARGET` for Production and Preview, then redeploy. `NEXT_PUBLIC_API_URL` is no longer read.

Sign in with a staff user. For a development database, `cd ../backend && npm run seed -- --samples` creates the admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` plus `staff@example.com` and `approver@example.com` (same password) and clearly labelled mock products and one mock customer.

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (eslint-config-next)
npm run build       # next build (prerender rules of Cache Components are enforced here)
npm test            # node --test lib/**/*.test.ts (no framework)
```

## Layout

| Path | Purpose |
|---|---|
| `app/login` | sign-in form (POST /api/auth/login) |
| `app/dashboard/layout.tsx` | protected shell: restores the session, redirects anonymous visitors |
| `app/dashboard/**` | overview, live-calls, calls[/id], orders[/id], approvals, exceptions[/id], customers[/id], products[/id], reports, settings |
| `components/shell.tsx` | sidebar (role-filtered nav, collapsible, mobile drawer), header, notifications, profile menu |
| `components/ui.tsx` | the UI kit: badges, buttons, cards, tables, pagination, states, fields, native `<dialog>`, customer picker |
| `components/charts.tsx` | Recharts bars (single hue, no animation) |
| `lib/api.ts` | fetch client: same-origin `/api` paths, Bearer token in sessionStorage, refresh-cookie rotation on 401 (`keepalive`, so a reload mid-refresh keeps the rotated cookie; one retry on `REFRESH_TOKEN_SUPERSEDED`), timeouts, GET retry (network or proxy 5xx), `fetchAll` page walker |
| `lib/proxy-target.ts` | validates `API_PROXY_TARGET` for the `/api/*` rewrite in `next.config.ts` (tested) |
| `lib/use-api.ts` | `useSession`, `useLoad`/`useApi` (polling, stale-while-refresh), `useDebounce`, `useAction` |
| `lib/types.ts` | TypeScript mirror of the backend responses |
| `lib/metrics.ts` | client-side aggregation for overview/reports + CSV (tested) |
| `lib/format.ts` | money, dates, enum labels, status colours |

Project documentation (architecture, build-step reports, screenshots) lives in [Ai-calling-docs](https://github.com/Muhammedminhaj798/Ai-calling-docs). Step 5 report with screenshots: [reports/step-5/step-5-dashboard-report.md](https://github.com/Muhammedminhaj798/Ai-calling-docs/blob/main/reports/step-5/step-5-dashboard-report.md).
