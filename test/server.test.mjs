import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';
import { buildPrompt, createPlanGenerator, PLAN_SCHEMA } from '../ai.mjs';
import { starterPlan, validateProfile } from '../domain.mjs';

const quiet = { error() {} };

async function withServer(opts, fn) {
  const server = createServer({ log: quiet, ...opts });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}

const post = (base, body) => fetch(`${base}/api/plan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('serves the page', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(base);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Gym AI/);
  });
});

test('returns 400 with readable errors for bad input', async () => {
  await withServer({}, async (base) => {
    const res = await post(base, { currentWeight: 'abc' });
    assert.equal(res.status, 400);
    assert.ok((await res.json()).errors.length > 0);
  });
});

test('without AI it returns a starter plan', async () => {
  await withServer({ generatePlan: null }, async (base) => {
    const data = await (await post(base, { currentWeight: 200, goalWeight: 180 })).json();
    assert.equal(data.source, 'starter');
    assert.equal(data.analysis.goal, 'lose');
    assert.equal(data.plan.weeklySchedule.length, 3);
  });
});

test('uses the AI plan when available and falls back if it fails', async () => {
  const aiPlan = { title: 'AI plan', summary: '', weeklySchedule: [], progression: '', nutrition: [], safety: [] };
  await withServer({ generatePlan: async () => aiPlan }, async (base) => {
    const data = await (await post(base, { currentWeight: 150, goalWeight: 165 })).json();
    assert.equal(data.source, 'ai');
    assert.equal(data.plan.title, 'AI plan');
  });
  await withServer({ generatePlan: async () => { throw new Error('down'); } }, async (base) => {
    const data = await (await post(base, { currentWeight: 150, goalWeight: 165 })).json();
    assert.equal(data.source, 'starter');
    assert.ok(data.notice);
  });
});

test('AI request sends the profile and the plan schema, and parses the reply', async () => {
  const { profile } = validateProfile({ currentWeight: 210, goalWeight: 185, notes: 'sore shoulder', daysPerWeek: 4 });
  let sent;
  const fakeClient = { beta: { messages: { create: async (params) => {
    sent = params;
    return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(starterPlan(profile)) }] };
  } } } };
  const plan = await createPlanGenerator({ client: fakeClient, model: 'test-model' })(profile);
  assert.equal(plan.weeklySchedule.length, 4);
  assert.equal(sent.model, 'test-model');
  assert.deepEqual(sent.output_config.format.schema, PLAN_SCHEMA);
  assert.match(sent.messages[0].content, /sore shoulder/);
  assert.match(buildPrompt(profile), /Goal: lose/);
});

test('AI refusal becomes an error so the server can fall back', async () => {
  const { profile } = validateProfile({ currentWeight: 210, goalWeight: 185 });
  const fakeClient = { beta: { messages: { create: async () => ({ stop_reason: 'refusal', content: [] }) } } };
  await assert.rejects(createPlanGenerator({ client: fakeClient })(profile), /declined/);
});

test('coach endpoint answers with or without AI', async () => {
  const ask = (base, body) => fetch(`${base}/api/coach`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  await withServer({}, async (base) => {
    const data = await (await ask(base, { messages: [{ role: 'user', text: 'what to eat?' }] })).json();
    assert.equal(data.source, 'offline');
    assert.match(data.reply, /protein/);
    assert.equal((await ask(base, { messages: [] })).status, 400);
  });
  await withServer({ coachReply: async () => 'AI says hi' }, async (base) => {
    const data = await (await ask(base, { messages: [{ role: 'user', text: 'hey' }] })).json();
    assert.equal(data.reply, 'AI says hi');
  });
});
