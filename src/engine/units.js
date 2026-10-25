// The scale bible. One world unit is one metre, everywhere. Every size, speed and
// distance in the engine is written in metres and seconds, so numbers read as reality.

export const M = 1;

// People and movement (m, m/s)
export const HUMAN = { height: 1.8, shoulder: 0.5, radius: 0.35 };
export const SPEED = { walk: 4.2, run: 6.6, dash: 22, deadWalk: 1.5, deadRun: 3.0 };

// Streets and lots (m)
export const STREET = { lane: 3.2, kerb: 1.8, local: 7, highway: 9, connector: 7 };
export const LOT = { width: 18, depth: 24, setback: [4, 6], sideGap: 1.5 };
export const GAP = { detached: 3, partyWall: 0, treeFromKerb: 0.6, lampEvery: 30, streetTreeEvery: [12, 18] };

// Rails and terraces (m): standard gauge, the corridor kept clear, rowhouse depth and alleys
export const RAIL = { gauge: 1.435, corridor: 4.6, clear: 3 };
export const TERRACE = { depth: 9, alley: 3, front: 1.2, yard: 5 };

// Pace targets (s) — the travel-time validator checks the world against these.
export const PACE = { crossArea: [45, 90], placeFromHub: [20, 45], dayCycle: 960 };

// Nav grid resolution (m per cell)
export const NAV_CELL = 1;

export const metres = n => n * M;
export const secondsToCross = (dist, speed = SPEED.walk) => dist / speed;
