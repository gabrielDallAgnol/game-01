// [roam] Plumes: smoke, dust and steam as one reusable atom. A plume is a preset (how a puff looks, rises, grows and
// fades) and a pool of puffs drawn on the overlay as soft sprites that drift downwind. Anything can emit:
//   · moving things: emit(preset, x, y, z, vx, vy) (the bike's dust on dirt: main.js)
//   · placed atoms: a PLUMES atom attaches to other atoms by rule (`on`: { atom, variant?, story?, slot? }), so a burnt
//     car smoulders, a crashed car's engine steams, a ruined works' roof still burns, a lived-in house's chimney smokes.
//     The attachment is the placement logic: the plume stands where its host stands, only if the host is that kind.
// Render-side only (state in the pool and on inst.st), never the rules.
export const PRESETS = {
  //          colour (rgb)       alpha  size0 size1 (m)  rise (m/s) life (s) rate (/s)  drift (wind)  warm (ember glow)
  dust:     { c: [176, 150, 116], a: 0.32, s0: 0.5, s1: 2.4, rise: 0.15, life: 1.6, rate: 0,  drift: 0.9, warm: 0 },
  hearth:   { c: [214, 208, 198], a: 0.22, s0: 0.4, s1: 2.6, rise: 0.9,  life: 4.5, rate: 2.2, drift: 1.2, warm: 0 },
  smoulder: { c: [96, 90, 86],    a: 0.45, s0: 0.6, s1: 4.2, rise: 1.2,  life: 6.0, rate: 3.5, drift: 1.4, warm: 1 },
  steam:    { c: [226, 228, 230], a: 0.2,  s0: 0.3, s1: 1.6, rise: 0.7,  life: 2.2, rate: 3.0, drift: 0.8, warm: 0 },
  works:    { c: [120, 116, 110], a: 0.3,  s0: 0.9, s1: 6.0, rise: 1.6,  life: 8.0, rate: 2.0, drift: 1.6, warm: 0.4 },
};
const N = 360, P = Array.from({ length: N }, () => ({ life: 0 }));
let next = 0;
const sprites = {};
function sprite(c) { const k = c.join(','); if (sprites[k]) return sprites[k]; const s = document.createElement('canvas'); s.width = s.height = 64; const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${k},1)`); gr.addColorStop(0.55, `rgba(${k},0.55)`); gr.addColorStop(1, `rgba(${k},0)`); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (sprites[k] = s); }
/** one puff of `preset` at (x, y), z metres up, moving (vx, vy) m/s */
export function emit(preset, x, y, z = 0, vx = 0, vy = 0, k = 1) { const pr = PRESETS[preset], p = P[next++ % N], j = Math.sin(next * 12.9898) * 43758.5453 % 1;
  Object.assign(p, { pr, x, y, z, vx: vx + j * 0.3, vy: vy - j * 0.2, t: 0, life: pr.life * (0.7 + 0.6 * Math.abs(j)), k, spin: j * 6.28 }); }
/** step and draw every live puff (once a frame, after the solids, before the HUD) */
export function drawPlumes(fx, toS, ppm, dt, WIND, night, W, H) {
  for (const p of P) { if (p.life <= 0) continue; p.t += dt; if (p.t >= p.life) { p.life = 0; continue; }
    const pr = p.pr, u = p.t / p.life, drag = Math.exp(-dt * 1.4);
    p.vx = p.vx * drag + WIND.x * pr.drift * dt; p.vy = p.vy * drag + WIND.y * pr.drift * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += pr.rise * dt;
    const [X, Y] = toS(p.x, p.y - p.z * 0.6), r = (pr.s0 + (pr.s1 - pr.s0) * Math.sqrt(u)) * p.k * ppm; if (X < -r || Y < -r || X > W + r || Y > H + r) continue;
    const a = pr.a * Math.min(1, u * 6) * (1 - u) * (1 - u) * (night > 0.5 && !pr.warm ? 0.55 : 1);
    if (a < 0.01) continue; fx.globalAlpha = a; fx.drawImage(sprite(pr.c), X - r, Y - r, 2 * r, 2 * r);
    if (pr.warm && night > 0.2 && u < 0.18) { fx.globalAlpha = (0.18 - u) * 3 * night * pr.warm; fx.globalCompositeOperation = 'lighter'; fx.drawImage(sprite([255, 120, 40]), X - r * 0.6, Y - r * 0.6, r * 1.2, r * 1.2); fx.globalCompositeOperation = 'source-over'; } }
  fx.globalAlpha = 1; }
// a placed emitter: emits at its preset's rate while near the camera (the main loop steps only nearby lives)
const emitter = (preset, z, k = 1) => ({ init(i) { i.st = { x: i.x, y: i.y, acc: i.h }; },
  step(i, dt) { const pr = PRESETS[preset]; i.st.acc += dt * pr.rate * k; while (i.st.acc >= 1) { i.st.acc -= 1; emit(preset, i.x, i.y, z, 0, 0, k); } }, draw() {} });
// the plume atoms: each attaches to a host atom by rule (place.js: `on`); `chance` of the matching hosts carry it
export const PLUMES = [
  // a burnt-out car still smoulders here and there (more where it burned in a story)
  { id: 'plume.car', family: 'plume', on: { atom: 'car', variant: ['burnt'] }, chance: 0.4, live: emitter('smoulder', 0.6, 0.8) },
  // a crash's engine steams: the radiator split
  { id: 'plume.crash', family: 'plume', on: { atom: 'car', variant: ['crashed'] }, chance: 0.7, at: [1.6, 0], live: emitter('steam', 0.5, 0.8) },
  // a pump that burned
  { id: 'plume.pump', family: 'plume', on: { atom: 'pump', variant: ['burnt'] }, chance: 1, live: emitter('smoulder', 1.0, 1.1) },
  // a works or warehouse roof: where the blight reached, the fire inside never quite went out
  { id: 'plume.works', family: 'plume', on: { slot: 'roof', tags: ['industrial', 'site.warehouse'], care: [0, 0.4] }, chance: 0.5, live: emitter('works', 6, 1) },
];
