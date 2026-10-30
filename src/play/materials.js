// [play] Materials: how an atom answers each element (docs/design/atomic-engineering.md §3). Atoms never touch each
// other directly: a burning atom gives off heat (burnHeat per second, out to burnReach metres), and every atom reacts to
// the heat it receives by its own material. Wet atoms boil their water off before they heat up.
//   ignite: heat to catch fire (Infinity: never) · fuel: seconds it burns · burnHeat / burnReach: what it gives off
//   soak: water it holds (seconds of wet) · onBurnt: what it becomes · explodeAt: heat at which it blows instead of burning
//   hurts: damage per second a burning one does to anything standing in it
export const MATERIALS = {
  dryGrass: { ignite: 1.0, fuel: 3, burnHeat: 0.9, burnReach: 3.0, soak: 14, onBurnt: 'char', hurts: 6,
    desc: "Grass. Catches fast, burns out fast; the wind runs it.", why: 'The fastest fire: a lawn or a verge becomes a moving wall.' },
  crop: { ignite: 0.9, fuel: 4.5, burnHeat: 1.1, burnReach: 3.2, soak: 12, onBurnt: 'char', hurts: 7,
    desc: "A field of crops. Goes up in sheets.", why: 'Farmland fires: big, fast, a way to clear a field of machines.' },
  woodsFloor: { ignite: 1.6, fuel: 5, burnHeat: 1.0, burnReach: 3.0, soak: 18, onBurnt: 'char', hurts: 6,
    desc: "Leaf litter under trees.", why: 'Carries fire from tree to tree.' },
  tree: { ignite: 4, fuel: 11, burnHeat: 3.2, burnReach: 6, soak: 20, onBurnt: 'stump', hurts: 9,
    desc: "A tree. Hard to light, burns long and hot.", why: 'A burning tree lights its neighbours: woods go up slowly, then all at once.' },
  hedge: { ignite: 3.2, fuel: 6, burnHeat: 1.5, burnReach: 3.6, soak: 16, onBurnt: 'gone', hurts: 7,
    desc: "A hedge. Burns through and leaves a gap.", why: 'Fire opens new routes.' },
  wood: { ignite: 2.5, fuel: 7, burnHeat: 2.2, burnReach: 3.6, soak: 14, onBurnt: 'gone', hurts: 7,
    desc: "Wood: fences, gates, benches, pallets.", why: 'Burns away: fire changes the map.' },
  hay: { ignite: 0.6, fuel: 9, burnHeat: 3, burnReach: 5, soak: 10, onBurnt: 'char', hurts: 9,
    desc: "Hay bales. Light at a spark and burn hot.", why: 'Farm bombs: a bale stack lights a whole yard.' },
  building: { ignite: 10, fuel: 45, burnHeat: 2.6, burnReach: 8, soak: 30, onBurnt: 'gutted', hurts: 10,
    desc: "A house. Takes a lot of heat, then burns for a long time and lights what's next to it.", why: 'Gabriel: houses, cars and trees going up make players think before shooting everything.' },
  fuelTank: { ignite: Infinity, explodeAt: 5, blast: { r: 6.5, heat: 7, dmg: 22, push: 8 }, soak: 10, onBurnt: 'wreck', wreckBurn: 9, burnHeat: 2, burnReach: 4, hurts: 10,
    desc: "A car, a tractor, a petrol pump. Doesn't catch: heats up, then blows, and the wreck burns a while.", why: 'Chain reactions: a fire reaches a car, the car blows, the fire jumps.' },
  oil: { ignite: 0.3, fuel: 6, burnHeat: 3, burnReach: 3, soak: 6, onBurnt: 'char', hurts: 9,
    desc: "Oil on the ground. Lights at a touch, burns very hot.", why: 'Machines bleed oil: fights leave fuel behind.' },
  metal: { ignite: Infinity, soak: 0, desc: "Metal: machines, bins, posts. Doesn't burn.", why: 'Machines take heat as fire pips instead.' },
  stone: { ignite: Infinity, soak: 0, blocks: true, desc: "Roads, walls, stone.", why: 'Firebreaks.' },
};
