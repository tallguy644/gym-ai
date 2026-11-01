// Runs inside the Android app before app.js. Plans and coach answers come from
// the Gym AI server, which holds the Claude API key, so nobody has to enter a
// key in the app. If the server can't be reached you get a starter plan and
// built-in coach answers made on the phone. A personal key (optional) makes the
// app call Claude directly instead.
import Anthropic from '@anthropic-ai/sdk';
import { createPlanGenerator, DEFAULT_MODEL } from '../../ai.mjs';
import { coachResponse, createCoachReplier } from '../../coach.mjs';
import { planResponse } from '../../plan-service.mjs';

const KEY_STORE = 'gym-ai:apiKey';
const SERVER_STORE = 'gym-ai:server';
// Set at build time from the GYM_AI_SERVER_URL repository variable.
const DEFAULT_SERVER = process.env.GYM_AI_SERVER || '';
// Free hosts can take up to a minute to wake up, and plans take a while to write.
const TIMEOUT_MS = 180_000;

const OFFLINE_NOTICE = 'Could not reach the AI coach, so here is a starter plan. Check your internet and try Regenerate Plan.';
const OFFLINE_COACH_NOTICE = 'Could not reach the AI coach, so here is a built-in answer.';
const NO_SERVER_NOTICE = 'The AI coach is not set up in this build yet, so here is a starter plan.';
const NO_SERVER_COACH_NOTICE = 'Built-in answer. The AI coach is not set up in this build yet.';

function read(k) { try { return localStorage.getItem(k) || ''; } catch { return ''; } }
function write(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} }
const getKey = () => read(KEY_STORE);
const serverUrl = () => (read(SERVER_STORE) || DEFAULT_SERVER).replace(/\/+$/, '');
const client = (apiKey) => new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

async function callServer(path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${serverUrl()}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (res.status >= 500) throw new Error(`server ${res.status}`);
    return { status: res.status, body: await res.json() };
  } finally {
    clearTimeout(timer);
  }
}

async function requestPlan(input) {
  const apiKey = getKey();
  if (apiKey) return planResponse(input, { generatePlan: createPlanGenerator({ client: client(apiKey), model: DEFAULT_MODEL }) });
  if (serverUrl()) {
    try { return await callServer('/api/plan', input); } catch { return planResponse(input, { noAiNotice: OFFLINE_NOTICE }); }
  }
  return planResponse(input, { noAiNotice: NO_SERVER_NOTICE });
}

async function requestCoach(input) {
  const apiKey = getKey();
  if (apiKey) return coachResponse(input, { reply: createCoachReplier({ client: client(apiKey), model: DEFAULT_MODEL }) });
  if (serverUrl()) {
    try { return await callServer('/api/coach', input); } catch { return coachResponse(input, { noAiNotice: OFFLINE_COACH_NOTICE }); }
  }
  return coachResponse(input, { noAiNotice: NO_SERVER_COACH_NOTICE });
}

// Free hosts sleep when idle. Ping on launch so the server is awake by the
// time you ask for a plan.
function wakeServer() {
  if (!serverUrl() || getKey()) return;
  fetch(`${serverUrl()}/api/health`).catch(() => {});
}

window.GymAI = { inApp: true, requestPlan, requestCoach, testNumber: process.env.GYM_AI_TEST };
wakeServer();

// Settings panel on the Profile tab. Nothing here is needed for AI plans; it
// only lets you point at another server or use your own key.
function settingsPanel() {
  const panel = document.createElement('details');
  panel.className = 'card settings';
  panel.innerHTML = `
    <summary>AI coach settings</summary>
    <p id="ai-status" class="muted" role="status"></p>
    <label>AI server address <input id="server-url" type="url" autocomplete="off" inputmode="url"></label>
    <label>Your own Claude API key (optional) <input id="api-key" type="password" autocomplete="off" placeholder="Leave empty to use the AI server"></label>
    <button type="button" id="save-ai" class="btn">Save</button>`;
  const urlInput = panel.querySelector('#server-url');
  const keyInput = panel.querySelector('#api-key');
  const status = panel.querySelector('#ai-status');
  urlInput.placeholder = DEFAULT_SERVER || 'https://your-server.onrender.com';
  const show = () => {
    urlInput.value = read(SERVER_STORE);
    keyInput.value = getKey();
    status.textContent = getKey()
      ? 'Using your own key. Plans and answers come straight from Claude.'
      : serverUrl()
        ? 'AI coach is on. Plans and answers come from the Gym AI server, no key needed.'
        : 'No AI server set. You will get starter plans and built-in answers.';
  };
  show();
  panel.querySelector('#save-ai').addEventListener('click', () => {
    write(SERVER_STORE, urlInput.value.trim());
    write(KEY_STORE, keyInput.value.trim());
    show();
    wakeServer();
  });
  return panel;
}

document.getElementById('ai-settings')?.append(settingsPanel());
