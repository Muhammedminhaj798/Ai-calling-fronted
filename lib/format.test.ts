import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isTestCall, providerName } from './format.ts';

describe('isTestCall', () => {
  it('marks the simulator, mock telephony and LiveKit browser calls as test calls', () => {
    assert.deepEqual(['simulator', 'mock', 'livekit'].map(isTestCall), [true, true, true]);
  });
  it('never marks a phone provider, or a missing call, as a test call', () => {
    assert.deepEqual(['exotel', 'livekit_sip', null, undefined].map(isTestCall), [false, false, false, false]);
  });
  it('names the LiveKit browser test', () => {
    assert.equal(providerName('livekit'), 'LiveKit browser test');
  });
});
