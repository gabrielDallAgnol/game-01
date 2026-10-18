// node render.cjs scene[:WxH] ...   → out/<scene>.png
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const arg of process.argv.slice(2)) {
    const [name, size = '1600x900'] = arg.split(':'); const [w, h] = size.split('x').map(Number);
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const logs = []; page.on('console', m => logs.push(m.text())); page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
    const t0 = Date.now();
    await page.goto('file://' + path.resolve(__dirname, 'render.html') + `?scene=${name}&w=${w}&h=${h}`);
    await page.waitForFunction(() => window.__done, null, { timeout: 600000 });
    const err = await page.evaluate(() => window.__error);
    if (err) { console.log(name, 'ERROR', err); console.log(logs.join('\n')); await page.close(); continue; }
    await page.locator('canvas').screenshot({ path: path.resolve(__dirname, 'out', name + '.png') });
    console.log(name, `${w}x${h}`, ((Date.now() - t0) / 1000).toFixed(1) + 's', await page.evaluate(() => window.__info), logs.filter(l => /error|warn/i.test(l)).slice(0, 3).join(' | '));
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
