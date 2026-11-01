// Bundles the web app for the Android app into android/app/src/main/assets/www.
import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}android/app/src/main/assets/www`;

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of ['index.html', 'style.css', 'icon.svg']) await cp(`${root}public/${file}`, `${out}/${file}`);
await build({
  entryPoints: [`${root}android/web/main.js`],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'chrome100',
  minify: true,
  outfile: `${out}/app.js`,
  define: {
    'process.env.CLAUDE_MODEL': 'undefined',
    // Test build number shown in the app; CI sets GYM_AI_TEST.
    'process.env.GYM_AI_TEST': JSON.stringify(process.env.GYM_AI_TEST || ''),
    // Address of the server that holds the Claude key; CI sets GYM_AI_SERVER.
    'process.env.GYM_AI_SERVER': JSON.stringify(process.env.GYM_AI_SERVER || 'https://gym-ai-tallguy644.onrender.com'),
  },
  logLevel: 'info',
});
