// Test Voice Call messages: each API, microphone and LiveKit failure maps to an actionable sentence.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from './api.ts';
import { disconnectMessage, voiceCallError } from './voice-call.ts';

const domError = (name: string) => Object.assign(new Error('x'), { name });

test('API failures from POST /api/voice/sessions', () => {
  assert.match(voiceCallError(new ApiError(401, 'UNAUTHORIZED', 'Missing bearer token')), /sign-in has expired/);
  assert.match(voiceCallError(new ApiError(401, 'TOKEN_EXPIRED', 'Access token expired')), /sign-in has expired/);
  assert.match(voiceCallError(new ApiError(403, 'FORBIDDEN', 'no')), /role is not allowed/);
  assert.match(voiceCallError(new ApiError(404, 'NOT_FOUND', 'Browser voice calls are not enabled')), /LIVEKIT_ENABLED/);
  const invalid = new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', [{ path: 'fromNumber', message: 'Invalid phone number' }]);
  assert.match(voiceCallError(invalid), /rejected \(fromNumber: Invalid phone number\)\. Check the customer phone number/);
  assert.match(voiceCallError(new ApiError(429, 'RATE_LIMITED', 'Too many', { retryAfterSec: 42 })), /Try again in 42 s/);
  assert.match(voiceCallError(new ApiError(502, 'LIVEKIT_UNAVAILABLE', 'x')), /could not create the LiveKit room/);
  assert.match(voiceCallError(new ApiError(0, 'NETWORK', 'x')), /not reachable/);
  assert.match(voiceCallError(new ApiError(500, 'INTERNAL', 'boom')), /Starting the call failed: boom/);
});

test('microphone and LiveKit failures', () => {
  assert.match(voiceCallError(domError('NotAllowedError')), /permission was denied/);
  assert.match(voiceCallError(domError('NotFoundError')), /No microphone was found/);
  assert.match(voiceCallError(domError('NotReadableError')), /in use by another application/);
  assert.match(voiceCallError(Object.assign(new Error('could not establish signal connection'), { name: 'ConnectionError' })), /Could not connect to LiveKit: could not establish signal connection/);
});

test('why a call ended', () => {
  assert.equal(disconnectMessage('CLIENT_INITIATED'), null, 'our own hang-up needs no message');
  assert.equal(disconnectMessage(undefined), null);
  assert.match(disconnectMessage('ROOM_DELETED')!, /closed by the server/);
  assert.match(disconnectMessage('MEDIA_FAILURE')!, /MEDIA_FAILURE/);
});
