// Street names per recipe: words only (the stages name streets from their own seed branch, so names never move a
// building). Agents add names here.
export const STREET_NAMES = {
  suburb: ['Maple', 'Birch', 'Elm', 'Cedar', 'Willow', 'Aspen', 'Linden', 'Hazel', 'Rowan', 'Alder', 'Juniper', 'Poplar', 'Sycamore', 'Laurel', 'Chestnut', 'Hawthorn', 'Larch', 'Magnolia', 'Spruce', 'Beech', 'Clover', 'Orchard', 'Meadow', 'Fern', 'Holly', 'Ivy', 'Sumac', 'Tamarack'],
  downtown: ['King', 'Queen', 'Market', 'Church', 'Bank', 'Mercer', 'Guild', 'Exchange', 'Union', 'Victoria', 'Albert', 'Regent', 'Castle', 'Bridge', 'Station', 'Court', 'Temple', 'Crown', 'Harbour', 'Abbey'],
  hollowmere: ['Linden', 'Birken', 'Ahorn', 'Kastanien', 'Erlen', 'Weiden', 'Eschen', 'Holunder', 'Flieder', 'Rosen', 'Garten', 'Wiesen', 'Feld', 'Acker', 'Heide', 'Mühlen', 'Brunnen', 'Schul', 'Post', 'Sonnen'],
  milltown: ['Foundry', 'Kiln', 'Coal', 'Slag', 'Cinder', 'Forge', 'Anvil', 'Bellows', 'Furnace', 'Ingot', 'Rivet', 'Smelter'],
};
export const STREET_KINDS = { downtown: ['Street', 'Avenue', 'Road', 'Way'], suburb: ['Street', 'Avenue', 'Lane', 'Drive', 'Court'], milltown: ['Row', 'Street', 'Terrace'], hollowmere: ['weg', 'straße', 'ring'] };
// Hollowmere's named streets, by their role in the plan (the town is drawn on Nauen: Mauerstraße was the wall street)
export const TOWN_NAMES = { plaza: 'kirchplatz', main: 'hauptstraße', north: 'bahnhofstraße', rail: 'am bahnhof', ring: 'mauerstraße', inner: 'marktring', path: 'wallpromenade', park: 'parkweg', mast: 'funkweg', barn: 'scheunenweg', south: 'berliner straße',
  lanes: ['jacobigasse', 'bäckergasse', 'gerbergasse', 'böttchergasse', 'schmiedegasse', 'webergasse', 'marktstraße', 'kantorgasse'], roads: ['hamburger chaussee', 'spandauer straße', 'ketziner straße', 'potsdamer straße'] };
export function nameStreets(W, rng, recipe) {
  const names = rng.shuffle(STREET_NAMES[recipe].slice()), kinds = STREET_KINDS[recipe]; let k = 0;
  W.streets.forEach(s => { if (!s.name && s.kind === 'local') s.name = `${names[k++ % names.length]} ${kinds[rng.int(kinds.length)]}`; });
}
