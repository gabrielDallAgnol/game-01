// [combat2] Telegraphed melee and the hero's dash (?v2combat=1, G.v2combat). A dead in reach of the hero winds up
// first (event windup {id, dur}); when the wind-up ends it bites only if the hero is still in reach + grace and
// not mid-dash, else it whiffs (event whiff {id}). The dash (event dash) is a short burst with i-frames.
// Off by default: every function here is a no-op without the flag, so the classic game is untouched.
import { DASH, WINDUP } from '../content/combat2.js';
import { MOBS } from '../content/mobs.js';
import { idx, inside } from './mapgen.js';

export function createCombat2(G) {
  const { S, ev } = G;
  const on = () => !!G.v2combat;
  const st = () => S.dash || (S.dash = { dashT: 0, cd: 0, ifr: 0, dx: 0, dy: 0 });
  const walkable = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); return inside(cx, cy) && G.heroOk(idx(cx, cy)); };
  const windOf = kind => WINDUP.kinds[kind] ?? WINDUP.base * (1 + ((MOBS[kind] && MOBS[kind].size) - 1 || 0) * WINDUP.bySize);
  const heroIframed = () => on() && !!S.dash && S.dash.ifr > 0;

  // the brain's melee on the hero: true when this frame was spent winding up or resolving the swing (the mob holds still)
  function melee2(m, hd, dt) {
    const h = S.hero;
    if (m.windT > 0) {
      m.attacking = true; m.windT -= dt;
      if (m.windT > 0) return true;
      m.windT = 0; m.cd = WINDUP.cd;
      if (!h.dead && hd <= WINDUP.reach + WINDUP.grace && !heroIframed()) { G.hurtHero(MOBS[m.kind].dmg * (m.dmgK || 1)); ev('bite', { id: m.id }); }
      else ev('whiff', { id: m.id });
      return true;
    }
    if (h.dead || hd > WINDUP.reach) return false;
    m.attacking = true;
    if (m.cd <= 0) { m.windT = m.windDur = windOf(m.kind); ev('windup', { id: m.id, dur: m.windDur }); }
    return true;
  }

  // dash toward (dx, dy); no direction: the stick, else where the hero faces. false when it cannot (cooldown, dead, off)
  function dash(dx = 0, dy = 0) {
    const h = S.hero; if (!on() || h.dead) return false;
    const D = st(); if (D.cd > 0 || D.dashT > 0) return false;
    let l = Math.hypot(dx, dy);
    if (l < 1e-6) { dx = h.input.x; dy = h.input.y; l = Math.hypot(dx, dy); }
    if (l < 1e-6) { const f = h.face || 0; dx = Math.sin(f); dy = Math.cos(f); l = 1; }
    D.dx = dx / l; D.dy = dy / l; D.dashT = DASH.dur; D.ifr = DASH.iframes; D.cd = DASH.cd;
    h.target = null; h.path = null; h.face = Math.atan2(D.dx, D.dy);
    ev('dash', { x: h.x, y: h.y, dx: D.dx, dy: D.dy, dur: DASH.dur, dist: DASH.dist });
    return true;
  }

  // after stepHero, before the dead move: the burst itself, in short sub-steps so it never jumps through a wall
  function stepCombat2(dt) {
    if (!on() || !S.dash) return;
    const h = S.hero, D = S.dash;
    D.cd = Math.max(0, D.cd - dt); D.ifr = Math.max(0, D.ifr - dt);
    if (D.dashT <= 0) return;
    if (h.dead) { D.dashT = 0; return; }
    const s = Math.min(dt, D.dashT), v = DASH.dist / DASH.dur * s, n = Math.max(1, Math.ceil(v / 0.2));
    D.dashT -= s;
    for (let k = 0; k < n; k++) { const nx = h.x + D.dx * v / n, ny = h.y + D.dy * v / n; if (!walkable(nx, ny)) { D.dashT = 0; break; } h.x = nx; h.y = ny; }
    h.moving = true;
  }

  const dashInfo = () => { const D = S.dash; return { on: on(), ready: on() && !S.hero.dead && (!D || (D.cd <= 0 && D.dashT <= 0)), cd: D ? D.cd : 0, cdMax: DASH.cd, dashing: !!D && D.dashT > 0, iframes: !!D && D.ifr > 0 }; };
  return { melee2, dash, dashInfo, stepCombat2, heroIframed, windOf };
}
