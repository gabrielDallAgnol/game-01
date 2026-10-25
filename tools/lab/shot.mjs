// Screenshots of the Atom Lab with Playwright (phone viewport by default), for checking a recipe by eye.
//   node tools/lab/shot.mjs <recipe> <seed> <out-prefix> [w h]   → <prefix>-map.png, <prefix>-camp.png, <prefix>-<site>.png
// Needs Playwright (NODE_PATH to a global install is fine) and dist/atomlab.html (node tools/lab/build-lab.mjs).
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url), { chromium } = require('playwright');
const [recipe = 'hollowmere', seed = '1', prefix = 'dist/lab', w = '390', h = '844'] = process.argv.slice(2), root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const b = await chromium.launch(), page = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto('file://' + path.join(root, 'dist/atomlab.html')); await page.waitForFunction(() => window.__lab && window.__lab.st.res);
await page.evaluate(([r, s]) => { __lab.setArea(r); __lab.setSeed(+s); document.getElementById('panel').classList.add('folded'); }, [recipe, seed]);
const snap = async (name, fn) => { await page.evaluate(fn); await page.waitForTimeout(450); await page.screenshot({ path: `${prefix}-${name}.png` }); console.log(`${prefix}-${name}.png`); };
await snap('map', () => __lab.setMap(true));
const sites = await page.evaluate(() => Object.entries(__lab.st.res.W.sites || {}).filter(([, p]) => p && p.x != null).map(([k, p]) => [k, p.x, p.y]));
await page.evaluate(() => __lab.setMap(false));
await snap('camp', () => { const W = __lab.st.res.W; __lab.teleport(W.camp.x, W.camp.y + 6); __lab.setView(90); });
for (const [k, x, y] of sites) if (process.env.SITES !== '0') await snap(k, `__lab.teleport(${x}, ${y + 14}); __lab.setView(90)`);
console.log(JSON.stringify(await page.evaluate(() => __lab.info().results.map(r => `${r.ok ? 'ok' : r.fatal ? 'FATAL' : 'warn'} ${r.name}: ${r.msg}`)), null, 1));
await b.close();
