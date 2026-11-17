// Messages for the Test Voice Call page. Pure (no LiveKit import) so `node --test` covers them: what went wrong
// with the API session, the microphone or the LiveKit connection, in words a tester can act on.
import { ApiError } from './api.ts';

/** Microphone access needs a secure page: HTTPS, or http://localhost during development. */
export function microphoneUnavailable(): string | null {
  if (typeof window === 'undefined') return null;
  if (!window.isSecureContext) return 'The microphone only works on HTTPS or http://localhost. Open the dashboard through one of those.';
  if (!navigator.mediaDevices?.getUserMedia) return 'This browser cannot capture microphone audio.';
  return null;
}

/** The error from starting a test call (session request, microphone, LiveKit connect) → one actionable sentence. */
export function voiceCallError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'NETWORK' || err.code === 'API_UNAVAILABLE' || err.code === 'TIMEOUT') return 'The API server is not reachable. Check that it is running.';
    if (err.code === 'LIVEKIT_UNAVAILABLE') return 'The API could not create the LiveKit room or dispatch the voice agent. Try again; if it persists, check the LiveKit settings on the API.';
    switch (err.status) {
      case 401: // UNAUTHORIZED or TOKEN_EXPIRED, after the client's own refresh attempt failed
        return 'Your sign-in has expired. Sign in again, then start the call.';
      case 403:
        return 'Your role is not allowed to start test calls.';
      case 404:
        return 'Browser voice calls are not available on this API: LiveKit is not enabled (LIVEKIT_ENABLED) or the API is an older version.';
      case 400: {
        const issues = Array.isArray(err.details) ? (err.details as Array<{ path?: string; message?: string }>).map((i) => `${i.path ? `${i.path}: ` : ''}${i.message ?? ''}`).join('; ') : '';
        return `The request was rejected${issues ? ` (${issues})` : ''}. Check the customer phone number.`;
      }
      case 429: {
        const wait = (err.details as { retryAfterSec?: number } | undefined)?.retryAfterSec;
        return `Too many test calls in a short time.${wait ? ` Try again in ${wait} s.` : ' Try again later.'}`;
      }
      default:
        return `Starting the call failed: ${err.message}`;
    }
  }
  const name = (err as { name?: string } | null)?.name;
  const message = (err as { message?: string } | null)?.message ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone permission was denied. Allow the microphone for this site in the browser settings, then start the call again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No microphone was found. Connect one and try again.';
    case 'NotReadableError':
    case 'AbortError':
      return 'The microphone is in use by another application or could not be started.';
    case 'ConnectionError':
      return `Could not connect to LiveKit${message ? `: ${message}` : ''}. The join token is valid for a few minutes; start a new call.`;
    default:
      return `The call failed${message ? `: ${message}` : ''}.`;
  }
}

/** Why the room ended, from LiveKit's DisconnectReason name; null for an ordinary hang-up from this page. */
export function disconnectMessage(reasonName: string | undefined): string | null {
  switch (reasonName) {
    case undefined:
    case 'CLIENT_INITIATED':
      return null;
    case 'ROOM_DELETED':
    case 'ROOM_CLOSED':
      return 'The call was closed by the server (the agent ended it, could not start, or nobody joined in time).';
    case 'PARTICIPANT_REMOVED':
      return 'You were removed from the call.';
    case 'DUPLICATE_IDENTITY':
      return 'The same call was joined from another tab or window.';
    case 'JOIN_FAILURE':
    case 'CONNECTION_TIMEOUT':
    case 'SIGNAL_CLOSE':
      return 'The connection to LiveKit was lost.';
    default:
      return `The call ended (${reasonName}).`;
  }
}
