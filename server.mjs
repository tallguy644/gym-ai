import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planResponse } from './plan-service.mjs';
import { createPlanGenerator } from './ai.mjs';
import { coachResponse, createCoachReplier } from './coach.mjs';

const PUBLIC_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
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
export function createServer({ generatePlan, coachReply, log = console } = {}) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'POST' && url.pathname === '/api/plan') {
        let body;
        try { body = await readJson(req); } catch { return send(res, 400, { errors: ['Invalid request.'] }); }
        const { status, body: out } = await planResponse(body, { generatePlan, log });
        return send(res, status, out);
      }

      if (req.method === 'POST' && url.pathname === '/api/coach') {
        let body;
        try { body = await readJson(req, 30_000); } catch { return send(res, 400, { errors: ['Invalid request.'] }); }
        const { status, body: out } = await coachResponse(body, { reply: coachReply, log });
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
  createServer({ generatePlan: hasKey ? createPlanGenerator() : null, coachReply: hasKey ? createCoachReplier() : null }).listen(port, () => {
    console.log(`Gym AI running at http://localhost:${port}${hasKey ? '' : ' (no ANTHROPIC_API_KEY: starter plans only)'}`);
  });
}
