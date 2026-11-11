# Pharmacy AI Operations dashboard

Next.js 16 (App Router, Cache Components) · React 19 · Tailwind 4 · Lucide icons · Recharts. Staff-facing dashboard for the AI phone order agent; every screen reads and writes through the backend API (`../backend`), which stays the authority for authentication, roles and order state.

## Run

```bash
# 1. backend (port 4000) — see ../backend/.env.example
cd ../backend && npm install && npm run dev

# 2. dashboard (port 3000)
cp .env.example .env.local        # NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev                       # or: npm run build && npm run start
```

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
| `lib/api.ts` | fetch client: Bearer token in sessionStorage, refresh-cookie rotation on 401, timeouts, GET retry, `fetchAll` page walker |
| `lib/use-api.ts` | `useSession`, `useLoad`/`useApi` (polling, stale-while-refresh), `useDebounce`, `useAction` |
| `lib/types.ts` | TypeScript mirror of the backend responses |
| `lib/metrics.ts` | client-side aggregation for overview/reports + CSV (tested) |
| `lib/format.ts` | money, dates, enum labels, status colours |

Step report with screenshots: `../docs/step-5-dashboard-report.md`.
