// Runs inside the Android app before app.js. Plans and coach answers come from
// the Gym AI server on Render, which holds the Claude API key, so the app never
// asks for one. If the server can't be reached you get a starter plan and
// built-in coach answers made on the phone.
import { coachResponse } from '../../coach.mjs';
import { planResponse } from '../../plan-service.mjs';

const SERVER_STORE = 'gym-ai:server';
// Set at build time from the GYM_AI_SERVER_URL repository variable.
const DEFAULT_SERVER = process.env.GYM_AI_SERVER || '';
// Free hosts can take up to a minute to wake up, and plans take a while to write.
const TIMEOUT_MS = 180_000;

const OFFLINE_NOTICE = 'Could not reach the AI coach, so here is a starter plan. Check your internet and try Regenerate Plan.';
const OFFLINE_COACH_NOTICE = 'Could not reach the AI coach, so here is a built-in answer.';

function read(k) { try { return localStorage.getItem(k) || ''; } catch { return ''; } }
function write(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} }
// Older builds could save a personal API key on the phone. Forget it.
write('gym-ai:apiKey', '');
const serverUrl = () => (read(SERVER_STORE) || DEFAULT_SERVER).replace(/\/+$/, '');

async function callServer(path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${serverUrl()}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    if (res.status >= 500) throw new Error(`server ${res.status}`);
    return { status: res.status, body: await res.json() };
  } finally {
    clearTimeout(timer);
  }
}

async function requestPlan(input) {
  try { return await callServer('/api/plan', input); } catch { return planResponse(input, { noAiNotice: OFFLINE_NOTICE }); }
}

async function requestCoach(input) {
  try { return await callServer('/api/coach', input); } catch { return coachResponse(input, { noAiNotice: OFFLINE_COACH_NOTICE }); }
}

// Free hosts sleep when idle. Asking for /api/health on launch wakes the
// server, and its answer says whether the AI is set up there.
let health = null;
function checkServer() {
  health = callServer('/api/health')
    .then(({ body }) => (body?.ai ? 'on' : 'no-key'))
    .catch(() => 'offline');
  return health;
}

window.GymAI = { inApp: true, requestPlan, requestCoach, testNumber: process.env.GYM_AI_TEST };
checkServer();

const STATUS = {
  checking: 'Connecting to the AI coach...',
  on: 'AI coach is on. Plans and answers come from the Gym AI server.',
  'no-key': 'The Gym AI server is up, but its Claude key is not set yet. Add ANTHROPIC_API_KEY in Render. Until then you get starter plans.',
  offline: 'Could not reach the Gym AI server. You get starter plans and built-in answers until it is back.',
};

// AI coach status on the Profile tab. The server address only needs changing
// if the server moves.
function settingsPanel() {
  const panel = document.createElement('details');
  panel.className = 'card settings';
  panel.innerHTML = `
    <summary>AI coach</summary>
    <p id="ai-status" class="muted" role="status"></p>
    <label>Server address <input id="server-url" type="url" autocomplete="off" inputmode="url"></label>
    <button type="button" id="save-ai" class="btn">Save and check</button>`;
  const urlInput = panel.querySelector('#server-url');
  const status = panel.querySelector('#ai-status');
  urlInput.placeholder = DEFAULT_SERVER;
  urlInput.value = read(SERVER_STORE);
  const show = async () => {
    status.textContent = STATUS.checking;
    status.textContent = STATUS[await health];
  };
  show();
  panel.querySelector('#save-ai').addEventListener('click', () => {
    write(SERVER_STORE, urlInput.value.trim());
    checkServer();
    show();
  });
  return panel;
}

document.getElementById('ai-settings')?.append(settingsPanel());
