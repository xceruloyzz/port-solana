// Deterministic atmosphere for Port Solana v3: a day-night cycle and a rain
// schedule that are PURE functions of the simulation time (S.time, advanced in
// fixed STEP increments) and the world seed. No wall clock, no Math.random —
// the same seed at the same sim tick always yields the same sky, so staged
// screenshots and replays stay byte-stable.

// Seconds of sim time per full day-night cycle.
export const DAY_LENGTH = 300;
// Seconds per weather block; each block's rain is decided by a seeded hash.
export const WEATHER_BLOCK = 80;

// Integer hash -> [0,1). Stable across runs and platforms.
export function hash01(n) {
  let x = Math.imul(n ^ (n >>> 16), 2246822519);
  x = Math.imul(x ^ (x >>> 13), 3266489917);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

// Keyframes around the cycle. tint is an RGB grade washed over the world,
// dark is a 0..1 night darkness, glow drives streetlight / sign glow, and
// lit is the fraction of building windows lit.
const KEYS = [
  { p: 0.00, name: 'DAWN', dark: 0.16, glow: 0.38, lit: 0.55, tint: [255, 150, 110], tintA: 0.10 },
  { p: 0.16, name: 'DAY', dark: 0.00, glow: 0.00, lit: 0.26, tint: [255, 224, 168], tintA: 0.03 },
  { p: 0.40, name: 'GOLDEN HOUR', dark: 0.05, glow: 0.25, lit: 0.45, tint: [255, 150, 60], tintA: 0.15 },
  { p: 0.56, name: 'DUSK', dark: 0.30, glow: 0.72, lit: 0.72, tint: [150, 80, 160], tintA: 0.13 },
  { p: 0.70, name: 'NIGHT', dark: 0.52, glow: 1.00, lit: 0.86, tint: [30, 40, 110], tintA: 0.16 },
  { p: 0.88, name: 'NIGHT', dark: 0.44, glow: 1.00, lit: 0.80, tint: [24, 32, 96], tintA: 0.14 },
];

function lerp(a, b, t) { return a + (b - a) * t; }

// Atmosphere at a sim time. time=0 lands exactly on GOLDEN HOUR (the v2 look),
// so the staged ?shot scenes keep their sunset grade and stay rain-free.
export function getAtmosphere(time, seed = 7) {
  const t = Math.max(0, time || 0);
  const phase = (t / DAY_LENGTH + 0.40) % 1; // t>=0, so no negative wrap needed
  // Find the surrounding keyframes (wrapping from the last back to DAWN+1).
  let a = KEYS[KEYS.length - 1], b = KEYS[0], span = 1;
  for (let i = 0; i < KEYS.length; i++) {
    const k0 = KEYS[i], k1 = KEYS[(i + 1) % KEYS.length];
    const p0 = k0.p, p1 = i + 1 < KEYS.length ? k1.p : 1;
    const inSeg = i + 1 < KEYS.length ? (phase >= p0 && phase < p1) : (phase >= p0 || phase < KEYS[0].p);
    if (inSeg) {
      a = k0; b = k1; span = p1 - p0;
      const local = phase >= p0 ? phase - p0 : phase + 1 - p0;
      const f = span > 0 ? local / span : 0;
      return finish(t, seed, phase, a, b, f);
    }
  }
  return finish(t, seed, phase, a, b, 0);
}

function finish(t, seed, phase, a, b, f) {
  // Rain: seeded per weather block, with a 6s fade in/out at block edges.
  // Block 0 is always dry so title / screenshot scenes open under clear skies.
  const block = Math.floor(t / WEATHER_BLOCK);
  const inBlock = t - block * WEATHER_BLOCK;
  let rain = 0;
  if (block > 0) {
    const h = hash01(Math.imul(seed + 1, 1000003) ^ Math.imul(block, 2654435761));
    if (h < 0.38) rain = Math.max(0, Math.min(1, inBlock / 6, (WEATHER_BLOCK - inBlock) / 6));
  }
  return {
    phase,
    name: a.name,
    darkness: lerp(a.dark, b.dark, f),
    glow: lerp(a.glow, b.glow, f),
    windowLit: lerp(a.lit, b.lit, f),
    tint: [lerp(a.tint[0], b.tint[0], f), lerp(a.tint[1], b.tint[1], f), lerp(a.tint[2], b.tint[2], f)],
    tintA: lerp(a.tintA, b.tintA, f),
    rain,
    raining: rain > 0.03,
  };
}
