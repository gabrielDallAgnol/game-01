// Hollowmere atoms: the chapter-1 town, shaped like a small Brandenburg town (a round old town in a ring street,
// a church square, a long main street from the south, the rail and the sugar works to the north, the masts to the
// south-west). Data only. Landmarks name a site need ('site.church', 'site.mast'…) so the stages ask for a site,
// never an id. Offers tell the game what a building is good for: medicine, law, learning, signal, iron, work,
// shop, salvage, shelter, home:N. 'nestable' marks the ordinary buildings the Ash-Born may take; the 'finale'
// atom is the sugar works overgrown, the chapter's last nest.

const PARTY = [{ type: 'door', at: 'front' }, { type: 'party.wall', at: 'left' }, { type: 'party.wall', at: 'right' }, { type: 'lot.edge', at: 'back' }];
const DOOR = [{ type: 'door', at: 'front' }];
const DETACHED = [{ type: 'door', at: 'front' }, { type: 'detached', at: 'left' }, { type: 'detached', at: 'right' }];

// old-town rowhouses: tall, deep, red tile; 'row-home' lines the ring and the lanes, 'row-shop' the shopping streets
const row = (id, w, d, h, roof, roof2, offers, kind) => ({
  id, look: 'gable', kind: 'building', size: [w, d], height: h, layer: 'roof', collide: 'box', roles: [roof, roof2, 'roof.slate'],
  sockets: PARTY, needs: ['lot.terrace'], offers, tags: ['house', 'terrace', 'oldtown', kind, 'hollowmere'], light: kind === 'row-shop' ? 0.6 : 0.45,
});
// a landmark on its own site
const site = (id, look, w, d, h, roles, need, offers, tags, extra) => ({
  id, look, kind: 'building', size: [w, d], height: h, layer: 'roof', collide: 'box', roles,
  sockets: DOOR, needs: [need], offers, tags: ['landmark', 'poi', ...tags, 'hollowmere'], light: 0.8, ...extra,
});

export const HOLLOWMERE_ATOMS = [
  row('row.old.a', 7.5, 11, 10, 'roof.warm', 'roof.warm2', ['home:5'], 'row-home'),
  row('row.old.b', 8.5, 11.5, 11, 'roof.warm2', 'roof.warm', ['home:6'], 'row-home'),
  row('row.old.c', 6.8, 10.5, 9, 'roof.sand2', 'roof.sand', ['home:4'], 'row-home'),
  row('row.old.d', 9, 12, 12, 'roof.warm', 'roof.sand2', ['home:7'], 'row-home'),
  row('row.old.e', 7.2, 11, 10, 'roof.slate', 'roof.slate2', ['home:5'], 'row-home'),
  row('row.shop.a', 9, 12, 12, 'roof.warm2', 'roof.warm', ['shop', 'home:3'], 'row-shop'),
  row('row.shop.b', 10, 12.5, 13, 'roof.sand', 'roof.sand2', ['shop'], 'row-shop'),
  row('row.shop.c', 8, 12, 11, 'roof.slate2', 'roof.slate', ['medicine', 'shop'], 'row-shop'),
  row('row.shop.d', 8.6, 12, 12, 'roof.warm', 'roof.warm2', ['shop', 'home:4'], 'row-shop'),

  // the church square: St Jacobi with its tower, the school beside it; the town hall at the south gate
  site('church.jacobi.a', 'church', 38, 15, 18, ['roof.warm2', 'roof.warm', 'roof.slate2'], 'site.church', ['shelter', 'home:12'], ['church', 'must'], { label: 'st jacobi', light: 0.9 }),
  site('townhall.hollowmere.a', 'gable', 28, 15, 15, ['roof.warm', 'roof.warm2', 'wall.light'], 'site.townhall', ['law'], ['civic', 'must'], { label: 'town hall' }),
  site('school.jacobi.a', 'flat', 26, 13, 11, ['roof.sand', 'roof.sand2', 'metal'], 'site.school', ['learning'], ['civic', 'must'], { label: 'school' }),
  { id: 'tower.water.nw', look: 'tower', kind: 'building', size: [11, 11], height: 34, layer: 'roof', collide: 'circle', roles: ['roof.warm2', 'roof.warm', 'roof.slate'],
    needs: ['site.lookout'], offers: ['signal'], tags: ['landmark', 'poi', 'must', 'hollowmere'], light: 0.3, label: 'water tower' },

  // the rail quarter: the station and its platform roof, the sugar works (clean, and overgrown as the finale)
  site('station.hollowmere.a', 'gable', 30, 12, 10, ['roof.slate', 'roof.slate2', 'wall.light'], 'site.station', ['work', 'salvage'], ['rail', 'must'], { label: 'hollowmere' }),
  { id: 'platform.station.a', look: 'canopy', kind: 'building', size: [58, 4.5], height: 4, layer: 'roof', collide: 'none', roles: ['roof.slate2', 'metal'], needs: ['site.platform'], tags: ['rail', 'hollowmere'] },
  site('mill.sugar.a', 'flat', 48, 22, 16, ['roof.slate', 'roof.slate2', 'metal'], 'site.factory', ['iron', 'work'], ['industrial'], { label: 'sugar works', labelRole: 'accent.caution' }),
  site('mill.sugar.infested', 'infested', 48, 22, 16, ['roof.slate2', 'roof.slate', 'accent.fire', 'accent.ember'], 'site.factory', ['iron', 'work'], ['industrial', 'finale', 'nest', 'infested', 'must'],
    { label: 'sugar works', labelRole: 'accent.ember', light: 1, variantOf: 'mill.sugar.a' }),
  { id: 'silo.sugar.a', look: 'tower', kind: 'building', size: [8, 8], height: 24, layer: 'roof', collide: 'circle', roles: ['roof.cream2', 'roof.cream', 'metal'], needs: ['site.factory-yard'], tags: ['industrial', 'hollowmere'] },

  // the transmitter field: lattice masts on guy wires (guy = the anchor radius in metres) and the transmitter hall
  { id: 'mast.radio.a', look: 'mast', kind: 'building', size: [3.6, 3.6], height: 110, layer: 'roof', collide: 'box', roles: ['metal', 'accent.scarf', 'roof.slate2'],
    needs: ['site.mast'], offers: ['signal'], tags: ['landmark', 'mast', 'must', 'hollowmere'], light: 1, guy: 30 },
  site('hall.transmitter.a', 'flat', 26, 12, 8, ['roof.cream', 'roof.cream2', 'metal'], 'site.transmitter', ['signal', 'salvage'], ['civic', 'must'], { label: 'transmitter' }),

  // ordinary buildings the dead may nest in: barns at the edge of the old town, sheds and halls in the works quarter
  { id: 'barn.old.a', look: 'gable', kind: 'building', size: [17, 10], height: 9, layer: 'roof', collide: 'box', roles: ['roof.warm2', 'roof.slate', 'roof.slate2'], sockets: DETACHED,
    needs: ['lot.barn'], offers: ['salvage'], tags: ['barn', 'nestable', 'hollowmere'], setback: [3, 5], light: 0.1 },
  { id: 'barn.old.b', look: 'gable', kind: 'building', size: [20, 11], height: 10, layer: 'roof', collide: 'box', roles: ['roof.sand2', 'roof.warm2', 'roof.slate2'], sockets: DETACHED,
    needs: ['lot.barn'], offers: ['salvage', 'home:2'], tags: ['barn', 'nestable', 'hollowmere'], setback: [3, 5], light: 0.1 },
  { id: 'hall.goods.a', look: 'flat', kind: 'building', size: [30, 14], height: 8, layer: 'roof', collide: 'box', roles: ['roof.slate2', 'roof.slate', 'metal'], sockets: DOOR,
    needs: ['lot.industrial'], offers: ['work', 'salvage'], tags: ['industrial', 'nestable', 'hollowmere'], setback: [8, 10], light: 0.5, label: 'goods' },
  { id: 'works.garage.a', look: 'flat', kind: 'building', size: [22, 14], height: 6, layer: 'roof', collide: 'box', roles: ['roof.sage2', 'roof.slate2', 'metal'], sockets: DOOR,
    needs: ['lot.industrial'], offers: ['iron', 'work'], tags: ['industrial', 'nestable', 'hollowmere'], setback: [8, 10], light: 0.5 },
];

// outbuildings: the sheds, workshops and back houses that fill an old town's block interiors
const back = (id, look, w, d, h, roof, roof2) => ({ id, look, kind: 'building', size: [w, d], height: h, layer: 'roof', collide: 'box', roles: [roof, roof2, 'roof.slate'],
  needs: ['yard.old'], offers: ['salvage'], tags: ['outbuilding', 'oldtown', 'hollowmere'], light: 0.05 });
HOLLOWMERE_ATOMS.push(
  back('shed.old.a', 'gable', 6, 5, 5, 'roof.warm2', 'roof.warm'),
  back('shed.old.b', 'gable', 8.5, 5.5, 6, 'roof.warm', 'roof.warm2'),
  back('shed.old.c', 'flat', 5, 4, 3.5, 'roof.slate2', 'roof.slate'),
  back('shed.old.d', 'gable', 7, 6, 6, 'roof.sand2', 'roof.sand'),
);

