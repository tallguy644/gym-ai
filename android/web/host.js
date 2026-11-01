// Runs inside the Android app before app.js. Plans and coach answers are made
// on the phone: with a Claude API key they come from the AI, without one you
// get starter plans and built-in coach answers.
import Anthropic from '@anthropic-ai/sdk';
import { createPlanGenerator, DEFAULT_MODEL } from '../../ai.mjs';
import { coachResponse, createCoachReplier } from '../../coach.mjs';
import { planResponse } from '../../plan-service.mjs';

const KEY_STORE = 'gym-ai:apiKey';
const NO_KEY_NOTICE = 'Add your Claude API key under "AI coach settings" in Profile to get a plan written by the AI. Until then, here is a starter plan.';
const NO_KEY_COACH_NOTICE = 'Built-in answer. Add a Claude API key in Profile for full AI coaching.';

function getKey() { try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; } }
function setKey(value) { try { value ? localStorage.setItem(KEY_STORE, value) : localStorage.removeItem(KEY_STORE); } catch {} }
const client = (apiKey) => new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

async function requestPlan(input) {
  const apiKey = getKey();
  const generatePlan = apiKey ? createPlanGenerator({ client: client(apiKey), model: DEFAULT_MODEL }) : null;
  return planResponse(input, { generatePlan, noAiNotice: NO_KEY_NOTICE });
}

async function requestCoach(input) {
  const apiKey = getKey();
  const reply = apiKey ? createCoachReplier({ client: client(apiKey), model: DEFAULT_MODEL }) : null;
  return coachResponse(input, { reply, noAiNotice: NO_KEY_COACH_NOTICE });
}

window.GymAI = { inApp: true, requestPlan, requestCoach, testNumber: process.env.GYM_AI_TEST };

// Settings panel for the API key, shown on the Profile tab.
function settingsPanel() {
  const panel = document.createElement('details');
  panel.className = 'card settings';
  panel.innerHTML = `
    <summary>AI coach settings</summary>
    <p class="muted">Paste a Claude API key to get plans and coach answers from the AI. It is stored only on this phone. Leave it empty to use starter plans and built-in answers, which work offline.</p>
    <label>Claude API key <input id="api-key" type="password" autocomplete="off" placeholder="sk-ant-..."></label>
    <p id="key-status" class="muted" role="status"></p>
    <button type="button" id="save-key" class="btn">Save key</button>`;
  const input = panel.querySelector('#api-key');
  const status = panel.querySelector('#key-status');
  const show = () => { status.textContent = getKey() ? 'Key saved. Plans and answers will come from the AI coach.' : 'No key saved. You will get starter plans and built-in answers.'; };
  input.value = getKey();
  show();
  panel.querySelector('#save-key').addEventListener('click', () => { setKey(input.value.trim()); show(); });
  return panel;
}

document.getElementById('ai-settings')?.append(settingsPanel());
