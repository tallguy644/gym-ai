import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planResponse } from './plan-service.mjs';
import { createPlanGenerator } from './ai.mjs';
import { coachResponse, createCoachReplier } from './coach.mjs';

const PUBLIC_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

// The Android app loads its page from this origin and calls the server's API.
export const APP_ORIGIN = 'https://appassets.androidplatform.net';
const CORS = {
  'access-control-allow-origin': APP_ORIGIN,
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
  vary: 'origin',
};

export const LIMIT_NOTICE = 'You have used a lot of AI requests this hour, so here is a starter plan. Try again later.';
export const LIMIT_COACH_NOTICE = 'You have asked a lot of questions this hour, so here is a built-in answer. Try again later.';

// Counts AI requests per caller per hour, so a shared server key can't be run up.
export function createRateLimiter({ limit, windowMs = 60 * 60 * 1000, now = Date.now } = {}) {
  const hits = new Map();
  return function allow(id) {
    if (!limit) return true;
    const t = now();
    const recent = (hits.get(id) ?? []).filter((at) => t - at < windowMs);
    const ok = recent.length < limit;
    if (ok) recent.push(t);
    hits.set(id, recent);
    if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some((at) => t - at < windowMs)) hits.delete(k);
    return ok;
  };
}

// Render and most hosts put the caller's address first in x-forwarded-for.
const callerId = (req) => String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', ...CORS });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

async function readJson(req, limit = 10_000) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > limit) throw new Error('too_large');
  }
  return raw ? JSON.parse(raw) : {};
}

// generatePlan and coachReply are injectable so tests can run without calling the real API.
// planLimit and coachLimit are AI requests allowed per caller per hour (0 = no limit).
export function createServer({ generatePlan, coachReply, log = console, planLimit = 0, coachLimit = 0 } = {}) {
  const allowPlan = createRateLimiter({ limit: planLimit });
  const allowCoach = createRateLimiter({ limit: coachLimit });
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
        res.writeHead(204, CORS);
        return res.end();
      }

      if (req.method === 'POST' && url.pathname === '/api/plan') {
        let body;
        try { body = await readJson(req); } catch { return send(res, 400, { errors: ['Invalid request.'] }); }
        const useAi = generatePlan && allowPlan(callerId(req));
        const { status, body: out } = await planResponse(body, useAi
          ? { generatePlan, log }
          : { generatePlan: null, log, ...(generatePlan && { noAiNotice: LIMIT_NOTICE }) });
        return send(res, status, out);
      }

      if (req.method === 'POST' && url.pathname === '/api/coach') {
        let body;
        try { body = await readJson(req, 30_000); } catch { return send(res, 400, { errors: ['Invalid request.'] }); }
        const useAi = coachReply && allowCoach(callerId(req));
        const { status, body: out } = await coachResponse(body, useAi
          ? { reply: coachReply, log }
          : { reply: null, log, ...(coachReply && { noAiNotice: LIMIT_COACH_NOTICE }) });
        return send(res, status, out);
      }

      if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, ai: Boolean(generatePlan) });

      if (req.method === 'GET') {
        const path = url.pathname === '/' ? '/index.html' : url.pathname;
        const file = normalize(join(PUBLIC_DIR, path));
        if (!file.startsWith(PUBLIC_DIR)) return send(res, 404, 'Not found', 'text/plain');
        try {
          const data = await readFile(file);
          return send(res, 200, data, TYPES[extname(file)] ?? 'application/octet-stream');
        } catch {
          return send(res, 404, 'Not found', 'text/plain');
        }
      }
      send(res, 405, { errors: ['Method not allowed.'] });
    } catch (err) {
      log.error(err);
      send(res, 500, { errors: ['Something went wrong.'] });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  const port = Number(process.env.PORT) || 3000;
  const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
  createServer({
    generatePlan: hasKey ? createPlanGenerator() : null,
    coachReply: hasKey ? createCoachReplier() : null,
    planLimit: num(process.env.PLAN_LIMIT_PER_HOUR, 10),
    coachLimit: num(process.env.COACH_LIMIT_PER_HOUR, 60),
  }).listen(port, () => {
    console.log(`Gym AI running at http://localhost:${port}${hasKey ? '' : ' (no ANTHROPIC_API_KEY: starter plans only)'}`);
  });
}
