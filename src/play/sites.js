// [play] Service sites (M5/M6, Gabriel Nov 1): the places that do things for Kai, as atoms. A site is a kind (this table)
// standing somewhere the map put it: the camp at the town's camp spot, the garage on the town's own garage site
// (world/sites.js lays one out on every map, in a different place). What it offers is its
// list of services, so a later map can sell a garage, a truck can carry one (the same services on a vehicle), a survivor's
// workshop can offer only repair. `owner` is for later (a garage for sale, one you own).
//   bank       carried scrap, chips and recipes become safe
//   repair     mends the bike from banked scrap
//   home       Kai comes back here after going down
//   stash      built gear waits here
//   workbench  build from recipes, fit parts and mods, upgrade (the garage panel)
// Every entry: desc (what the player reads) and why (what the designer meant).
export const SITES = {
  // [quests] Ines's door: she mends the robot once you've brought her the medicine (a side quest's reward)
  clinic: { id: 'clinic', name: 'Ines\'s door', services: ['repair'], owner: 'owned', desc: 'Ines, the nurse: she mends the robot too.', why: 'A side quest that changes the map: a place to repair in Wendbridge.' },
  camp: { id: 'camp', name: 'the camp', services: ['home', 'bank', 'repair'], owner: 'owned',
    desc: 'Your camp on the square: bank here, and come back here if you go down.', why: 'A safe start before the garage is reached.' },
  garage: { id: 'garage', name: 'the garage', services: ['bank', 'repair', 'stash', 'workbench'], owner: 'owned',
    // [m6c] its dressing, so it reads as the garage by looking, not by a label (Gabriel Nov 1): placed in front of its doors,
    // u along the wall, v out from it (metres from the doors' middle); a piece that would land in a wall is left out.
    // Drawn by src/roam/sitedress.js; its lights pool on the ground and its drums stain it (atomlook.js)
    dress: [{ k: 'doors', u: 0, v: 0.3 }, { k: 'sign', u: 0, v: 0.8 }, { k: 'worklamp', u: -5.5, v: 0.8 }, { k: 'worklamp', u: 5.5, v: 0.8 }, { k: 'bench', u: 3.4, v: 1.1 },
      { k: 'tyres', u: 7.4, v: 1.6 }, { k: 'tyres', u: 8.4, v: 3.2 }, { k: 'tyres', u: 7, v: 4.4 }, { k: 'drums', u: -7.6, v: 1.8 }, { k: 'lift', u: -4.6, v: 7.5 },
      { k: 'stain', u: -1.5, v: 4.5 }, { k: 'stain', u: 2.5, v: 6 }, { k: 'stain', u: -7, v: 3.4 }, { k: 'air', u: 9.2, v: 7.5 }, { k: 'cones', u: 1, v: 10.5 }],
    desc: 'The garage: build from your recipes, fit parts and mods, upgrade. Banks and repairs too.', why: 'The hub: loot turns into a bike here.' },
};
export const offers = (site, service) => !!(site && (site.services || (SITES[site.kind] || {}).services || []).includes(service));
