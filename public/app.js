import { videoUrl } from './video.js';
import { FACTORS, factorPercent, factorWord, readinessAdvice, readinessLabel, readinessScore } from './readiness.js';
import { swapExercise, swapOptions } from './swaps.js';
import { goalProgress, monthCalendar, weekStreak } from './progress.js';

const $ = (id) => document.getElementById(id);
const form = $('profile');
const errorsEl = $('errors');
const sheet = $('sheet');

const KEYS = {
  last: 'gym-ai:last', name: 'gym-ai:name', checkins: 'gym-ai:checkins', weights: 'gym-ai:weights',
  sessions: 'gym-ai:sessions', chat: 'gym-ai:chat', day: 'gym-ai:day',
};

// The Android app sets window.GymAI to build plans and answer chat on the
// phone instead of calling the server. The web page uses the server.
const host = window.GymAI ?? {};
const postJson = (path) => async (body) => {
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};
const requestPlan = host.requestPlan ?? postJson('/api/plan');
const requestCoach = host.requestCoach ?? postJson('/api/coach');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function load(key, fallback = null) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }

const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return today(d); };
const shortDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' });

const icon = {
  plan: '<svg viewBox="0 0 24 24"><path d="M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
};

/* ---------- Plan state ---------- */

let last = load(KEYS.last);
const plan = () => last?.data?.plan;
const savePlan = () => store(KEYS.last, last);

function dayIndex() {
  const days = plan()?.weeklySchedule ?? [];
  if (!days.length) return 0;
  const saved = load(KEYS.day);
  const i = Number.isInteger(saved) ? saved : load(KEYS.sessions, []).length;
  return ((i % days.length) + days.length) % days.length;
}

function goalLine(a) {
  if (!a) return '';
  if (a.goal === 'recomp') return 'You are close to your goal weight, so the focus is strength and muscle while holding your weight.';
  const verb = a.goal === 'lose' ? 'lose' : 'gain';
  return `Goal: ${verb} ${Math.abs(a.change)} ${a.unit}, about ${a.weeklyRate} ${a.unit} a week, roughly ${a.estimatedWeeks} weeks.`;
}

/* ---------- Workout tab ---------- */

function greeting() {
  const h = new Date().getHours();
  const part = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  const name = load(KEYS.name, '');
  $('greeting').textContent = name ? `Good ${part}, ${name} 👋` : `Good ${part} 👋`;
  $('avatar').textContent = (name || 'G').trim().charAt(0).toUpperCase();
}

function ring(score, label) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const offset = score == null ? c : c * (1 - score / 100);
  return `
    <div class="ring" role="img" aria-label="${score == null ? 'No readiness score yet' : `Readiness score ${score}%, ${label}`}">
      <svg viewBox="0 0 168 168" aria-hidden="true">
        <defs><linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1fb5dc"/><stop offset="1" stop-color="#3ddc84"/></linearGradient></defs>
        <circle class="track" cx="84" cy="84" r="${r}" stroke-width="12"/>
        <circle class="val" cx="84" cy="84" r="${r}" stroke-width="12" stroke-dasharray="${c}" stroke-dashoffset="${offset}"/>
      </svg>
      <div class="ring-label"><small>Readiness score</small><strong>${score == null ? '--' : `${score}%`}</strong><span>${score == null ? 'Check in to see it' : esc(label)}</span></div>
    </div>`;
}

function renderReadiness() {
  const checkins = load(KEYS.checkins, []);
  const todays = checkins.find((c) => c.date === today());
  const week = Array.from({ length: 7 }, (_, i) => checkins.find((c) => c.date === daysAgo(6 - i)));
  const score = todays ? readinessScore(todays) : null;

  const tiles = FACTORS.map((f) => `
    <div class="factor">
      <b>${f.label}${todays ? ` (${factorPercent(f, todays[f.key])}%)` : ''}</b>
      ${todays ? `<em>${esc(factorWord(f, todays[f.key]))}</em>` : '<em class="muted">No check-in</em>'}
      <div class="bars" aria-hidden="true">${week.map((c) => c
        ? `<i style="height:${Math.max(8, factorPercent(f, c[f.key]))}%"></i>`
        : '<i class="none"></i>').join('')}</div>
    </div>`).join('');

  $('readiness').innerHTML = `
    <div class="ring-wrap">${ring(score, score == null ? '' : readinessLabel(score))}</div>
    <div class="factors">${tiles}</div>
    <button type="button" class="btn ${todays ? 'ghost' : ''}" id="checkin-btn">${todays ? 'Update today’s check-in' : 'Daily check-in'}</button>`;
  $('checkin-btn').addEventListener('click', openCheckin);

  $('insight').innerHTML = todays ? `
    <div class="card insight">${icon.spark}<p><b>AI insight:</b> ${esc(readinessAdvice(todays))}</p></div>` : '';
}

function exerciseRow(e, i) {
  const url = videoUrl(e.name);
  return `
    <div class="ex" data-i="${i}">
      <div class="ex-top"><span class="ex-num">${i + 1}</span><span class="ex-name">${esc(e.name)}</span></div>
      <p class="ex-meta">${esc(e.sets)} sets × ${esc(e.reps)} · ${esc(e.restSeconds)}s rest
        ${e.notes ? `<small>${esc(e.notes)}</small>` : ''}${e.swappedFrom ? `<small>Swapped from ${esc(e.swappedFrom)}</small>` : ''}</p>
      <div class="ex-actions">
        <button type="button" class="chip" data-act="swap">Swap Exercise</button>
        <button type="button" class="chip" data-act="adjust" aria-expanded="false">Adjust Sets</button>
        ${url ? `<a class="chip" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Watch how to do ${esc(e.name)} (opens YouTube)">▶ Watch how</a>` : ''}
      </div>
    </div>`;
}

function renderPlan() {
  const area = $('plan-area');
  const p = plan();
  if (!p) {
    area.innerHTML = `
      <div class="card empty">
        <h2>Build your first plan</h2>
        <p class="muted">Add your current and goal weight in Profile and your AI coach will build the week.</p>
        <a class="btn" href="#profile" style="display:block;text-decoration:none">Set up my plan</a>
      </div>`;
    return;
  }
  const days = p.weeklySchedule;
  const di = dayIndex();
  const day = days[di];
  const doneToday = load(KEYS.sessions, []).some((s) => s.date === today());
  const { source, notice, analysis } = last.data;

  area.innerHTML = `
    ${notice ? `<p class="notice">${esc(notice)}</p>` : ''}
    <div class="card">
      <div class="plan-head">
        <span class="ico" aria-hidden="true">${icon.plan}</span>
        <div><small>${source === 'ai' ? 'AI-Powered Plan' : 'Starter Plan'}: ${esc(day.day)}</small><h2>${esc(day.focus)}</h2></div>
      </div>
      <div class="days" role="group" aria-label="Choose a day">${days.map((d, i) =>
        `<button type="button" class="chip ${i === di ? 'on' : ''}" data-day="${i}" aria-pressed="${i === di}">${esc(d.day)}</button>`).join('')}</div>
      <p class="plan-meta"><strong>Warm-up:</strong> ${esc(day.warmup)}</p>
      <div id="exercises">${day.exercises.map(exerciseRow).join('')}</div>
      <p class="plan-meta"><strong>Cardio:</strong> ${esc(day.cardio)}</p>
      <div class="plan-buttons">
        ${doneToday ? '<p class="done-note">✓ Workout logged for today</p>' : '<button type="button" class="btn ghost" id="done-btn">Mark workout done</button>'}
        <button type="button" class="btn" id="regen-btn">Regenerate Plan</button>
      </div>
    </div>
    <details class="card more">
      <summary>Full week and tips</summary>
      <h3>${esc(p.title)}</h3>
      <p class="muted">${esc(p.summary)}</p>
      <p class="goal">${esc(goalLine(analysis))}</p>
      ${days.map((d) => `<h3>${esc(d.day)}: ${esc(d.focus)}</h3><ul>${d.exercises.map((e) => `<li>${esc(e.name)}, ${esc(e.sets)} × ${esc(e.reps)}</li>`).join('')}</ul>`).join('')}
      <h3>How to progress</h3><p class="muted">${esc(p.progression)}</p>
      <h3>Food and recovery</h3><ul>${p.nutrition.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      <h3>Stay safe</h3><ul>${p.safety.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      ${host.inApp ? '' : '<p style="margin-top:14px"><button type="button" class="btn ghost" id="print">Print or save as PDF</button></p>'}
    </details>`;

  area.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => { store(KEYS.day, Number(b.dataset.day)); renderPlan(); }));
  $('done-btn')?.addEventListener('click', markDone);
  $('regen-btn').addEventListener('click', regenerate);
  $('print')?.addEventListener('click', () => window.print());
  $('exercises').addEventListener('click', onExerciseAction);
}

function onExerciseAction(event) {
  const btn = event.target.closest('button[data-act]');
  if (!btn) return;
  const row = btn.closest('.ex');
  const i = Number(row.dataset.i);
  if (btn.dataset.act === 'swap') openSwap(i);
  if (btn.dataset.act === 'adjust') toggleAdjust(row, i, btn);
}

function currentExercise(i) { return plan().weeklySchedule[dayIndex()].exercises[i]; }

function toggleAdjust(row, i, btn) {
  const open = row.querySelector('.adjust');
  if (open) { open.remove(); btn.setAttribute('aria-expanded', 'false'); return; }
  btn.setAttribute('aria-expanded', 'true');
  const e = currentExercise(i);
  const box = document.createElement('div');
  box.className = 'adjust';
  box.innerHTML = `
    <span>Sets</span><span class="stepper"><button type="button" data-d="-1" aria-label="Fewer sets">−</button><output>${esc(e.sets)}</output><button type="button" data-d="1" aria-label="More sets">+</button></span>
    <label for="reps-${i}">Reps</label><input id="reps-${i}" value="${esc(e.reps)}" maxlength="20">
    <span>Rest</span><span class="stepper"><button type="button" data-r="-15" aria-label="Less rest">−</button><output>${esc(e.restSeconds)}s</output><button type="button" data-r="15" aria-label="More rest">+</button></span>`;
  const refresh = () => {
    const [sets, rest] = box.querySelectorAll('output');
    sets.textContent = e.sets;
    rest.textContent = `${e.restSeconds}s`;
    row.querySelector('.ex-meta').firstChild.textContent = `${e.sets} sets × ${e.reps} · ${e.restSeconds}s rest\n        `;
    savePlan();
  };
  box.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.d) e.sets = Math.min(10, Math.max(1, Number(e.sets) + Number(b.dataset.d)));
    if (b.dataset.r) e.restSeconds = Math.min(300, Math.max(15, Number(e.restSeconds) + Number(b.dataset.r)));
    refresh();
  });
  box.querySelector('input').addEventListener('input', (ev) => { e.reps = ev.target.value.trim() || e.reps; refresh(); });
  row.append(box);
}

function openSwap(i) {
  const e = currentExercise(i);
  const options = swapOptions(e.name, last.form?.equipment);
  sheet.innerHTML = `
    <h2>Swap ${esc(e.name)}</h2>
    <p class="muted">${options.length ? 'Pick a replacement. Sets, reps and rest stay the same.' : 'No quick swaps for this one. Ask your coach for ideas.'}</p>
    <div class="opts">${options.map((o) => `<button type="button" class="chip" data-name="${esc(o)}">${esc(o)}</button>`).join('')}</div>
    <div class="plan-buttons">
      <button type="button" class="btn ghost" id="ask-swap">Ask the coach instead</button>
      <button type="button" class="btn ghost" id="close-sheet">Cancel</button>
    </div>`;
  sheet.querySelectorAll('[data-name]').forEach((b) => b.addEventListener('click', () => {
    plan().weeklySchedule[dayIndex()].exercises[i] = swapExercise(e, b.dataset.name);
    savePlan();
    sheet.close();
    renderPlan();
  }));
  $('ask-swap').addEventListener('click', () => {
    sheet.close();
    location.hash = '#coach';
    $('chat-text').value = `What machine exercise can I do instead of ${e.name}?`;
    $('chat-text').focus();
  });
  $('close-sheet').addEventListener('click', () => sheet.close());
  sheet.showModal();
}

function openCheckin() {
  const existing = load(KEYS.checkins, []).find((c) => c.date === today()) ?? {};
  sheet.innerHTML = `
    <h2>Daily check-in</h2>
    <p class="muted">Rate how you feel today. Your readiness score comes from these.</p>
    ${FACTORS.map((f) => `
      <div class="slider">
        <div><label for="f-${f.key}">${f.label}</label><b id="w-${f.key}"></b></div>
        <input type="range" id="f-${f.key}" min="1" max="5" step="1" value="${existing[f.key] ?? 3}">
      </div>`).join('')}
    <div class="plan-buttons">
      <button type="button" class="btn" id="save-checkin">Save check-in</button>
      <button type="button" class="btn ghost" id="close-sheet">Cancel</button>
    </div>`;
  for (const f of FACTORS) {
    const input = $(`f-${f.key}`);
    const show = () => { $(`w-${f.key}`).textContent = factorWord(f, input.value); };
    input.addEventListener('input', show);
    show();
  }
  $('save-checkin').addEventListener('click', () => {
    const entry = { date: today() };
    for (const f of FACTORS) entry[f.key] = Number($(`f-${f.key}`).value);
    const all = load(KEYS.checkins, []).filter((c) => c.date !== entry.date);
    store(KEYS.checkins, [...all, entry].slice(-60));
    sheet.close();
    renderReadiness();
  });
  $('close-sheet').addEventListener('click', () => sheet.close());
  sheet.showModal();
}

function markDone() {
  const day = plan().weeklySchedule[dayIndex()];
  const sessions = load(KEYS.sessions, []);
  store(KEYS.sessions, [...sessions, { date: today(), day: day.day, focus: day.focus }].slice(-200));
  store(KEYS.day, dayIndex() + 1);
  renderPlan();
}

async function regenerate() {
  const btn = $('regen-btn');
  btn.disabled = true;
  btn.textContent = 'Regenerating…';
  try {
    const { status, body } = await requestPlan(last.form);
    if (status !== 200) throw new Error((body.errors || []).join(' '));
    last = { form: last.form, data: body };
    savePlan();
  } catch {
    alert('Could not regenerate your plan. Try again in a moment.');
  }
  renderPlan();
}

/* ---------- Coach tab ---------- */

const SUGGESTIONS = ['What’s the best way to improve my squat depth?', 'What should I eat after training?', 'I’m sore today. What should I change?'];
let sending = false;

function coachContext() {
  const lines = [];
  const name = load(KEYS.name, '');
  if (name) lines.push(`Name: ${name}`);
  if (last?.form) {
    const f = last.form;
    lines.push(`Weight ${f.currentWeight} ${f.unit}, goal ${f.goalWeight} ${f.unit}. ${goalLine(last.data?.analysis)}`);
    lines.push(`Experience: ${f.experience}. Equipment: ${String(f.equipment).replace('_', ' ')}. ${f.daysPerWeek} days a week, ${f.sessionMinutes} min sessions.`);
    if (f.notes) lines.push(`Their notes: ${f.notes}`);
  }
  const p = plan();
  if (p) {
    const d = p.weeklySchedule[dayIndex()];
    lines.push(`Today's workout (${d.focus}): ${d.exercises.map((e) => `${e.name} ${e.sets}x${e.reps}`).join(', ')}.`);
  }
  const c = load(KEYS.checkins, []).find((x) => x.date === today());
  if (c) lines.push(`Today's readiness: ${readinessScore(c)}% (${FACTORS.map((f) => `${f.label.toLowerCase()} ${factorWord(f, c[f.key]).toLowerCase()}`).join(', ')}).`);
  return lines.join('\n');
}

function bubble(m) {
  return `<div class="msg ${m.role}">${esc(m.text)}${m.video
    ? `<br><a class="chip" href="${esc(m.video.url)}" target="_blank" rel="noopener noreferrer">▶ ${esc(m.video.label)}</a>` : ''}${m.note
    ? `<span class="note">${esc(m.note)}</span>` : ''}</div>`;
}

function renderChat() {
  const chat = load(KEYS.chat, []);
  const name = load(KEYS.name, '');
  const hello = { role: 'coach', text: `Hi${name ? ` ${name}` : ''}! I’m your AI coach. Ask me about form, your plan, recovery or food.` };
  $('chat').innerHTML = [hello, ...chat].map(bubble).join('') + (sending ? '<div class="msg coach typing">Thinking…</div>' : '')
    + (chat.length ? '' : `<div class="suggest">${SUGGESTIONS.map((s) => `<button type="button" class="chip" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>`);
  $('chat').querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => send(b.dataset.q)));
  if (location.hash === '#coach') window.scrollTo({ top: document.body.scrollHeight });
}

async function send(text) {
  text = text.trim();
  if (!text || sending) return;
  const chat = [...load(KEYS.chat, []), { role: 'user', text }];
  store(KEYS.chat, chat);
  sending = true;
  renderChat();
  let reply;
  try {
    const { status, body } = await requestCoach({ messages: chat.map(({ role, text: t }) => ({ role, text: t })), context: coachContext() });
    reply = status === 200
      ? { role: 'coach', text: body.reply, note: body.notice, video: body.video ?? undefined }
      : { role: 'coach', text: (body.errors || ['Something went wrong.']).join(' ') };
  } catch {
    reply = { role: 'coach', text: host.inApp ? 'Something went wrong. Try again.' : 'Could not reach the server. Check your connection and try again.' };
  }
  sending = false;
  store(KEYS.chat, [...chat, reply].slice(-50));
  renderChat();
}

$('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('chat-text');
  send(input.value);
  input.value = '';
});
$('clear-chat').addEventListener('click', () => { store(KEYS.chat, []); renderChat(); });

/* ---------- Analytics tab ---------- */

function weightChart(points, goal) {
  if (points.length < 2) return '<p class="muted">Log your weight a few times to see your trend.</p>';
  const W = 320; const H = 150; const pad = 22;
  const values = [...points.map((p) => p.weight), goal].filter((v) => Number.isFinite(v));
  let lo = Math.min(...values); let hi = Math.max(...values);
  if (hi - lo < 2) { lo -= 1; hi += 1; }
  const x = (i) => pad + (i * (W - pad * 2)) / (points.length - 1);
  const y = (v) => pad / 2 + ((hi - v) * (H - pad * 1.5)) / (hi - lo);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.weight).toFixed(1)}`).join('');
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight from ${points[0].weight} to ${points.at(-1).weight}">
      <defs><linearGradient id="line-grad" x1="0" x2="1"><stop offset="0" stop-color="#1fb5dc"/><stop offset="1" stop-color="#3ddc84"/></linearGradient></defs>
      ${Number.isFinite(goal) ? `<line class="goal-line" x1="${pad}" x2="${W - pad}" y1="${y(goal)}" y2="${y(goal)}"/><text x="${W - pad}" y="${y(goal) - 4}" text-anchor="end">Goal ${goal}</text>` : ''}
      <path class="line" d="${path}"/>
      ${points.map((p, i) => `<circle class="dot" cx="${x(i)}" cy="${y(p.weight)}" r="3"/>`).join('')}
      <text x="${pad}" y="${H - 2}">${esc(points[0].date.slice(5))}</text>
      <text x="${W - pad}" y="${H - 2}" text-anchor="end">${esc(points.at(-1).date.slice(5))}</text>
    </svg>`;
}

function goalRing(pct, line) {
  const r = 70;
  const c = 2 * Math.PI * r;
  return `
    <div class="ring" role="img" aria-label="${pct}% of the way to your goal">
      <svg viewBox="0 0 168 168" aria-hidden="true">
        <defs><linearGradient id="goal-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1fb5dc"/><stop offset="1" stop-color="#3ddc84"/></linearGradient></defs>
        <circle class="track" cx="84" cy="84" r="${r}" stroke-width="12"/>
        <circle cx="84" cy="84" r="${r}" stroke-width="12" stroke="url(#goal-grad)" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"/>
      </svg>
      <div class="ring-label"><small>Goal progress</small><strong>${pct}%</strong><span class="muted">${esc(line)}</span></div>
    </div>`;
}

function renderAnalytics() {
  const f = last?.form;
  const unit = f?.unit ?? 'lb';
  const goal = f ? Number(f.goalWeight) : NaN;
  const weights = load(KEYS.weights, []).slice(-30);
  const latest = weights.at(-1)?.weight;
  const start = weights[0]?.weight ?? (f ? Number(f.currentWeight) : undefined);
  const toGo = Number.isFinite(goal) && latest != null ? Math.round(Math.abs(latest - goal) * 10) / 10 : null;
  const progress = goalProgress(start, latest ?? start, goal);
  const rate = last?.data?.analysis?.weeklyRate;
  const weeksLeft = progress && rate > 0 ? Math.ceil(progress.remaining / rate) : null;

  const checkins = load(KEYS.checkins, []);
  const week = Array.from({ length: 7 }, (_, i) => { const date = daysAgo(6 - i); return { date, c: checkins.find((x) => x.date === date) }; });
  const weekScores = week.filter((w) => w.c).map((w) => readinessScore(w.c));
  const avgReadiness = weekScores.length ? Math.round(weekScores.reduce((a, b) => a + b, 0) / weekScores.length) : null;
  const sessions = load(KEYS.sessions, []);
  const dates = sessions.map((s) => s.date);
  const weekCount = sessions.filter((s) => s.date >= daysAgo(6)).length;
  const target = Number(f?.daysPerWeek) || 3;
  const streak = weekStreak(dates, today());
  const month = new Date().toLocaleDateString(undefined, { month: 'long' });
  const cells = monthCalendar(today(), dates);

  $('analytics').innerHTML = `
    ${progress ? `
    <div class="card goal-card">
      <div class="ring-wrap">${goalRing(progress.pct, progress.total ? `${progress.done} of ${progress.total} ${unit}` : 'Holding steady')}</div>
      <p>${progress.remaining <= 0 ? '<b class="ok">Goal reached!</b>' : `<b class="ok">${progress.remaining} ${unit} to go</b>${weeksLeft ? `<span class="muted"> · about ${weeksLeft} weeks at a safe pace</span>` : ''}`}</p>
    </div>` : ''}
    <div class="card">
      <h2>Weight</h2>
      <div class="stat-row">
        <div class="stat"><small>Start</small><b>${start ?? '--'}</b></div>
        <div class="stat"><small>Latest</small><b>${latest ?? '--'}</b></div>
        <div class="stat"><small>To goal</small><b>${toGo ?? '--'}${toGo != null ? ` ${unit}` : ''}</b></div>
      </div>
      ${weightChart(weights, goal)}
      <form class="log-row" id="weight-form" style="margin-top:12px">
        <label class="sr-only" for="weight-in">Today’s weight in ${unit}</label>
        <input id="weight-in" type="number" inputmode="decimal" step="0.1" placeholder="Today’s weight (${unit})" required>
        <button class="btn" type="submit">Log</button>
      </form>
    </div>
    <div class="card">
      <div class="cal-head"><h2>${esc(month)} workouts</h2>${streak ? `<span class="streak">🔥 ${streak}-week streak</span>` : ''}</div>
      <div class="cal" role="img" aria-label="${dates.filter((d) => d.startsWith(today().slice(0, 7))).length} workouts this month">
        ${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<small>${d}</small>`).join('')}
        ${cells.map((c) => (c ? `<i class="${c.done ? 'done' : ''}${c.date === today() ? ' today' : ''}${c.future ? ' future' : ''}">${c.day}</i>` : '<i class="pad"></i>')).join('')}
      </div>
      <div class="stat-row">
        <div class="stat"><small>Last 7 days</small><b>${weekCount} / ${target}</b></div>
        <div class="stat"><small>Avg readiness</small><b>${avgReadiness != null ? `${avgReadiness}%` : '--'}</b></div>
        <div class="stat"><small>All time</small><b>${sessions.length}</b></div>
      </div>
      ${sessions.length ? '' : '<p class="muted">Tap “Mark workout done” on the Workout tab after each session.</p>'}
    </div>
    <div class="card">
      <h2>Readiness, last 7 days</h2>
      <div class="week-bars">${week.map(({ date, c }) => {
        const s = c ? readinessScore(c) : 0;
        return `<div>${c ? s : ''}<i class="${c ? '' : 'none'}" style="height:${c ? Math.max(6, s) : 6}%"></i>${shortDay(date)}</div>`;
      }).join('')}</div>
    </div>`;

  $('weight-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const w = Number($('weight-in').value);
    if (!(w > 0 && w < 1000)) return;
    logWeight(w);
    renderAnalytics();
  });
}

function logWeight(weight) {
  const all = load(KEYS.weights, []).filter((x) => x.date !== today());
  store(KEYS.weights, [...all, { date: today(), weight }].slice(-365));
}

/* ---------- Profile tab ---------- */

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const { name, ...body } = Object.fromEntries(new FormData(form));
  store(KEYS.name, name.trim());
  const button = form.querySelector('button[type=submit]');
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
    last = { form: body, data };
    savePlan();
    store(KEYS.day, 0);
    if (!load(KEYS.weights, []).some((w) => w.date === today())) logWeight(Number(body.currentWeight));
    location.hash = '#workout';
  } catch {
    errorsEl.textContent = host.inApp ? 'Something went wrong building your plan. Try again.' : 'Could not reach the server. Check your connection and try again.';
    errorsEl.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'Build my plan';
  }
});

function fillProfile() {
  if (host.testNumber) $('build-info').textContent = `Test ${host.testNumber}`;
  if (last?.form) for (const [k, v] of Object.entries(last.form)) if (form.elements[k]) form.elements[k].value = v;
  form.elements.name.value = load(KEYS.name, '');
}

/* ---------- Tabs ---------- */

const TABS = ['workout', 'coach', 'analytics', 'profile'];
function show() {
  const tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'workout';
  for (const t of TABS) $(`view-${t}`).hidden = t !== tab;
  document.querySelectorAll('.tabs a').forEach((a) => (a.dataset.tab === tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  if (tab === 'workout') { greeting(); renderReadiness(); renderPlan(); }
  if (tab === 'coach') renderChat();
  if (tab === 'analytics') renderAnalytics();
  if (tab === 'profile') fillProfile();
  window.scrollTo({ top: tab === 'coach' ? document.body.scrollHeight : 0 });
}
$('avatar').addEventListener('click', () => { location.hash = '#profile'; });
window.addEventListener('hashchange', show);
show();
