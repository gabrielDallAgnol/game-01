// [play] The machines: every machine is data (tags, stats, how it fights). The sim reads `ai` to pick how it moves and
// attacks; the renderer reads `look`. Each one exists to break a different safe habit (desc: what the player reads;
// why: what it's for). color: its eye light, a muted hue from the ember/ash palette (its faint ring close up, its glowing
// eyes from far away).
// See docs/design/play-atoms.md §9.
export const MACHINES = {
  crawler: { ai: 'melee', hp: 8, speed: 2.3, dmg: 6, tags: ['metal', 'chipped', 'light'], look: 'crawler', color: '#e8553a', weight: [0.42, 0.3],
    name: 'Crawler', desc: 'Scuttles after you and latches on when you slow down.', why: 'The baseline: teaches "keep moving".' },
  skitter: { ai: 'melee', hp: 2.4, speed: 5.4, dmg: 3, windup: 0.18, pack: [3, 5], tags: ['metal', 'chipped', 'light'], look: 'skitter', color: '#d6a34a', weight: [0.22, 0.22],
    name: 'Skitter', desc: 'Small and fast, comes in packs. Weak alone, a swarm hurts.', why: 'Catches a bike that cruises slowly; rewards spread shots and rams.' },
  hound: { ai: 'hound', hp: 9, speed: 4.4, dmg: 8, sense: 2.2, forget: 70, lunge: { range: 7, speed: 13, time: 0.32, cd: 2.6 }, tags: ['metal', 'chipped'], look: 'hound', color: '#a98bd6', weight: [0.13, 0.2],
    name: 'Hound', desc: 'Picks up your trail from far away and never lets go. Lunges when close.', why: 'Breaks "shoot from far away and forget": it follows you across the map.' },
  spitter: { ai: 'ranged', hp: 7, speed: 2.6, dmg: 9, sense: 1.6, forget: 45, keep: [9, 13], range: 15, every: 1.9, windup: 0.5, bolt: { speed: 14, life: 1.6, r: 0.8 }, tags: ['metal', 'chipped'], look: 'spitter', color: '#6fb3c8', weight: [0.15, 0.16], most: 3,
    name: 'Spitter', desc: 'Keeps its distance and spits slow bolts. Its eye flares before it fires: move.', why: 'Breaks "stand still and shoot": you have to dodge while you aim.' },
  brute: { ai: 'melee', hp: 34, speed: 1.4, dmg: 16, windup: 0.6, reach: 1.5, heavy: true, tags: ['metal', 'chipped', 'heavy'], look: 'brute', color: '#d97a3a', weight: [0.08, 0.12],
    name: 'Brute', desc: 'Slow and armoured. Ramming it stops the bike dead. Hits very hard.', why: 'Can\'t be rammed: you have to shoot it, which makes the others close in.' },
};
