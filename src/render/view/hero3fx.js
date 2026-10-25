// [hero3] What the stat abilities look like: rings, sparks, labels and shake for Heavy Cleave, Blink Strike,
// Aether Burst (its pulses), Rally Cry, Wild Shape, Unbreakable, Smoke Step, Whirlwind, Radiant Blade, the hawk's
// mark, a dodge, and the System's cyan beat when a skill unlocks. Reads drained events only; draws through fx2.
export function createHero3Fx(V) {
  const { S, fx2, Wv } = V;
  const at = (x, y, h = 0.4) => Wv(x, y, h);
  function update(dt, events) {
    if (!events || !events.length) return;
    const { shake, burst } = V.feel, h = S.hero;
    for (const e of events) {
      switch (e.t) {
        case 'powCleave': { const p = at(e.x, e.y); fx2.ring(p.x, p.y - 0.3, p.z, e.r, '#ff8a5c', 0.5); fx2.emit('spark', p.x, p.y, p.z, 26, { spread: e.r * 0.6 }); shake(0.25); break; }
        case 'powBlink': { const a = at(e.x0, e.y0), b = at(e.x, e.y); fx2.emit('cyan', a.x, a.y, a.z, 14, { spread: 0.4 }); fx2.emit('spark', b.x, b.y, b.z, 18, { spread: 0.5 }); fx2.ring(b.x, b.y - 0.3, b.z, 1.4, '#7dff9e', 0.35); shake(0.12); break; }
        case 'powBurst': case 'powPulse': { const p = at(e.x, e.y, 0.3); fx2.ring(p.x, p.y, p.z, e.r, '#7fc8ff', 0.45); fx2.emit('cyan', p.x, p.y + 0.4, p.z, e.t === 'powBurst' ? 30 : 14, { spread: e.r * 0.5 }); break; }
        case 'powRadiant': { const p = at(e.x, e.y); fx2.ring(p.x, p.y - 0.3, p.z, e.r, '#fff2b0', 0.3); fx2.emit('spark', p.x, p.y, p.z, 12, { spread: 0.5 }); break; }
        case 'powWhirl': { const p = at(e.x, e.y); fx2.ring(p.x, p.y - 0.3, p.z, e.r, '#ffd08a', 0.3); break; }
        case 'powRally': { const p = at(e.x, e.y); fx2.ring(p.x, p.y - 0.3, p.z, e.r, '#ffd36a', 1.0); fx2.label(p.x, p.y + 2, p.z, 'RALLY', '#ffd36a', { size: 0.4, life: 1.4 }); break; }
        case 'powWild': { const p = at(h.x, h.y); fx2.emit('ember', p.x, p.y, p.z, 30, { spread: 0.6 }); fx2.label(p.x, p.y + 2, p.z, 'WILD SHAPE', '#7dff9e', { size: 0.36, life: 1.2 }); break; }
        case 'powUnbreak': { const p = at(h.x, h.y); fx2.ring(p.x, p.y - 0.3, p.z, 1.8, '#ff8a5c', 0.8); fx2.label(p.x, p.y + 2, p.z, 'UNBREAKABLE', '#ff8a5c', { size: 0.36, life: 1.4 }); shake(0.2); break; }
        case 'powSmoke': { const p = at(e.x, e.y, 0.3); fx2.emit('smoke', p.x, p.y, p.z, 26, { spread: 1.4, size: 1.3, life: 1.4 }); break; }
        case 'powArise': { const p = at(e.x, e.y, 0.3); fx2.ring(p.x, p.y, p.z, 4, '#b8a0ff', 0.9); fx2.emit('cyan', p.x, p.y, p.z, 24, { spread: 2 }); break; }
        case 'powMark': { const m = V.feel.mobOf ? V.feel.mobOf(e.id) : null; if (m) { const p = at(m.x, m.y, 1.2); fx2.ring(p.x, p.y - 1, p.z, 0.8, '#7fc8ff', 0.6); } break; }
        case 'dodge': { const p = at(h.x, h.y, 1.6); fx2.label(p.x, p.y, p.z, 'DODGE', '#7dff9e', { size: 0.3, life: 0.7 }); break; }
        case 'statUnlock': { const p = at(h.x, h.y); fx2.ring(p.x, p.y - 0.3, p.z, 2.6, '#5fd3ff', 1.0); fx2.emit('cyan', p.x, p.y, p.z, 30, { spread: 0.6 }); if (burst) burst(h.x, h.y, 1.2, '#5fd3ff'); break; }
        default: break;
      }
    }
  }
  return { update };
}
