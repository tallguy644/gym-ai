import test from 'node:test';
import assert from 'node:assert/strict';
import { swapExercise, swapOptions } from '../public/swaps.js';
import { starterPlan, validateProfile } from '../domain.mjs';

test('offers machines first for a full gym', () => {
  const opts = swapOptions('Barbell back squat', 'full_gym');
  assert.equal(opts[0], 'Leg press');
  assert.ok(!opts.includes('Barbell back squat'));
});

test('only offers what the equipment allows', () => {
  assert.deepEqual(swapOptions('Push-up', 'bodyweight'), ['Incline push-up']);
  assert.ok(swapOptions('Goblet squat', 'dumbbells').every((o) => !/leg press|hack|smith|barbell/i.test(o)));
});

test('matches the right movement for tricky names', () => {
  assert.ok(swapOptions('Pike push-up', 'full_gym').includes('Machine shoulder press'));
  assert.ok(swapOptions('Bulgarian split squat', 'full_gym').includes('Leg extension'));
  assert.ok(swapOptions('Seated leg curl', 'full_gym').includes('Lying leg curl'));
  assert.deepEqual(swapOptions('Mystery move'), []);
  assert.deepEqual(swapOptions(''), []);
});

test('every starter plan exercise has a swap', () => {
  for (const equipment of ['full_gym', 'dumbbells', 'bodyweight']) {
    const plan = starterPlan(validateProfile({ currentWeight: 200, goalWeight: 180, equipment, daysPerWeek: 4 }).profile);
    for (const day of plan.weeklySchedule) for (const e of day.exercises) assert.ok(swapOptions(e.name, equipment).length > 0, `${equipment}: ${e.name}`);
  }
});

test('swapping keeps sets, reps and rest and remembers the original', () => {
  const e = { name: 'Leg press', sets: 3, reps: '8-12', restSeconds: 90, notes: 'cue' };
  const once = swapExercise(e, 'Hack squat');
  assert.deepEqual(once, { name: 'Hack squat', sets: 3, reps: '8-12', restSeconds: 90, notes: '', swappedFrom: 'Leg press' });
  assert.equal(swapExercise(once, 'Smith machine squat').swappedFrom, 'Leg press');
});

test('full gym starter plans are built from machines and cables', () => {
  const plan = starterPlan(validateProfile({ currentWeight: 180, goalWeight: 190, equipment: 'full_gym' }).profile);
  const names = plan.weeklySchedule.flatMap((d) => d.exercises.map((e) => e.name));
  assert.ok(names.every((n) => /machine|press|pulldown|cable|curl|extension/i.test(n)), names.join(', '));
  assert.ok(!names.some((n) => /barbell|dumbbell/i.test(n)));
});
