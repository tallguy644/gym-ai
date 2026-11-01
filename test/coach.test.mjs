import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanChat, coachResponse, createCoachReplier, offlineReply, toClaudeMessages, videoFor } from '../coach.mjs';

const quiet = { error() {} };

test('rejects a chat that does not end with a question', async () => {
  assert.equal(cleanChat({}).ok, false);
  assert.equal(cleanChat({ messages: [{ role: 'coach', text: 'hi' }] }).ok, false);
  const { status } = await coachResponse({ messages: [{ role: 'user', text: '   ' }] });
  assert.equal(status, 400);
});

test('trims long chats and messages', () => {
  const messages = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'coach' : 'user', text: 'x'.repeat(5000) }));
  messages.push({ role: 'user', text: 'last' });
  const chat = cleanChat({ messages, context: 'c'.repeat(9000) });
  assert.equal(chat.messages.length, 12);
  assert.ok(chat.messages.every((m) => m.text.length <= 1000));
  assert.equal(chat.context.length, 2000);
});

test('Claude messages start with the user and alternate', () => {
  const out = toClaudeMessages([{ role: 'coach', text: 'a' }, { role: 'user', text: 'b' }, { role: 'user', text: 'c' }, { role: 'coach', text: 'd' }, { role: 'user', text: 'e' }]);
  assert.deepEqual(out.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.equal(out[0].content, 'b\n\nc');
});

test('built-in answers cover common questions', () => {
  assert.match(offlineReply('How do I get more squat depth?'), /hip crease/);
  assert.match(offlineReply('what should I eat after?'), /protein/);
  assert.match(offlineReply('my knee hurts'), /sharp pain/);
  assert.match(offlineReply('so sore today'), /lighter/);
  assert.match(offlineReply('hello'), /form, your plan/);
});

test('links a demo video when a lift is named', () => {
  assert.match(videoFor('fix my Squat please').url, /youtube\.com/);
  assert.equal(videoFor('hello'), null);
});

test('uses the AI reply and falls back when it fails', async () => {
  const input = { messages: [{ role: 'user', text: 'Tips for leg press?' }], context: 'Name: Alex' };
  let seen;
  const ok = await coachResponse(input, { reply: async (chat) => { seen = chat; return 'Push through your heels.'; } });
  assert.equal(ok.body.source, 'ai');
  assert.equal(ok.body.reply, 'Push through your heels.');
  assert.equal(seen.context, 'Name: Alex');
  assert.match(ok.body.video.url, /leg%20press/);

  const failed = await coachResponse(input, { reply: async () => { throw new Error('down'); }, log: quiet });
  assert.equal(failed.body.source, 'offline');
  assert.ok(failed.body.notice);

  const none = await coachResponse(input, { noAiNotice: 'no key' });
  assert.equal(none.body.notice, 'no key');
});

test('coach replier sends a fallback-enabled request with context', async () => {
  let req;
  const client = { beta: { messages: { create: async (r) => { req = r; return { stop_reason: 'end_turn', content: [{ type: 'text', text: ' Hi! ' }] }; } } } };
  const reply = createCoachReplier({ client, model: 'm' });
  assert.equal(await reply({ messages: [{ role: 'user', text: 'q' }], context: 'ctx' }), 'Hi!');
  assert.equal(req.model, 'm');
  assert.equal(req.fallbacks, 'default');
  assert.match(req.system, /ctx/);
  assert.match(req.system, /machines/);
  assert.deepEqual(req.messages, [{ role: 'user', content: 'q' }]);
});
