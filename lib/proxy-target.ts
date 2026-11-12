// Backend origin that next.config.ts proxies /api/* to. Read on the server at build/start time only: it is
// deliberately not a NEXT_PUBLIC_ variable, and the browser only ever calls same-origin /api/... paths, so
// the backend's HTTP-only refresh cookie is first-party.
export const DEV_API_PROXY_TARGET = 'http://localhost:4000';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Production must name the backend explicitly (the build fails otherwise); development falls back to the local backend. */
export function resolveApiProxyTarget(env: { API_PROXY_TARGET?: string; NODE_ENV?: string }): string {
  const raw = env.API_PROXY_TARGET?.trim() || (env.NODE_ENV === 'production' ? '' : DEV_API_PROXY_TARGET);
  if (!raw) {
    throw new Error('API_PROXY_TARGET is not set. Production builds proxy /api/* to the backend, e.g. API_PROXY_TARGET=https://ai-calling-backend-1kmy.onrender.com');
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('API_PROXY_TARGET is not a valid URL');
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))) {
    throw new Error('API_PROXY_TARGET must use https (plain http is allowed only for localhost)');
  }
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('API_PROXY_TARGET must be an origin only (scheme://host[:port]), without path, query or credentials');
  }
  return url.origin;
}
