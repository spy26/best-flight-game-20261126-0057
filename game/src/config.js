// Skyline Harbor — shared tuning, layout constants and helpers.
// One clear job: every number the rest of the game agrees on lives here.

export const GAME_TITLE = 'SKYLINE HARBOR';
export const GAME_TAGLINE = 'Golden-hour courier run over the harbor city';
export const RUN_TIME_SECONDS = 180;
export const RING_POINTS = 100;
export const RING_TIME_BONUS = 10;
export const RING_FUEL_BONUS = 6;
export const STALL_SPEED = 26;
export const MAX_SPEED = 96;
export const BEST_SCORE_KEY = 'skyline-harbor-best';

// Flaps: UP / APPR / FULL. Each step lowers the stall speed (more lift)
// and adds drag, so a slow, flaps-down approach is the safe way home.
export const FLAP_NAMES = ['UP', 'APPR', 'FULL'];
export function stallSpeedForFlaps(flaps) {
  return [26, 22, 18][flaps] ?? 26;
}

// Master caution / warning annunciator: derived purely from live flight
// state — no timers, no scripted values. Near-stall warns 15% above the
// flaps stall speed so the lamp lights before the stall itself bites;
// overspeed is past the published limit (MAX_SPEED).
export function computeWarnings(flight) {
  const stall = stallSpeedForFlaps(flight.flaps);
  const lowFuel = flight.fuel < 25;
  const nearStall = flight.speed < stall * 1.15;
  const overspeed = flight.speed > MAX_SPEED;
  const labels = [];
  if (lowFuel) labels.push('LOW FUEL');
  if (nearStall) labels.push('NEAR STALL');
  if (overspeed) labels.push('OVERSPEED');
  return { lowFuel, nearStall, overspeed, any: labels.length > 0, labels };
}

// Low golden sun on the north-west horizon — the glare source for the
// cockpit view. Same position the world builder hangs the sun disc at.
export const SUN_POS = { x: -1587, y: 220, z: -2184 };

// The runway sits on the flat apron south of downtown, heading north (-Z).
export const RUNWAY = { x: 0, zMin: -100, zMax: 300, halfWidth: 15 };
export const SPAWN = { x: 0, y: 55, z: 360, heading: 0, pitch: 0, roll: 0 };
export const WORLD_LIMIT = 1250;

// Golden-hour palette, shared by the world builder and the HUD.
export const PALETTE = {
  skyTop: 0x7d9cc4,
  skyHorizon: 0xffc98a,
  fog: 0xf2b878,
  sun: 0xffb36b,
  water: 0x2e6f8e,
  waterDeep: 0x1d4e66,
  sand: 0xe8c98f,
  grass: 0x5d8a4a,
  hill: 0x4a7a3e,
  asphalt: 0x33363c,
  buildingGlass: 0x9fc4d8,
};

// Ring course: eight glowing gates in a loop around the city, harbour and bridge.
export const RING_COURSE = [
  { name: 'Runway Gate', x: 0, y: 95, z: -120 },
  { name: 'Downtown East', x: 240, y: 115, z: -380 },
  { name: 'Downtown West', x: -200, y: 135, z: -560 },
  { name: 'Harbor Mouth', x: 640, y: 85, z: -420 },
  { name: 'Bridge Span', x: 820, y: 105, z: -660 },
  { name: 'North Ridge', x: 320, y: 75, z: -880 },
  { name: 'West Hills', x: -380, y: 125, z: -260 },
  { name: 'Home Straight', x: 120, y: 65, z: 240 },
];

export const RING_RADIUS = 18;

// Deterministic layout seed: the same city every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dampFactor(rate, dt) {
  return 1 - Math.exp(-rate * dt);
}

// Height of the terrain at (x, z). City and runway apron are flat;
// the north and west rise into hills, the east falls away to the bay.
export function groundHeight(x, z) {
  let h = 0;
  if (z < -850) h += Math.min(140, (-850 - z) * 0.12);
  if (x < -700) h += Math.min(90, (-700 - x) * 0.1);
  if (x > 420) h -= Math.min(6, (x - 420) * 0.08);
  const outsideCity = x < -450 || x > 450 || z < -800 || z > 320;
  if (outsideCity) h += Math.sin(x * 0.01) * Math.cos(z * 0.013) * 1.5;
  return h;
}

export function isOverWater(x, z) {
  return x > 470 && z > -1150 && z < 520;
}

export function isOverRunway(x, z) {
  return (
    Math.abs(x - RUNWAY.x) <= RUNWAY.halfWidth &&
    z >= RUNWAY.zMin &&
    z <= RUNWAY.zMax
  );
}

export function formatHeading(degrees) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const d = ((degrees % 360) + 360) % 360;
  return `${String(Math.round(d)).padStart(3, '0')}° ${names[Math.round(d / 45) % 8]}`;
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
