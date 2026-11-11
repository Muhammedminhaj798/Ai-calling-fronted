// node --test "lib/**/*.test.ts"  (Node 22 strips the types natively; no framework)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countBy, countPerDay, dayKey, rangeFor, summariseCalls, toCsv } from './metrics.ts';

test('rangeFor covers whole calendar days ending now', () => {
  const now = new Date(2026, 10, 10, 15, 30);
  const week = rangeFor('7d', now);
  assert.equal(dayKey(week.from), '2026-11-04');
  assert.equal(week.to, now);
  assert.equal(dayKey(rangeFor('today', now).from), '2026-11-10');
  const custom = rangeFor('custom', now, { from: '2026-11-01', to: '2026-11-03' });
  assert.equal(dayKey(custom.from), '2026-11-01');
  assert.equal(custom.to.getHours(), 23);
});

test('countPerDay zero-fills every day and ignores rows outside the range', () => {
  const from = new Date(2026, 10, 8);
  const to = new Date(2026, 10, 10, 12);
  const rows = [{ at: new Date(2026, 10, 8, 9).toISOString() }, { at: new Date(2026, 10, 10, 1).toISOString() }, { at: new Date(2026, 10, 10, 2).toISOString() }, { at: new Date(2026, 9, 1).toISOString() }];
  assert.deepEqual(countPerDay(rows, (r) => r.at, from, to), [
    { day: '2026-11-08', count: 1 },
    { day: '2026-11-09', count: 0 },
    { day: '2026-11-10', count: 2 },
  ]);
});

test('summariseCalls averages only calls with a duration and computes rates', () => {
  const s = summariseCalls([
    { status: 'completed', language: 'ml', durationSeconds: 60, order: { id: 'o1' } },
    { status: 'completed', language: 'ml', durationSeconds: 120, order: null },
    { status: 'handed_over', language: 'en', durationSeconds: null, order: null },
    { status: 'in_progress', language: null, durationSeconds: null, order: null },
  ]);
  assert.equal(s.total, 4);
  assert.equal(s.completed, 2);
  assert.equal(s.handedOver, 1);
  assert.equal(s.inProgress, 1);
  assert.equal(s.avgDurationSeconds, 90);
  assert.equal(s.durationSamples, 2);
  assert.equal(s.successRate, 0.5);
  assert.equal(s.conversionRate, 0.25);
  assert.deepEqual(countBy([{ l: 'ml' }, { l: null }, { l: 'ml' }], (r) => r.l), [
    { name: 'ml', value: 2 },
    { name: 'unknown', value: 1 },
  ]);
  assert.equal(summariseCalls([]).successRate, null);
});

test('toCsv quotes commas, quotes and newlines', () => {
  const csv = toCsv([{ a: 'x,y', b: 'say "hi"', c: 'line\nbreak', d: null, e: 5 }], ['a', 'b', 'c', 'd', 'e']);
  assert.equal(csv, 'a,b,c,d,e\r\n"x,y","say ""hi""","line\nbreak",,5');
});
