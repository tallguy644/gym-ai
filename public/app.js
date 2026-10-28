import { videoUrl } from './video.js';

const form = document.getElementById('profile');
const result = document.getElementById('result');
const errorsEl = document.getElementById('errors');
const button = form.querySelector('button');
const STORE_KEY = 'gym-ai:last';

// The Android app sets window.GymAI to build plans on the phone instead of
// calling the server. The web page uses the server.
const host = window.GymAI ?? {};
async function serverPlan(body) {
  const res = await fetch('/api/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
const requestPlan = host.requestPlan ?? serverPlan;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }

function goalLine(a) {
  if (a.goal === 'recomp') return 'You are close to your goal weight, so this plan focuses on building strength and muscle while holding your weight.';
  const verb = a.goal === 'lose' ? 'lose' : 'gain';
  return `Goal: ${verb} ${Math.abs(a.change)} ${a.unit}. A healthy pace is about ${a.weeklyRate} ${a.unit} a week, so plan on roughly ${a.estimatedWeeks} weeks.`;
}

function watchLink(name) {
  const url = videoUrl(name);
  if (!url) return '';
  return `<a class="watch" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Watch how to do ${esc(name)} (opens YouTube)">▶ Watch how</a>`;
}

function render({ plan, analysis, source, notice }) {
  const days = plan.weeklySchedule.map((d) => `
    <article class="card day">
      <h3>${esc(d.day)} <span>${esc(d.focus)}</span></h3>
      <p class="muted"><strong>Warm-up:</strong> ${esc(d.warmup)}</p>
      <div class="table"><table>
        <thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Rest</th></tr></thead>
        <tbody>${d.exercises.map((e) => `
          <tr><td>${esc(e.name)}${e.notes ? `<small>${esc(e.notes)}</small>` : ''}${watchLink(e.name)}</td><td>${esc(e.sets)}</td><td>${esc(e.reps)}</td><td>${esc(e.restSeconds)}s</td></tr>`).join('')}
        </tbody>
      </table></div>
      <p class="muted"><strong>Cardio:</strong> ${esc(d.cardio)}</p>
    </article>`).join('');

  result.innerHTML = `
    ${notice ? `<p class="notice">${esc(notice)}</p>` : ''}
    <div class="card">
      <p class="badge">${source === 'ai' ? 'Built by your AI coach' : 'Starter plan'}</p>
      <h2>${esc(plan.title)}</h2>
      <p>${esc(plan.summary)}</p>
      <p class="goal">${esc(goalLine(analysis))}</p>
    </div>
    ${days}
    <div class="card">
      <h3>How to progress</h3><p>${esc(plan.progression)}</p>
      <h3>Food and recovery</h3><ul>${plan.nutrition.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      <h3>Stay safe</h3><ul>${plan.safety.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    </div>
    ${host.inApp ? '' : '<div class="actions"><button type="button" id="print">Print or save as PDF</button></div>'}`;
  result.hidden = false;
  document.getElementById('print')?.addEventListener('click', () => window.print());
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(form));
  errorsEl.hidden = true;
  button.disabled = true;
  button.textContent = 'Building your plan…';
  try {
    const { status, body: data } = await requestPlan(body);
    if (status !== 200) {
      errorsEl.textContent = (data.errors || ['Something went wrong.']).join(' ');
      errorsEl.hidden = false;
      return;
    }
    store(STORE_KEY, { form: body, data });
    render(data);
    result.scrollIntoView({ behavior: 'smooth' });
  } catch {
    errorsEl.textContent = host.inApp ? 'Something went wrong building your plan. Try again.' : 'Could not reach the server. Check your connection and try again.';
    errorsEl.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'Build my plan';
  }
});

// Bring back the last plan so it is still there after a refresh.
const last = load(STORE_KEY);
if (last?.form && last?.data?.plan) {
  for (const [k, v] of Object.entries(last.form)) if (form.elements[k]) form.elements[k].value = v;
  render(last.data);
}
