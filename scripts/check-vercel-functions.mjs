/**
 * Regression guard for Vercel functions: compile every server-side file on its own
 * (as Vercel does, no bundling), then load each api/ entry with plain Node ESM.
 * Catches extensionless relative imports and CommonJS named imports that Vite/tsx
 * tolerate locally but crash in production (FUNCTION_INVOCATION_FAILED).
 *
 *   npm run check:functions
 */
import { createRequire } from 'node:module';
import { readdirSync, statSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const root = process.cwd(), out = join(tmpdir(), `vercel-fn-check-${process.pid}`);
const { build } = createRequire(join(root, 'package.json'))('esbuild');
rmSync(out, { recursive: true, force: true });
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = ['api', 'server', 'src/ai', 'src/domain', 'src/engine', 'src/fixtures'].flatMap((d) => walk(join(root, d))).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
for (const f of files) {
  const rel = relative(root, f).replace(/\.ts$/, '.js');
  await build({ entryPoints: [f], outfile: join(out, rel), format: 'esm', platform: 'node', bundle: false, logLevel: 'error' });
}
writeFileSync(join(out, 'package.json'), JSON.stringify({ type: 'module' }));
symlinkSync(join(root, 'node_modules'), join(out, 'node_modules'));
const results = {};
for (const f of files.filter((f) => relative(root, f).startsWith('api/') && !relative(root, f).includes('/_'))) {
  const rel = relative(root, f).replace(/\.ts$/, '.js');
  try { await import(pathToFileURL(join(out, rel)).href); results[rel] = 'ok'; } catch (e) { results[rel] = e.code + ': ' + e.message.split('\n')[0].slice(0, 140); }
}
rmSync(out, { recursive: true, force: true });
const failed = Object.entries(results).filter(([, v]) => v !== 'ok');
for (const [k, v] of Object.entries(results)) console.log(`${v === 'ok' ? 'ok  ' : 'FAIL'} ${k}${v === 'ok' ? '' : ` — ${v}`}`);
if (failed.length) process.exit(1);
