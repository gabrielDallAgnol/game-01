// [roam] The look review: the same scenes rendered with different cell marks (src/roam/medium.js setLook): today's letters,
// halftone dots, mosaic tiles, flat pixels, and fine cells that melt into smooth shading. Scenes: the robot bike close up,
// the garage gate at riding zoom by day and by night. Writes PNGs and an index.html contact sheet to OUT.
// Needs Playwright and a local three.js r128 (THREE_LOCAL). Build first, then: node tools/roam/look-review.cjs [OUT]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2] || '/tmp/look-review';
const LOOKS = [['Letters (now)', { style: 'glyph', cellW: 0.15 }, 'Every solid is drawn as letters whose density is its light.'],
  ['Halftone dots', { style: 'dots', cellW: 0.15 }, 'Each cell a dot that grows with the light: like print, softer than letters.'],
  ['Mosaic tiles', { style: 'tiles', cellW: 0.15 }, 'Each cell a square that grows with the light: a tiled, toy-like look.'],
  ['Flat pixels', { style: 'pixel', cellW: 0.15 }, 'Each cell a solid square, its strength the light: classic pixel art.'],
  ['Fine pixels', { style: 'pixel', cellW: 0.06 }, 'Smaller cells: the shapes melt into smooth shading, closest to a clean 3D look.']];
const SCENES = [['Robot bike, close', { zoom: 58, clock: 110, at: 'bay', robot: true }], ['Garage gate, riding zoom', { zoom: 20, clock: 110, at: 'gate' }], ['Garage gate, night', { zoom: 20, clock: 250, at: 'gate' }]];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 420, height: 300 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/three.min.js', r => r.fulfill({ body: fs.readFileSync(process.env.THREE_LOCAL || '/tmp/three/build/three.min.js'), contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('file://' + path.resolve('dist/roam.html') + '?fixedres=1&auto=1'); await p.waitForTimeout(2000);
  await p.evaluate(() => { const r = window.__roam, S = r.S, g = S.sites.find(q => q.bay); S.dead.length = 0; S.bike.x = S.kai.x = g.bay.x; S.bike.y = S.kai.y = g.bay.y; S.bike.ang = 0; S.kai.riding = true; r.lab.freeze = true;
    S.gear.engine = { slot: 'engine', part: 'engine_torque', rarity: 'rare' }; S.gear.frame = { slot: 'frame', part: 'frame_plated', rarity: 'rare' }; S.gear.lamp = { slot: 'lamp', part: 'lamp_wide', rarity: 'rare' }; S.gear.tyres = { slot: 'tyres', part: 'tyres_knobbly', rarity: 'rare' }; S.guns.main.base = 'launcher';
    for (const el of document.querySelectorAll('#hud,#loot,#area,#pad,#btns,#feed,#fps,#garageBtn,#fix,#toasts')) el.style.display = 'none'; });
  const rows = []; let n = 0;
  for (const [title, lk, note] of LOOKS) { const figs = [];
    for (const [sname, sc] of SCENES) { const f = `${String(n++).padStart(2, '0')}.png`;
      if (!fs.existsSync(path.join(OUT, f))) {
        await p.evaluate(([lk, sc]) => { const r = window.__roam, S = r.S, g = S.sites.find(q => q.bay); r.look.setLook(lk); S.clock = sc.clock; r.lab.bikeStyle = sc.robot ? 'C' : null; r.lab.hideKai = !!sc.robot;
          const at = sc.at === 'bay' ? g.bay : { x: g.gate.x + g.gate.nx * 4, y: g.gate.y + g.gate.ny * 4 }; r.lab.cam = { x: at.x, y: at.y }; r.cam.base = r.cam.ppm = sc.zoom; }, [lk, sc]);
        await p.waitForTimeout(2200); await p.screenshot({ path: path.join(OUT, f) }); }
      figs.push(`<figure><img src="${f}" alt="${title}: ${sname}"><figcaption>${sname}</figcaption></figure>`); }
    rows.push(`<section><h2>${title}</h2><p>${note}</p><div class="row">${figs.join('')}</div></section>`); }
  fs.writeFileSync(path.join(OUT, 'index.html'), `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hollowmere look review</title>
<style>:root{color-scheme:dark}body{margin:0;background:#0b0c0e;color:#e9e2cf;font:500 14px/1.45 ui-monospace,Menlo,monospace;padding:18px}h1{font:700 22px ui-monospace,monospace;color:#f0b44c;margin:0 0 4px}.lead{color:#9a988f;margin:0 0 18px;max-width:75ch}
section{margin:0 0 26px}h2{font-size:15px;color:#f0b44c;letter-spacing:.08em;text-transform:uppercase;margin:0 0 2px}section>p{color:#9a988f;margin:0 0 10px}.row{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
figure{margin:0;background:#15161a;border:1px solid #2a2b30;border-radius:12px;padding:8px;display:grid;gap:6px}figure img{width:100%;border-radius:8px;display:block}figcaption{font-weight:700}</style></head><body>
<h1>Look review: what each cell is drawn as</h1><p class="lead">The same world and the same robot bike (rare tank build), only the mark in each cell changes. Everything else (the ground, the light, the effects) stays the game's own.</p>
${rows.join('\n')}</body></html>`);
  console.log(`${n} shots → ${OUT}`, errs.slice(0, 3)); await b.close(); })();
