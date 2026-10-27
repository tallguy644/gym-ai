import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeGoal, starterPlan, validateProfile } from '../domain.mjs';

test('rejects missing or out-of-range weights', () => {
  const r = validateProfile({ currentWeight: '', goalWeight: 2000 });
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 2);
});

test('fills defaults for optional fields', () => {
  const r = validateProfile({ currentWeight: '200', goalWeight: '180' });
  assert.equal(r.ok, true);
  assert.deepEqual(
    { unit: r.profile.unit, days: r.profile.daysPerWeek, eq: r.profile.equipment, exp: r.profile.experience },
    { unit: 'lb', days: 3, eq: 'full_gym', exp: 'beginner' },
  );
});

test('weight loss gets a safe weekly pace and timeline', () => {
  const a = analyzeGoal({ currentWeight: 220, goalWeight: 190, unit: 'lb' });
  assert.equal(a.goal, 'lose');
  assert.equal(a.change, -30);
  assert.ok(a.weeklyRate > 1 && a.weeklyRate <= 2.2);
  assert.ok(a.estimatedWeeks >= 14 && a.estimatedWeeks <= 25);
});

test('weight gain is slower than weight loss', () => {
  const a = analyzeGoal({ currentWeight: 70, goalWeight: 75, unit: 'kg' });
  assert.equal(a.goal, 'gain');
  assert.ok(a.weeklyRate < 0.3);
});

test('tiny difference means recomposition', () => {
  assert.equal(analyzeGoal({ currentWeight: 180, goalWeight: 181, unit: 'lb' }).goal, 'recomp');
});

test('starter plan has one day per training day and respects equipment', () => {
  const { profile } = validateProfile({ currentWeight: 200, goalWeight: 180, daysPerWeek: 4, equipment: 'bodyweight' });
  const plan = starterPlan(profile);
  assert.equal(plan.weeklySchedule.length, 4);
  const names = plan.weeklySchedule.flatMap((d) => d.exercises.map((e) => e.name)).join(' ');
  assert.doesNotMatch(names, /barbell/i);
  assert.match(plan.weeklySchedule[0].cardio, /minutes/);
});
