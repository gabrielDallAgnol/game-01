// [roam] The projectile lab: freezes the rules on a quiet kerb (road one side, grass the other), lines up every projectile
// (plain, fire and water pellets, a machine's bolt, a rocket, a flame jet, a water jet, hit sparks) and photographs the
// line-up at close, mid and far zoom, for design reviews. Needs Playwright and a local three.js r128 (THREE_LOCAL).
// Build first: node tools/lab/build-lab.mjs dist/roam.html src/roam/main.js roam.html; then: node tools/roam/projectile-lab.cjs [night]
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/three.min.js', r => r.fulfill({ body: fs.readFileSync(process.env.THREE_LOCAL || '/tmp/three/build/three.min.js'), contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('file://' + require('path').resolve('dist/roam.html') + '?fixedres=1&auto=1'); await p.waitForTimeout(2000);
  const NIGHT = process.argv[2] === 'night';
  await p.evaluate((NIGHT) => { const r = window.__roam, S = r.S, CH = r.town.chars;
    if (NIGHT) { const R2 = r.sim.dayPhase(); S.clock += 400; }
    // a kerb: road to the west, grass to the east
    let spot = null; for (let rr = 10; rr < 400 && !spot; rr += 3) for (let a = 0; a < 6.28 && !spot; a += 0.15) { const x = Math.round(S.kai.x + Math.cos(a) * rr), y = Math.round(S.kai.y + Math.sin(a) * rr); let ok = true;
      for (let d = 1; d <= 6 && ok; d++) for (const dy of [-8, 0, 8]) { if (CH.at(x - d, y + dy) === '"' || r.town.blocked(x - d, y + dy) || CH.at(x + d + 1, y + dy) !== '"' || r.town.blocked(x + d + 1, y + dy)) ok = false; } if (ok) spot = { x, y }; }
    S.dead.length = 0; S.bike.x = S.kai.x = spot.x - 9; S.bike.y = S.kai.y = spot.y + 14; S.kai.vx = S.kai.vy = 0; r.lab.cam = { x: spot.x, y: spot.y + 1 }; r.cam.x = spot.x; r.cam.y = spot.y; r.lab.freeze = true;
    let id = 90000; const shot = (x, y, a, sp, el, del = 'pellet', extra = {}) => S.shots.push({ id: id++, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 99, dmg: 0, close: 0, ox: x - Math.cos(a) * 2, oy: y - Math.sin(a) * 2, pierce: 0, el, push: 0, del, bounce: 0, last: -1, ...extra });
    // row 1 (y-6): plain pellets, a spread of three, half on road half on grass
    for (const [dx, dy] of [[-3, -7], [-2.6, -6], [-3, -5]]) shot(spot.x + dx, spot.y + dy, 0, 15, null);
    for (const [dx, dy] of [[2, -7], [2.4, -6], [2, -5]]) shot(spot.x + dx, spot.y + dy, 0, 15, null);
    // row 2 (y-2): fire pellets; water pellets
    for (const [dx, dy] of [[-3, -3], [-2.6, -2], [-3, -1]]) shot(spot.x + dx, spot.y + dy, 0, 15, 'fire');
    for (const [dx, dy] of [[2, -3], [2.4, -2], [2, -1]]) shot(spot.x + dx, spot.y + dy, 0, 15, 'water');
    // row 3 (y+2): a machine's bolt (toward Kai), a rocket
    S.bolts.push({ x: spot.x - 2.5, y: spot.y + 2, vx: -9, vy: 2, r: 0.3, dmg: 0, life: 99 });
    shot(spot.x + 3, spot.y + 2, 0, 24, 'fire', 'splash', { splash: { r: 2.6, dmg: 0, power: 0 } });
    // row 4 (y+5): a flame jet, a water jet (drops along a cone)
    for (let k = 0; k < 9; k++) { const q = k * 0.6; shot(spot.x - 5.5 + q, spot.y + 5 + (k % 3 - 1) * 0.1 * q, 0, 9, 'fire', 'stream', { ox: spot.x - 5.5, oy: spot.y + 5 }); }
    for (let k = 0; k < 9; k++) { const q = k * 0.6; shot(spot.x + 1 + q, spot.y + 5 + (k % 3 - 1) * 0.1 * q, 0, 9, 'water', 'stream', { ox: spot.x + 1, oy: spot.y + 5 }); }
    // hits: sparks (plain, fire, water) and a wall pop
    for (const [dx, el] of [[-3, null], [0, 'fire'], [3, 'water']]) S.events.push({ type: 'hit', x: spot.x + dx, y: spot.y + 9, ang: 0, el, t: S.t });
    window.__spot = spot; }, NIGHT);
  for (const [z, name] of [[30, 'close'], [16, 'mid'], [7, 'far']]) { await p.evaluate(z => { const r = window.__roam; r.cam.base = z; r.cam.ppm = z; }, z); await p.waitForTimeout(1500);
    if (name === 'close') await p.evaluate(() => { const r = window.__roam, S = r.S, sp = window.__spot; for (const [dx, el] of [[-3, null], [0, 'fire'], [3, 'water']]) S.events.push({ type: 'hit', x: sp.x + dx, y: sp.y + 9, ang: 0, el, t: S.t }); });
    await p.waitForTimeout(150); await p.screenshot({ path: `${process.env.OUT || 'reports'}/lab-${process.argv[2] || 'day'}-${name}.png` }); }
  console.log(errs.slice(0, 3)); await b.close(); })();
