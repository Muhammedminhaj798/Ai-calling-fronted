'use client';
// Minimal data hooks: no fetching library. A loader runs whenever its deps change (or on reload / poll);
// the previous result stays visible while a newer one is in flight.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { api, getServerSession, getSession, subscribeSession, toApiError, type ApiError, type Session } from './api';

export function useSession(): Session {
  return useSyncExternalStore(subscribeSession, getSession, getServerSession);
}

export interface Query<T> {
  data: T | undefined;
  error: ApiError | undefined;
  /** No data yet and a load is in flight */
  loading: boolean;
  /** A newer load is in flight while previous data is shown */
  refreshing: boolean;
  reload: () => void;
}

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[], opts: { refreshMs?: number; enabled?: boolean } = {}): Query<T> {
  // Nothing is requested until the session is restored, so pages can render inside the shell during prerender.
  const authenticated = useSession().status === 'authenticated';
  const enabled = opts.enabled !== false && authenticated;
  const [tick, setTick] = useState(0);
  const key = `${JSON.stringify(deps)}#${tick}`;
  const [state, setState] = useState<{ key: string; data?: T; error?: ApiError }>({ key: '' });
  // Latest-loader ref, written in an effect (not during render) so a stale closure is never run.
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loaderRef.current().then(
      (data) => alive && setState({ key, data }),
      (err) => alive && setState((s) => ({ key, data: s.data, error: toApiError(err) })),
    );
    const timer = opts.refreshMs ? setInterval(() => setTick((t) => t + 1), opts.refreshMs) : undefined;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [key, enabled, opts.refreshMs]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const stale = enabled && state.key !== key;
  return { data: state.data, error: stale ? undefined : state.error, loading: stale && state.data === undefined, refreshing: stale, reload };
}

export function useApi<T>(path: string | null, opts: { refreshMs?: number } = {}): Query<T> {
  return useLoad(() => api<T>(path ?? ''), [path], { ...opts, enabled: path !== null });
}

export function useDebounce<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Runs a mutation with pending/error state; the caller decides what to reload. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | undefined>();
  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setPending(true);
      setError(undefined);
      try {
        return await fn(...args);
      } catch (err) {
        setError(toApiError(err));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [fn],
  );
  return { run, pending, error, clearError: () => setError(undefined) };
}
