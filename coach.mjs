// The AI coach chat. Shared by the web server and the Android app.
// With a Claude API key the coach is Claude; without one it gives short
// built-in answers for common questions.
import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_MODEL } from './ai.mjs';
import { videoUrl } from './public/video.js';

export const NO_AI_COACH_NOTICE = 'Built-in answer. Set up a Claude API key for full AI coaching.';
export const AI_FAILED_COACH_NOTICE = 'The AI coach is unavailable right now, so here is a built-in answer.';

const MAX_MESSAGES = 12;
const MAX_TEXT = 1000;
const MAX_CONTEXT = 2000;

const SYSTEM = `You are Gym AI, a friendly strength coach inside a workout app. You help with exercise form, workout plans, recovery and gym nutrition.
Rules:
- Answer in 2-5 short sentences of plain language. No headings or tables.
- Prefer machines and cables over free weights when suggesting exercises, unless the person only has dumbbells or no equipment.
- Do not diagnose injuries or medical problems. For sharp or lasting pain, say to stop and see a doctor or physio.
- Use the app context about the person when it helps, but do not repeat it back.`;

// Validates the chat. Returns { ok, messages, context } or { ok: false, errors }.
export function cleanChat(input = {}) {
  const raw = Array.isArray(input.messages) ? input.messages : [];
  const messages = raw
    .filter((m) => m && (m.role === 'user' || m.role === 'coach') && typeof m.text === 'string' && m.text.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, text: m.text.trim().slice(0, MAX_TEXT) }));
  if (messages.at(-1)?.role !== 'user') return { ok: false, errors: ['Type a question for your coach.'] };
  const context = typeof input.context === 'string' ? input.context.trim().slice(0, MAX_CONTEXT) : '';
  return { ok: true, messages, context };
}

// Claude needs turns that start with the user and alternate.
export function toClaudeMessages(messages) {
  const out = [];
  for (const m of messages) {
    const role = m.role === 'user' ? 'user' : 'assistant';
    if (!out.length && role !== 'user') continue;
    if (out.at(-1)?.role === role) out.at(-1).content += `\n\n${m.text}`;
    else out.push({ role, content: m.text });
  }
  return out;
}

const LIFTS = ['squat', 'deadlift', 'bench press', 'leg press', 'lat pulldown', 'row', 'shoulder press', 'chest press', 'lunge', 'push-up', 'pull-up', 'hip thrust', 'plank', 'leg curl', 'leg extension'];

// If the question names a lift, link a demo video for it.
export function videoFor(question) {
  const lower = String(question ?? '').toLowerCase();
  const lift = LIFTS.find((l) => lower.includes(l));
  return lift ? { label: `Watch how: ${lift}`, url: videoUrl(lift) } : null;
}

export function offlineReply(question) {
  const q = String(question ?? '').toLowerCase();
  if (/pain|hurt|injur|tweak|strain/.test(q)) {
    return 'Stop any exercise that causes sharp pain. Use Swap Exercise to pick a pain-free machine option, keep the weight light, and see a doctor or physio if it lasts more than a few days.';
  }
  if (/squat/.test(q) && /depth|deep|low|parallel/.test(q)) {
    return 'Sit your hips back and down until your hip crease is just below your knees, with heels flat and knees tracking over your toes. If you cannot reach depth, widen your stance a little or start on the leg press or a Smith machine while you build mobility.';
  }
  if (/protein|eat|food|meal|diet|nutrition|calorie|shake|carb/.test(q)) {
    return 'After training, have protein plus some carbs, like a protein shake and a banana, or chicken and rice. Across the day aim for about 0.7-1 g of protein per lb of goal body weight (1.6-2.2 g per kg).';
  }
  if (/sore|tired|fatigue|sleep|rest day|recover|exhaust/.test(q)) {
    return 'When you are sore or short on sleep, train lighter: drop one set per exercise, stop 2-3 reps short of failure, and add an easy walk. Machines are a good choice on those days because they need less balance and focus.';
  }
  if (/form|technique|how (do|to|should)|cue|grip|stance/.test(q)) {
    return 'Use a weight you can control on every rep, move slowly on the way down, and keep a neutral spine. Machines guide the path for you, so they are a good place to learn. Tap Watch how on any exercise for a demo.';
  }
  if (/lose|fat|cut|gain|bulk|muscle|weight/.test(q)) {
    return 'Steady beats fast: add a little weight or a rep each week, and eat slightly under maintenance to lose fat or slightly over to gain muscle. Your plan already sets a safe weekly pace.';
  }
  return 'I can help with form, your plan, recovery and food. Try asking how to do an exercise, what to eat after training, or what to change when you are sore.';
}

export function createCoachReplier({ client, model = process.env.CLAUDE_MODEL || DEFAULT_MODEL } = {}) {
  const anthropic = client ?? new Anthropic();
  return async function reply({ messages, context }) {
    // Beta endpoint so a refused request falls back to another model automatically.
    const response = await anthropic.beta.messages.create({
      model,
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: context ? `${SYSTEM}\n\nApp context about the person:\n${context}` : SYSTEM,
      messages: toClaudeMessages(messages),
    });
    if (response.stop_reason === 'refusal') throw new Error('The AI declined to answer.');
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (!text) throw new Error('The AI returned no answer.');
    return text;
  };
}

// Returns { status, body }. reply is optional; without it you get a built-in answer.
export async function coachResponse(input, { reply, log = console, noAiNotice = NO_AI_COACH_NOTICE } = {}) {
  const chat = cleanChat(input);
  if (!chat.ok) return { status: 400, body: { errors: chat.errors } };
  const question = chat.messages.at(-1).text;
  const video = videoFor(question);
  if (reply) {
    try {
      return { status: 200, body: { source: 'ai', reply: await reply(chat), video } };
    } catch (err) {
      log.error('AI coach failed, using built-in answer:', err?.message ?? err);
      return { status: 200, body: { source: 'offline', notice: AI_FAILED_COACH_NOTICE, reply: offlineReply(question), video } };
    }
  }
  return { status: 200, body: { source: 'offline', notice: noAiNotice, reply: offlineReply(question), video } };
}
