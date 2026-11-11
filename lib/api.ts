// Central API client + session store. Backend conventions (backend/src/modules/auth): Bearer access token
// (15 min), refresh token in an HTTP-only cookie scoped to /api/auth on the API origin, rotated on every
// refresh. The access token lives in sessionStorage (per tab); on 401 we refresh once and re-send.
import type { AuthSession, SafeUser } from './types';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const TOKEN_KEY = 'pharmacy.accessToken';
const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const name = (err as { name?: string } | null)?.name;
  if (name === 'TimeoutError') return new ApiError(0, 'TIMEOUT', 'The API server did not respond in time');
  if (name === 'AbortError') return new ApiError(0, 'ABORTED', 'Request cancelled');
  return new ApiError(0, 'NETWORK', `Cannot reach the API server at ${API_URL}`);
}

// --- session store (useSyncExternalStore-compatible) ---
export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';
export interface Session {
  status: SessionStatus;
  user: SafeUser | null;
}
const SERVER_SESSION: Session = { status: 'loading', user: null };
let session: Session = SERVER_SESSION;
let token: string | null = null;
const listeners = new Set<() => void>();

function setSession(next: Session): void {
  session = next;
  for (const l of listeners) l();
}
export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const getSession = (): Session => session;
export const getServerSession = (): Session => SERVER_SESSION;

function loadToken(): string | null {
  if (token === null && typeof window !== 'undefined') token = window.sessionStorage.getItem(TOKEN_KEY);
  return token;
}
function storeToken(next: string | null): void {
  token = next;
  try {
    if (next) window.sessionStorage.setItem(TOKEN_KEY, next);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: token stays in memory for this page */
  }
}
function clearSession(): void {
  storeToken(null);
  setSession({ status: 'anonymous', user: null });
}

// --- transport ---
export interface RequestInit {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function send<T>(path: string, init: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  const bearer = loadToken();
  if (bearer) headers['authorization'] = `Bearer ${bearer}`;
  const signals = [AbortSignal.timeout(init.timeoutMs ?? DEFAULT_TIMEOUT_MS), ...(init.signal ? [init.signal] : [])];
  const res = await fetch(API_URL + path, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: 'include',
    signal: AbortSignal.any(signals),
  });
  const text = res.status === 204 ? '' : await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; details?: unknown } } | undefined)?.error;
    throw new ApiError(res.status, e?.code ?? `HTTP_${res.status}`, e?.message ?? res.statusText ?? 'Request failed', e?.details);
  }
  return data as T;
}

/** Typed request. 401 → one refresh + re-send (the server rejected before any handler ran); network failure → one retry for GET only. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method ?? 'GET';
  try {
    return await send<T>(path, init);
  } catch (err) {
    const apiErr = toApiError(err);
    if (apiErr.status === 401 && !path.startsWith('/api/auth/')) {
      if (await refreshSession()) return send<T>(path, init);
      throw apiErr;
    }
    if (apiErr.status === 0 && apiErr.code === 'NETWORK' && method === 'GET' && !init.signal?.aborted) {
      await new Promise((r) => setTimeout(r, 400));
      return send<T>(path, init).catch((e) => Promise.reject(toApiError(e)));
    }
    throw apiErr;
  }
}

/** Builds "?a=1&b=x" from an object, dropping empty values. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  const s = search.toString();
  return s ? `?${s}` : '';
}

/**
 * Walks a paginated list (pageSize 200) so dashboards can aggregate client-side with the existing APIs.
 * ponytail: capped at `maxPages` (2 000 rows); add GET /api/reports/summary (server-side groupBy) when volume exceeds that.
 */
export async function fetchAll<T>(path: string, params: Record<string, string | number | undefined>, maxPages = 10): Promise<{ rows: T[]; total: number; complete: boolean }> {
  const rows: T[] = [];
  let total = 0;
  for (let page = 1; page <= maxPages; page++) {
    const res = await api<{ data: T[]; total: number }>(path + qs({ ...params, page, pageSize: 200 }));
    rows.push(...res.data);
    total = res.total;
    if (rows.length >= total || res.data.length === 0) break;
  }
  return { rows, total, complete: rows.length >= total };
}

// --- auth ---
let refreshing: Promise<boolean> | null = null;

/** Rotates the refresh cookie into a new access token. Serialised across tabs with the Web Locks API, because a rotated refresh token presented twice revokes the whole session family. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const run = async () => {
      const s = await send<AuthSession>('/api/auth/refresh', { method: 'POST', body: {} });
      storeToken(s.accessToken);
      setSession({ status: 'authenticated', user: s.user });
      return true;
    };
    try {
      return await (typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request('pharmacy-session-refresh', run) : run());
    } catch {
      clearSession();
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

let booted = false;
/** Restores the session on first load: validates the stored access token, else tries the refresh cookie. */
export async function bootstrapSession(): Promise<void> {
  if (booted) return;
  booted = true;
  if (loadToken()) {
    try {
      const { user } = await send<{ user: SafeUser }>('/api/auth/me', {});
      setSession({ status: 'authenticated', user });
      return;
    } catch {
      /* expired or unreachable: fall through to the refresh cookie */
    }
  }
  await refreshSession();
}

export async function login(email: string, password: string): Promise<SafeUser> {
  const s = await send<AuthSession>('/api/auth/login', { method: 'POST', body: { email, password } }).catch((e) => Promise.reject(toApiError(e)));
  storeToken(s.accessToken);
  setSession({ status: 'authenticated', user: s.user });
  return s.user;
}

export async function logout(): Promise<void> {
  try {
    await send('/api/auth/logout', { method: 'POST', body: {} });
  } catch {
    /* the server revokes on a best-effort basis; local state is cleared regardless */
  }
  clearSession();
}
