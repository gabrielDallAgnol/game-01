// What every UI module shares: DOM lookups ($, $$), local storage, the audio and the saves (one each
// per page), feature flags, tuning constants and small text helpers (esc, rich, campCopy). No game state lives here:
// that is the `ui` context (see app.js).
import { createAudio } from './audio.js';
import { createSaves } from './saves.js';

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
// (the bundler exports names that are not \w+ only from a list)
export { $, $$ };
export const store = {
  get(k, d) { try { const v = localStorage.getItem('hollowmere.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('hollowmere.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
export const audio = createAudio(store);
export const saves = createSaves();
for (const t of ['pointerdown', 'keydown']) window.addEventListener(t, () => audio.unlock(), { capture: true });
// Cut or parked (decisions, Oct 20): everything stays behind a flag so it can come back.
// the start screen's "What's new" (under More): short, for players
export const WHATS_NEW = [
  '**The Solar Flare.** The sky blinked, about four in ten people turned into the **Ash-Born**, and you absorbed the charge. A blue **Thermal Pioneer System** woke in your head.',
  '**The Haven Rig.** A caution-yellow flatbed is home. Build the **Haven** around it; when the suburbs run dry, the Rig rolls on toward cooler ground.',
  '**Inferno Nests.** The Ash-Born gather where it is hot (gas stations, substations, boilers). Snuff the core and the road opens.',
  '**Your crew.** Dee the mechanic, Juno the track star and Gloria the manager keep the Haven talking.',
  '**Seasons are contracts.** The System offers a rule and a finale. Win it and the city eases off; lose it and the run ends with its name.',
  '**One Noise meter.** The louder the Haven, the more Ash-Born come and the farther the Inferno Nests hear you (the ring on the map).',
  '**Ruins stay ruins** until you rebuild them: tap one, or **Rebuild all** at dawn.',
];
export const FLAGS = { trader: false, crew: false, legacyAll: false, foremanFirstRun: false, runLog: false, perkShop: false, changelog: false, startDifficulty: false };
export const LEGACY_KEEP = ['scrap', 'dmg', 'keep'];
export const RINGS = ['Haven', 'The woods', 'The city', 'The old core'];
export const ARM_MS = 600;          // cards ignore taps this long after they appear
export const DAWN_DELAY = 1.2;      // seconds between the last kill and the first card
export const JOY_PX = 14;           // a touch that moves further than this is a joystick drag, not a tap
export const SHORT = { house: 'Home', farm: 'Farm', tower: 'Tower', wall: 'Barricade', workshop: 'Workshop', market: 'Market', generator: 'Generator' };
export const PLURAL = { house: 'homes', farm: 'farms', tower: 'towers', wall: 'barricade posts', workshop: 'workshops', market: 'markets', generator: 'generators' };
export const ONE = { house: 'a home', farm: 'a farm', tower: 'a tower', wall: 'a barricade post', workshop: 'the workshop', market: 'the market', generator: 'a generator' };
export const NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const DIR8 = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
export const esc = t => String(t ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
export const rich = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
export const mmss = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
/** one name for the hall: the game's own strings still say keep / town hall in places */
/** a chronicle line as a sentence: 'Drawings on the glass: "Go and get them"' → 'Drawings on the glass. You chose: Go and get them.' */
export const chronLine = t => { const m = /^(.+?): "(.+)"$/.exec(t); return m ? `${m[1].replace(/\.$/, '')}. You chose: ${m[2].replace(/^\[|\]$/g, '')}.` : t; };
export const campCopy = t => String(t).replace(/\b([Tt])he (keep|town hall|hall)\b/g, (_, T0) => `${T0}he Haven`).replace(/\btown hall\b/gi, 'Haven').replace(/\bthe town\b/g, 'the Haven');
