import test from 'node:test';
import assert from 'node:assert/strict';
import { goalProgress, monthCalendar, weekStart, weekStreak } from '../public/progress.js';

test('goal progress works for losing and gaining', () => {
  assert.deepEqual(goalProgress(200, 195, 180), { pct: 25, done: 5, total: 20, remaining: 15 });
  assert.equal(goalProgress(150, 155, 160).pct, 50);
});

test('goal progress stays between 0 and 100', () => {
  assert.equal(goalProgress(200, 205, 180).pct, 0);
  assert.equal(goalProgress(200, 175, 180).pct, 100);
  assert.equal(goalProgress(200, 200, 200).pct, 100);
  assert.equal(goalProgress(undefined, 200, 180), null);
});

test('weeks start on Monday', () => {
  assert.equal(weekStart('2026-10-29'), '2026-10-26'); // Thursday
  assert.equal(weekStart('2026-11-01'), '2026-10-26'); // Sunday
  assert.equal(weekStart('2026-10-26'), '2026-10-26');
});

test('streak counts weeks in a row and allows an empty current week', () => {
  const dates = ['2026-10-13', '2026-10-21', '2026-10-27'];
  assert.equal(weekStreak(dates, '2026-10-29'), 3);
  assert.equal(weekStreak(['2026-10-13', '2026-10-21'], '2026-10-29'), 2);
  assert.equal(weekStreak(['2026-10-06', '2026-10-21'], '2026-10-29'), 1);
  assert.equal(weekStreak([], '2026-10-29'), 0);
});

test('month calendar pads to Monday and marks workouts', () => {
  const cells = monthCalendar('2026-10-29', ['2026-10-27', '2026-09-30']);
  assert.equal(cells.filter((c) => c === null).length, 3); // Oct 1 2026 is a Thursday
  assert.equal(cells.filter(Boolean).length, 31);
  assert.deepEqual(cells.filter((c) => c?.done).map((c) => c.date), ['2026-10-27']);
  assert.ok(cells.find((c) => c?.date === '2026-10-30').future);
});
