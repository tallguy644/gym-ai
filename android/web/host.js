// Runs inside the Android app before app.js. Plans are built on the phone:
// with a Claude API key you get an AI plan, without one a starter plan.
import Anthropic from '@anthropic-ai/sdk';
import { createPlanGenerator, DEFAULT_MODEL } from '../../ai.mjs';
import { planResponse } from '../../plan-service.mjs';

const KEY_STORE = 'gym-ai:apiKey';
const NO_KEY_NOTICE = 'Add your Claude API key under "AI coach settings" to get a plan written by the AI. Until then, here is a starter plan.';

function getKey() { try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; } }
function setKey(value) { try { value ? localStorage.setItem(KEY_STORE, value) : localStorage.removeItem(KEY_STORE); } catch {} }

async function requestPlan(input) {
  const apiKey = getKey();
  const generatePlan = apiKey
    ? createPlanGenerator({ client: new Anthropic({ apiKey, dangerouslyAllowBrowser: true }), model: DEFAULT_MODEL })
    : null;
  return planResponse(input, { generatePlan, noAiNotice: NO_KEY_NOTICE });
}

window.GymAI = { inApp: true, requestPlan };

// Small settings panel above the form for the API key.
function settingsPanel() {
  const panel = document.createElement('details');
  panel.className = 'card settings';
  panel.innerHTML = `
    <summary>AI coach settings</summary>
    <p class="muted">Paste a Claude API key to get plans written by the AI. It is stored only on this phone. Leave it empty to use starter plans, which work offline.</p>
    <label>Claude API key <input id="api-key" type="password" autocomplete="off" placeholder="sk-ant-..."></label>
    <p id="key-status" class="muted" role="status"></p>
    <button type="button" id="save-key">Save key</button>`;
  const input = panel.querySelector('#api-key');
  const status = panel.querySelector('#key-status');
  const show = () => { status.textContent = getKey() ? 'Key saved. Plans will come from the AI coach.' : 'No key saved. You will get starter plans.'; };
  input.value = getKey();
  show();
  panel.querySelector('#save-key').addEventListener('click', () => { setKey(input.value.trim()); show(); });
  return panel;
}

const form = document.getElementById('profile');
form?.before(settingsPanel());
