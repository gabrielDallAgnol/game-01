// [roam] The bike review: every look a part gives the bike, photographed by the game's own renderer, for a design review.
// The bike stands in the garage bay (the rules frozen), facing right; each row is one slot (gun, engine, frame, lamp,
// tyres, the rarity paint, a few full builds), each variant shot twice: the garage close-up (Kai hidden) and the normal
// riding zoom with Kai on it (does it still read in play?). Writes PNG crops and an index.html contact sheet to OUT.
// Needs Playwright and a local three.js r128 (THREE_LOCAL). Build first, then: node tools/roam/bike-review.cjs [OUT]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2] || '/tmp/bike-review';
const P = (slot, part, rarity = 'common') => ({ slot, part, rarity });
const ROWS = [
  ['Gun', 'What the gun on the handlebars looks like, by weapon', [['Scatter gun', { gun: 'scatter' }], ['Launcher', { gun: 'launcher' }], ['Thrower', { gun: 'thrower' }]]],
  ['Engine', 'Stock, torque (bigger block, twin pipes), racer (long fairing), charger (ram plate)', [['Stock', {}], ['Torque', { engine: P('engine', 'engine_torque', 'tuned') }], ['Racer', { engine: P('engine', 'engine_racer', 'rare') }], ['Charger', { engine: P('engine', 'engine_charger', 'rare') }]]],
  ['Frame', 'Stock, plated (side plates), light (thin tube), bull-bar (bar across the front)', [['Stock', {}], ['Plated', { frame: P('frame', 'frame_plated', 'tuned') }], ['Light', { frame: P('frame', 'frame_light', 'tuned') }], ['Bull-bar', { frame: P('frame', 'frame_bullbar', 'rare') }]]],
  ['Lamp', 'Stock, twin, scanner (on a stalk), dazzle (one big lamp)', [['Stock', {}], ['Twin', { lamp: P('lamp', 'lamp_wide', 'tuned') }], ['Scanner', { lamp: P('lamp', 'lamp_scanner', 'rare') }], ['Dazzle', { lamp: P('lamp', 'lamp_dazzle', 'rare') }]]],
  ['Tyres', 'Stock, grip (wider), bouncers (round), knobblies (studded)', [['Stock', {}], ['Grip', { tyres: P('tyres', 'tyres_grip', 'tuned') }], ['Bouncers', { tyres: P('tyres', 'tyres_bouncy', 'tuned') }], ['Knobblies', { tyres: P('tyres', 'tyres_knobbly', 'rare') }]]],
  ['Rarity paint', 'The plated frame\'s plates in each rarity\'s paint', ['common', 'tuned', 'rare', 'epic'].map(r => [r, { frame: P('frame', 'frame_plated', r) }])],
  ['Full builds', 'Whole bikes', [['Tank', { gun: 'launcher', engine: P('engine', 'engine_torque', 'tuned'), frame: P('frame', 'frame_plated', 'rare'), lamp: P('lamp', 'lamp_wide', 'tuned'), tyres: P('tyres', 'tyres_knobbly', 'rare') }],
    ['Racer', { gun: 'scatter', engine: P('engine', 'engine_racer', 'epic'), frame: P('frame', 'frame_light', 'tuned'), lamp: P('lamp', 'lamp_scanner', 'rare'), tyres: P('tyres', 'tyres_grip', 'tuned') }],
    ['Rammer', { gun: 'thrower', engine: P('engine', 'engine_charger', 'rare'), frame: P('frame', 'frame_bullbar', 'epic'), lamp: P('lamp', 'lamp_dazzle', 'rare'), tyres: P('tyres', 'tyres_bouncy', 'tuned') }]]],
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 340, height: 220 }, deviceScaleFactor: 2 });   // a small window: swiftshader renders about a frame a second
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/three.min.js', r => r.fulfill({ body: fs.readFileSync(process.env.THREE_LOCAL || '/tmp/three/build/three.min.js'), contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('file://' + path.resolve('dist/roam.html') + '?fixedres=1&auto=1'); await p.waitForTimeout(2000);
  // the bay, by day, the rules frozen, the camera on the bike
  await p.evaluate(() => { const r = window.__roam, S = r.S, g = S.sites.find(q => q.bay); S.dead.length = 0; S.clock = 110; S.bike.x = S.kai.x = g.bay.x; S.bike.y = S.kai.y = g.bay.y; S.bike.ang = 0; S.bike.speed = 0; S.kai.riding = true;
    r.lab.cam = { x: g.bay.x, y: g.bay.y }; r.lab.freeze = true; for (const el of document.querySelectorAll('#hud,#loot,#area,#pad,#btns,#feed,#fps,#garageBtn,#fix,#toasts')) el.style.display = 'none'; });
  const html = []; let n = 0;
  for (const [title, note, vars] of ROWS) { html.push(`<section><h2>${title}</h2><p>${note}</p><div class="row">`);
    for (const [name, v] of vars) { const base = await p.evaluate(v => { const S = window.__roam.S, stock = { engine: 'engine_stock', frame: 'frame_stock', lamp: 'lamp_stock', tyres: 'tyres_stock' };
        for (const k of Object.keys(stock)) S.gear[k] = v[k] || { slot: k, part: stock[k], rarity: 'common' }; S.guns.main.base = v.gun || 'scatter'; S.guns.main.n = 0; return true; }, v);
      const shots = []; for (const [zoom, hide, w, h, tag] of [[72, true, 300, 170, 'close'], [22, false, 150, 90, 'play']]) {
        await p.evaluate(([zoom, hide]) => { const r = window.__roam; r.cam.base = zoom; r.cam.ppm = zoom; r.lab.hideKai = hide; }, [zoom, hide]); await p.waitForTimeout(1800);
        const f = `${String(n).padStart(2, '0')}-${tag}.png`; await p.screenshot({ path: path.join(OUT, f), clip: { x: 170 - w / 2, y: 110 - h / 2, width: w, height: h } }); shots.push([f, tag]); }
      html.push(`<figure><img src="${shots[0][0]}" alt="${title}: ${name}, close up"><img class="play" src="${shots[1][0]}" alt="${title}: ${name}, riding zoom"><figcaption>${name}</figcaption></figure>`); n++; void base; }
    html.push('</div></section>'); }
  fs.writeFileSync(path.join(OUT, 'index.html'), `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hollowmere bike review</title>
<style>:root{color-scheme:dark}body{margin:0;background:#0b0c0e;color:#e9e2cf;font:500 14px/1.45 ui-monospace,Menlo,monospace;padding:18px}h1{font:700 22px ui-monospace,monospace;color:#f0b44c;margin:0 0 4px}
.lead{color:#9a988f;margin:0 0 18px;max-width:70ch}section{margin:0 0 26px}h2{font-size:15px;color:#f0b44c;letter-spacing:.08em;text-transform:uppercase;margin:0 0 2px}section>p{color:#9a988f;margin:0 0 10px}
.row{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}figure{margin:0;background:#15161a;border:1px solid #2a2b30;border-radius:12px;padding:8px;display:grid;gap:6px}
figure img{width:100%;border-radius:8px;display:block;background:#000}figure img.play{width:50%;image-rendering:pixelated}figcaption{font-weight:700}</style></head><body>
<h1>Bike review: every part's look</h1><p class="lead">Rendered by the game itself, the bike parked in the garage bay facing right. Big image: the garage close-up (Kai hidden). Small image: the normal riding zoom with Kai on the bike, to judge whether a part still reads in play.</p>
${html.join('\n')}</body></html>`);
  console.log(`${n} variants → ${OUT}`, errs.slice(0, 3)); await b.close(); })();
