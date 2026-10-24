// Tonight's weather, rolled at dawn so you can prepare. Never on night 1–2 or a Flare Night.
//   dead: wave size · range: tower and keep reach · speed: how fast the dead walk · food: next dawn's harvest
export const WEATHER = {
  clear: { odds: 70, name: 'Clear', desc: '', dead: 1, range: 1, speed: 1, food: 1 },
  fog:   { odds: 10, name: 'Fog', desc: 'Towers see a quarter less far, but the Ash-Born stumble slower.', dead: 1, range: 0.75, speed: 0.88, food: 1, kind: 'bad' },
  storm: { odds: 10, name: 'Thunderstorm', desc: 'The thunder draws a fifth more Ash-Born. The rain fills the cisterns: more food at dawn.', dead: 1.2, range: 1, speed: 1, food: 1.4, kind: 'bad' },
  still: { odds: 10, name: 'A still night', desc: 'Quiet. A quarter fewer Ash-Born come.', dead: 0.75, range: 1, speed: 1, food: 1, kind: 'good' },
};
