import test from 'node:test';
import assert from 'node:assert/strict';
import { planResponse, AI_FAILED_NOTICE } from '../plan-service.mjs';

const profile = { currentWeight: 200, goalWeight: 180 };

test('bad input gives 400 with errors', async () => {
  const { status, body } = await planResponse({ currentWeight: 'x' });
  assert.equal(status, 400);
  assert.ok(body.errors.length);
});

test('no AI uses the given notice', async () => {
  const { body } = await planResponse(profile, { noAiNotice: 'Add a key.' });
  assert.equal(body.source, 'starter');
  assert.equal(body.notice, 'Add a key.');
});

test('AI failure falls back to a starter plan', async () => {
  const generatePlan = async () => { throw new Error('boom'); };
  const { body } = await planResponse(profile, { generatePlan, log: { error() {} } });
  assert.equal(body.source, 'starter');
  assert.equal(body.notice, AI_FAILED_NOTICE);
});
