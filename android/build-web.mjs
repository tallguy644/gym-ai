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
  define: { 'process.env.CLAUDE_MODEL': 'undefined' },
  logLevel: 'info',
});
