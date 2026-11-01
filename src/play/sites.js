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
  camp: { id: 'camp', name: 'the camp', services: ['home', 'bank', 'repair'], owner: 'owned',
    desc: 'Your camp on the square: bank here, and come back here if you go down.', why: 'A safe start before the garage is reached.' },
  garage: { id: 'garage', name: 'the garage', services: ['bank', 'repair', 'stash', 'workbench'], owner: 'owned',
    desc: 'The garage: build from your recipes, fit parts and mods, upgrade. Banks and repairs too.', why: 'The hub: loot turns into a bike here.' },
};
export const offers = (site, service) => !!(site && (site.services || (SITES[site.kind] || {}).services || []).includes(service));
