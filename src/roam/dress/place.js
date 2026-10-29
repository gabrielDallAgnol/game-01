// [roam] Placement: puts the dressing atoms on their slots, deterministically, by their own rules. No AI, no randomness
// beyond hashes of the seed: the same town always dresses the same way, and a new town dresses itself.
//   1. stories first (stories.js): small scenes with a reason (a crash, a survivor's house, a barricade). Each claims its
//      ground; a story may place any atom, in any care, because something happened there.
//   2. atoms then, family by family, on their slot kind: an atom stands where its `fit(care, slot)` says it belongs
//      (0 never, 1 always welcome), at most `chance` of the slots, never closer than `every` metres to its own kind
//      or `space` metres to anything else solid, and never on ground a story claimed.
// An atom (see atoms/README in docs/design/atoms.md) is a plain object:
//   { id, family, slot, every, chance, space?, fit(care, slot), variant?(care, h, slot, inst), collide?: { w, h },
//     volumes?(inst, K, t, v), paint?(g, inst), strands?(fx, inst, v), live?: { init(inst), step(inst, dt, v), draw(fx, inst, v) } }
// An instance is { atom, id, x, y, ang, care, h (0..1, its own hash), variant, story?, slot }.
const mixh = (n, v) => { n = Math.imul(n ^ (Math.round(v * 1000) | 0), 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return n ^ (n >>> 16); };
// a hash of up to five numbers (no arrays made: placement calls it a hundred thousand times)
export const hash = (a, b = 0, c = 0, d = 0, e = 0) => (mixh(mixh(mixh(mixh(mixh(0x9e3779b9, a), b), c), d), e) >>> 0) / 4294967296;

export function makePlacer({ ATOMS, STORIES, slots, care, seed, flags }) {
  const byId = new Map(ATOMS.map(a => [a.id, a])), out = [], claimed = [], solid = [];
  const G = 8, grid = new Map(), key = (x, y) => Math.floor(x / G) * 4096 + Math.floor(y / G);
  const near = (x, y, r, test) => { const k = Math.ceil(r / G); for (let j = -k; j <= k; j++) for (let i = -k; i <= k; i++) for (const q of grid.get(key(x + i * G, y + j * G)) || []) if (Math.hypot(q.x - x, q.y - y) < r && test(q)) return true; return false; };
  const add = (atom, s, extra = {}) => { const h = hash(seed, s.x, s.y, atom.id.length, out.length * 0.001);
    const inst = { atom, id: out.length, x: s.x, y: s.y, ang: s.ang ?? 0, care: s.care ?? care.at(s.x, s.y), h, slot: s, ...extra };
    inst.variant = extra.variant || (atom.variant ? atom.variant(inst.care, h, s, inst) : null); out.push(inst); const k = key(inst.x, inst.y); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(inst); return inst; };
  // 1. stories
  function stories(free) { for (const st of STORIES) {
    const cand = (slots.by[st.slot] || []).map(s => ({ s, w: st.where(s.care, s, flags), r: hash(seed, s.x, s.y, 77) })).filter(c => c.w > 0 && free(c.s.x, c.s.y)).sort((a, b) => b.w * (0.4 + b.r) - a.w * (0.4 + a.r));
    let n = 0; for (const c of cand) { if (n >= st.count) break; if (claimed.some(q => Math.hypot(q.x - c.s.x, q.y - c.s.y) < Math.max(q.story === st.id ? st.apart : 0, q.r + st.r))) continue;
      const put = (id, dx, dy, extra = {}) => { const atom = byId.get(id); if (!atom) return null; const ca = Math.cos(c.s.ang), sa = Math.sin(c.s.ang), x = c.s.x + dx * ca - dy * sa, y = c.s.y + dx * sa + dy * ca;
        return add(atom, { ...c.s, x, y, ang: (c.s.ang ?? 0) + (extra.turn || 0) }, { ...extra, story: st.id }); };
      if (st.build(c.s, put, hash(seed, c.s.x, c.s.y, 5), flags) === false) continue;
      claimed.push({ x: c.s.x, y: c.s.y, r: st.r, story: st.id }); n++; } } }
  // 2. atoms
  function atoms(free) { for (const atom of ATOMS) { if (!atom.slot) continue; const list = slots.by[atom.slot] || [];
    for (const s of list) { const r = hash(seed, s.x, s.y, atom.id.charCodeAt(0), atom.id.length); if (r >= atom.chance) continue;
      const f = atom.fit(s.care, s, flags); if (f <= 0 || hash(seed, s.y, s.x, 3, atom.id.length) > f) continue;
      if (!free(s.x, s.y) || claimed.some(q => Math.hypot(q.x - s.x, q.y - s.y) < q.r)) continue;
      if (near(s.x, s.y, atom.every, q => q.atom === atom)) continue;
      if (atom.space && near(s.x, s.y, atom.space, q => q.atom.space)) continue;
      add(atom, s); } } }
  // the result, split by how each instance is drawn
  function done() { for (const i of out) if (i.atom.collide) solid.push(i);
    return { list: out, claimed, solid, volumes: out.filter(i => i.atom.volumes), paint: out.filter(i => i.atom.paint), strands: out.filter(i => i.atom.strands), live: out.filter(i => i.atom.live) }; }
  return { stories, atoms, done };
}
