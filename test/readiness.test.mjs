import test from 'node:test';
import assert from 'node:assert/strict';
import { FACTORS, readinessAdvice, readinessLabel, readinessScore } from '../public/readiness.js';

test('best and worst check-ins score 100 and 0', () => {
  assert.equal(readinessScore({ sleep: 5, energy: 5, soreness: 1, stress: 1 }), 100);
  assert.equal(readinessScore({ sleep: 1, energy: 1, soreness: 5, stress: 5 }), 0);
});

test('missing or odd values count as the middle', () => {
  assert.equal(readinessScore({}), 50);
  assert.equal(readinessScore({ sleep: 'x', energy: 99, soreness: -4, stress: 3 }), readinessScore({ sleep: 3, energy: 5, soreness: 1, stress: 3 }));
});

test('labels and advice follow the score', () => {
  assert.equal(readinessLabel(88), 'Optimal');
  assert.equal(readinessLabel(65), 'Good');
  assert.equal(readinessLabel(45), 'Moderate');
  assert.equal(readinessLabel(10), 'Low');
  assert.match(readinessAdvice({ sleep: 5, energy: 5, soreness: 1, stress: 1 }), /heavy session/);
  assert.match(readinessAdvice({ sleep: 1, energy: 2, soreness: 5, stress: 4 }), /Take it easy/);
  assert.match(readinessAdvice({ sleep: 4, energy: 4, soreness: 4, stress: 2 }), /Soreness is high/);
});

test('factor weights add up to 1', () => {
  assert.equal(Math.round(FACTORS.reduce((s, f) => s + f.weight, 0) * 100), 100);
});
