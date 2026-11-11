'use client';
// Application shell: navy sidebar (collapsible, mobile drawer), header with breadcrumb, notifications
// and the profile menu. Navigation items carry an optional `roles` allow-list.
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PhoneCall,
  Pill,
  Settings,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useState, type ReactNode } from 'react';
import { api, logout, qs } from '@/lib/api';
import { label } from '@/lib/format';
import type { Page, Role, SafeUser } from '@/lib/types';
import { useLoad } from '@/lib/use-api';
import { Spinner, cx } from './ui';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
  exact?: boolean;
}
export const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/live-calls', label: 'Live Calls', icon: PhoneCall },
  { href: '/dashboard/calls', label: 'Call History', icon: History },
  { href: '/dashboard/orders', label: 'Orders', icon: ClipboardList },
  // Staff may read the queue through Orders; only approvers and admins decide, so only they get the menu entry.
  { href: '/dashboard/approvals', label: 'Approvals', icon: CheckSquare, roles: ['admin', 'approver'] },
  { href: '/dashboard/exceptions', label: 'Exceptions', icon: AlertTriangle },
  { href: '/dashboard/customers', label: 'Customers', icon: Users },
  { href: '/dashboard/products', label: 'Products', icon: Package },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];
export const navFor = (role: Role): NavItem[] => NAV.filter((n) => !n.roles || n.roles.includes(role));
const isActive = (item: NavItem, path: string) => (item.exact ? path === item.href : path === item.href || path.startsWith(item.href + '/'));

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

const PENDING_USER: SafeUser = { id: '', email: '', name: 'Signing in…', role: 'staff', isActive: true, lastLoginAt: null, createdAt: '' };

function NavList({ user, collapsed, path, onNavigate }: { user: SafeUser; collapsed: boolean; path: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto py-2" aria-label="Main">
      {navFor(user.role).map((item) => {
        const active = isActive(item, path);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-current={active ? 'page' : undefined}
            className={cx('mx-2 my-0.5 flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors', active ? 'bg-white/10 font-medium text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white', collapsed && 'justify-center')}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
/** usePathname() is URL data: it must stream in behind Suspense when the route is prerendered. */
function ActiveNavList(props: { user: SafeUser; collapsed: boolean; onNavigate?: () => void }) {
  return <NavList {...props} path={usePathname()} />;
}

function Sidebar({ user, collapsed, onToggle, onNavigate }: { user: SafeUser; collapsed: boolean; onToggle: () => void; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-navy-900 text-slate-200">
      <div className={cx('flex h-14 items-center gap-2 border-b border-white/10 px-3', collapsed && 'justify-center')}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-500 text-white">
          <Pill className="h-4 w-4" aria-hidden />
        </span>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-white">Pharmacy AI</p>
            <p className="truncate text-[11px] text-slate-400">Operations dashboard</p>
          </div>
        )}
      </div>
      <Suspense fallback={<NavList user={user} collapsed={collapsed} path="" onNavigate={onNavigate} />}>
        <ActiveNavList user={user} collapsed={collapsed} onNavigate={onNavigate} />
      </Suspense>
      <div className={cx('border-t border-white/10 p-3', collapsed && 'flex flex-col items-center gap-2')}>
        <div className={cx('flex items-center gap-2', collapsed && 'justify-center')}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-700 text-xs font-semibold text-white" title={user.name}>
            {initials(user.name)}
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="truncate text-[11px] text-slate-400">{label(user.role)}</p>
            </div>
          )}
        </div>
        <button type="button" onClick={onToggle} className="mt-2 hidden w-full items-center justify-center gap-1 rounded-md py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-white lg:flex" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </div>
  );
}

function Breadcrumb() {
  const parts = usePathname().split('/').filter(Boolean);
  const crumbs = parts.map((p, i) => {
    const href = '/' + parts.slice(0, i + 1).join('/');
    return { href, text: NAV.find((n) => n.href === href)?.label ?? (p.length > 20 ? `${p.slice(0, 8)}…` : label(p)) };
  });
  const current = crumbs.at(-1);
  return (
    <div className="min-w-0">
      <nav className="hidden text-xs text-slate-400 sm:block" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={c.href}>
            {i > 0 && <span className="mx-1">/</span>}
            {i < crumbs.length - 1 ? (
              <Link href={c.href} className="hover:text-slate-600">
                {c.text}
              </Link>
            ) : (
              <span className="text-slate-500">{c.text}</span>
            )}
          </span>
        ))}
      </nav>
      <h2 className="truncate text-sm font-semibold text-slate-800">{current?.text ?? 'Dashboard'}</h2>
    </div>
  );
}

/** Pending approvals + open exceptions, refreshed every minute. Counts come from the list endpoints' `total`. */
function Notifications() {
  const [open, setOpen] = useState(false);
  const q = useLoad(
    () =>
      Promise.all([api<Page<unknown>>('/api/approvals/pending' + qs({ pageSize: 1 })), api<Page<unknown>>('/api/exceptions' + qs({ status: 'open', pageSize: 1 }))]).then(([a, e]) => ({ approvals: a.total, exceptions: e.total })),
    [],
    { refreshMs: 60_000 },
  );
  const count = (q.data?.approvals ?? 0) + (q.data?.exceptions ?? 0);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label={`Notifications: ${count} items need attention`} aria-expanded={open}>
        <Bell className="h-4 w-4" />
        {count > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-md border border-slate-200 bg-white p-1 text-sm shadow-lg" onMouseLeave={() => setOpen(false)}>
          <Link href="/dashboard/approvals" onClick={() => setOpen(false)} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-slate-50">
            Pending approvals <span className="font-semibold tabular-nums">{q.data?.approvals ?? '…'}</span>
          </Link>
          <Link href="/dashboard/exceptions" onClick={() => setOpen(false)} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-slate-50">
            Open exceptions <span className="font-semibold tabular-nums">{q.data?.exceptions ?? '…'}</span>
          </Link>
        </div>
      )}
    </div>
  );
}

function ProfileMenu({ user }: { user: SafeUser }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-100" aria-haspopup="menu" aria-expanded={open}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">{initials(user.name)}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-sm font-medium text-slate-800">{user.name}</span>
          <span className="block text-[11px] text-slate-500">{label(user.role)}</span>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-slate-200 bg-white p-1 text-sm shadow-lg" role="menu" onMouseLeave={() => setOpen(false)}>
          <div className="px-2 py-1.5 text-xs text-slate-500">{user.email}</div>
          <Link href="/dashboard/settings" role="menuitem" onClick={() => setOpen(false)} className="block rounded px-2 py-1.5 hover:bg-slate-50">
            Profile & settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-red-700 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function Shell({ user: sessionUser, children }: { user: SafeUser | null; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const user = sessionUser ?? PENDING_USER;
  return (
    <div className="flex min-h-screen">
      <aside className={cx('fixed inset-y-0 left-0 z-30 hidden transition-[width] lg:block', collapsed ? 'w-16' : 'w-60')}>
        <Sidebar user={user} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setDrawer(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-xl">
            <Sidebar user={user} collapsed={false} onToggle={() => undefined} onNavigate={() => setDrawer(false)} />
            <button type="button" onClick={() => setDrawer(false)} className="absolute right-2 top-3 rounded p-1 text-slate-300 hover:text-white" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </aside>
        </div>
      )}
      <div className={cx('flex min-w-0 flex-1 flex-col transition-[margin]', collapsed ? 'lg:ml-16' : 'lg:ml-60')}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4">
          <button type="button" onClick={() => setDrawer(true)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <Suspense fallback={null}>
              <Breadcrumb />
            </Suspense>
          </div>
          {sessionUser && <Notifications />}
          {sessionUser && <ProfileMenu user={sessionUser} />}
        </header>
        <main className="flex-1 p-4 lg:p-6">
          {/* One boundary for every page's URL hooks (useParams, useSearchParams) under Cache Components. */}
          <Suspense fallback={<Spinner />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
