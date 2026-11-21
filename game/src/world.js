// World generation for Port Solana v3: the same road grid, garage, harbor and
// mission points as v2, but the blocks between the avenues now form THREE
// distinct districts — a neon downtown of tall towers, industrial docklands
// along the south-east harbor, and a low beach/residential quarter with a sand
// beach on the south-west waterfront. Buildings carry procedural façade data
// (window seed, roof props, awnings, signage), streets gain props (benches,
// hydrants, bushes, containers, crates, beach umbrellas), and each district
// has hand-placed landmarks. All seeded and deterministic.
import { WORLD_W, WORLD_H, WATER_Y, ROAD_W, ROAD_XS, ROAD_YS, BUILDING_COLORS, NEON_COLORS, CAR_COLORS, TAXI_COLOR, PED_COLORS, BILLBOARDS, DOWNTOWN_COLORS, RESIDENTIAL_COLORS, DOCKLAND_COLORS, CONTAINER_COLORS, DISTRICT_SIGN_TEXT } from './config.js';

export function isOnRoadX(x) { return ROAD_XS.some((rx) => Math.abs(x - rx) < ROAD_W / 2); }
export function isOnRoadY(y) { return ROAD_YS.some((ry) => Math.abs(y - ry) < ROAD_W / 2); }
export function isRoad(x, y) { return isOnRoadX(x) || isOnRoadY(y); }
export function isWater(x, y) { return y > WATER_Y + 30; }

// District layout (kept coherent with the road grid so missions, spawns and
// traffic are untouched): downtown is the central-north tower cluster, the
// docklands are the southern strip east of x=1400, and everything else —
// including the beach strip west of x=1400 — is the beach/residential quarter.
export const BEACH_X = 1400; // beach (west) | docklands (east) split on the waterfront
export const DOCK_Y = 1480; // southern strip boundary
export function districtAt(x, y) {
  if (y >= DOCK_Y) return x < BEACH_X ? 'residential' : 'docklands';
  if (x >= 2520) return 'docklands'; // east industrial fringe along the port
  if (x >= 950 && x < 2350 && y < 1250) return 'downtown';
  return 'residential';
}
export function isBeach(x, y) { return x < BEACH_X && y > WATER_Y - 54 && y <= WATER_Y + 6; }

// Lighten (f>0) or darken (f<0) a #rrggbb color; used for roof / trim shades.
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// Hand-placed neon chip spots, spread across the whole road grid.
const CHIP_SPOTS = [
  [720, 220], [1720, 220], [2720, 670], [2220, 1120], [1220, 1570], [720, 1950],
  [220, 1120], [2720, 1570], [1220, 670], [1720, 1950], [470, 670], [2470, 1950],
];

export function createWorld(rng) {
  const buildings = [];
  const lights = [];
  const overlaps = (x, y, w, h, pad = 5) => buildings.some((b) => x - pad < b.x + b.w && x + w + pad > b.x && y - pad < b.y + b.h && y + h + pad > b.y);

  function addBuilding(o) {
    o.roofColor = shade(o.color, o.warehouse ? 0.10 : 0.16);
    o.trimColor = shade(o.color, -0.22);
    buildings.push(o);
    return o;
  }
  // Try to place a building inside a block without overlapping its neighbours;
  // late tries shrink the footprint, and the first building in a block always
  // lands (falling back to overlap rather than leaving the block empty).
  function placeInBlock(bx, by, bw, bh, w, h, strict) {
    let cw = w, ch = h;
    for (let t = 0; t < 14; t++) {
      if (t === 9) { cw *= 0.78; ch *= 0.78; }
      const x = bx + rng.range(2, Math.max(3, bw - cw - 2));
      const y = by + rng.range(2, Math.max(3, bh - ch - 2));
      if (!overlaps(x, y, cw, ch, 3)) return { x, y, w: cw, h: ch };
      if (!strict && t === 13) return { x, y, w: cw, h: ch };
    }
    return null;
  }

  // Slot placement for towers / warehouses: split the block into n columns
  // (or rows) and centre one building per slot — packs densely, never overlaps.
  function placeSlotted(bx, by, bw, bh, n, vertical, wf, hf) {
    const out = [];
    for (let k = 0; k < n; k++) {
      const sw = vertical ? bw / n : bw, sh = vertical ? bh : bh / n;
      const sx = vertical ? bx + sw * k : bx, sy = vertical ? by : by + sh * k;
      const w = Math.max(42, Math.min(sw * rng.range(wf[0], wf[1]), sw - 8));
      const h = Math.max(38, Math.min(sh * rng.range(hf[0], hf[1]), sh - 8));
      out.push({ x: sx + (sw - w) / 2 + rng.range(-3, 3), y: sy + (sh - h) / 2 + rng.range(-3, 3), w, h });
    }
    return out;
  }

  // City blocks sit between roads. Landmark blocks (by block index) get a
  // single hand-placed anchor building instead of the random fill:
  //   (3,1) SOLANA SPIRE helipad tower · (1,4) PALM COURT HOTEL
  //   (4,4) VOSS FREIGHT TERMINAL · (3,4) container yard + dock office
  const LANDMARK_BLOCKS = { '3,1': 'spire', '1,4': 'hotel', '4,4': 'terminal', '3,4': 'yard' };
  let yard = null;
  const xEdges = [40, ...ROAD_XS.flatMap((x) => [x + ROAD_W / 2 + 14, x - ROAD_W / 2 - 14]).sort((a, b) => a - b), WORLD_W - 40];
  const yEdges = [40, ...ROAD_YS.flatMap((y) => [y + ROAD_W / 2 + 14, y - ROAD_W / 2 - 14]).sort((a, b) => a - b), WATER_Y - 20];
  for (let i = 0; i + 1 < xEdges.length; i += 2) {
    for (let j = 0; j + 1 < yEdges.length; j += 2) {
      const bx = xEdges[i], bw = xEdges[i + 1] - bx, by = yEdges[j], bh = yEdges[j + 1] - by;
      if (bw < 90 || bh < 80) continue;
      const bi = i / 2, bj = j / 2;
      const district = districtAt(bx + bw / 2, by + bh / 2);
      const kind = LANDMARK_BLOCKS[`${bi},${bj}`];
      if (kind === 'spire') {
        addBuilding({
          x: bx + bw / 2 - 85, y: by + bh / 2 - 95, w: 170, h: 190, color: '#232c4a', neon: '#00e5ff',
          floors: 18, sign: true, signText: 'SOLANA SPIRE', billboard: null, district, seed: rng.int(1, 1e9),
          roof: 'helipad', awning: null, warehouse: false, landmark: 'SOLANA SPIRE', litBase: 1,
        });
        continue;
      }
      if (kind === 'hotel') {
        addBuilding({
          x: bx + bw / 2 - 125, y: by + bh / 2 - 60, w: 250, h: 120, color: '#a08059', neon: '#ffd166',
          floors: 3, sign: true, signText: 'PALM COURT', billboard: null, district, seed: rng.int(1, 1e9),
          roof: 'ac', awning: '#ff8a65', warehouse: false, landmark: 'PALM COURT HOTEL', litBase: 0.9,
        });
        continue;
      }
      if (kind === 'terminal') {
        addBuilding({
          x: bx + bw / 2 - 150, y: by + bh / 2 - 85, w: 300, h: 170, color: '#6b4a35', neon: '#ff8a65',
          floors: 2, sign: true, signText: 'VOSS FREIGHT', billboard: null, district, seed: rng.int(1, 1e9),
          roof: 'vents', awning: null, warehouse: true, landmark: 'VOSS FREIGHT TERMINAL', litBase: 0.7,
        });
        continue;
      }
      if (kind === 'yard') {
        yard = { x: bx, y: by, w: bw, h: bh };
        addBuilding({
          x: bx + 8, y: by + 8, w: 92, h: 62, color: '#4e5a5c', neon: '#ffd166',
          floors: 1, sign: true, signText: 'DOCK OFFICE', billboard: null, district, seed: rng.int(1, 1e9),
          roof: 'ac', awning: null, warehouse: true, landmark: null, litBase: 0.7,
        });
        continue;
      }
      // --- ordinary district fill ---
      if (district === 'downtown') {
        const n = bw < 200 ? 1 : rng.int(2, 3);
        for (const p of placeSlotted(bx, by, bw, bh, n, bw >= bh, [0.66, 0.90], [0.55, 0.84])) {
          addBuilding({
            x: p.x, y: p.y, w: p.w, h: p.h, color: rng.pick(DOWNTOWN_COLORS), neon: rng.pick(NEON_COLORS),
            floors: rng.int(8, 15), sign: rng.chance(0.75), signText: rng.pick(DISTRICT_SIGN_TEXT.downtown),
            billboard: rng.chance(0.30) ? rng.pick(BILLBOARDS) : null, district, seed: rng.int(1, 1e9),
            roof: rng.chance(0.45) ? 'wt' : 'ac', awning: rng.chance(0.3) ? rng.pick(NEON_COLORS) : null,
            warehouse: false, landmark: null, litBase: rng.range(0.65, 1),
          });
        }
      } else if (district === 'docklands') {
        const n = bw < 200 ? 1 : 2;
        for (const p of placeSlotted(bx, by, bw, bh, n, false, [0.62, 0.86], [0.58, 0.84])) {
          addBuilding({
            x: p.x, y: p.y, w: p.w, h: p.h, color: rng.pick(DOCKLAND_COLORS), neon: rng.pick(NEON_COLORS),
            floors: rng.int(1, 2), sign: rng.chance(0.5), signText: rng.pick(DISTRICT_SIGN_TEXT.docklands),
            billboard: rng.chance(0.10) ? rng.pick(BILLBOARDS) : null, district, seed: rng.int(1, 1e9),
            roof: 'vents', awning: null, warehouse: true, landmark: null, litBase: rng.range(0.4, 0.7),
          });
        }
      } else {
        // beach / residential: many small low houses with awnings
        const n = bw < 200 ? rng.int(1, 2) : rng.int(5, 7);
        for (let k = 0; k < n; k++) {
          const w = rng.range(50, Math.max(58, Math.min(118, bw * 0.52)));
          const h = rng.range(46, Math.max(54, Math.min(104, bh * 0.46)));
          const p = placeInBlock(bx, by, bw, bh, w, h, k > 0);
          if (!p) continue;
          addBuilding({
            x: p.x, y: p.y, w: p.w, h: p.h, color: rng.pick(RESIDENTIAL_COLORS), neon: rng.pick(NEON_COLORS),
            floors: rng.int(1, 3), sign: rng.chance(0.10), signText: rng.pick(DISTRICT_SIGN_TEXT.residential),
            billboard: rng.chance(0.04) ? rng.pick(BILLBOARDS) : null, district, seed: rng.int(1, 1e9),
            roof: rng.chance(0.3) ? 'ac' : 'none', awning: rng.chance(0.55) ? rng.pick(['#ff8a65', '#00e5ff', '#ffd166', '#69f0ae', '#e2725b']) : null,
            warehouse: false, landmark: null, litBase: rng.range(0.5, 0.9),
          });
        }
      }
    }
  }
  for (const rx of ROAD_XS) for (let y = 90; y < WATER_Y; y += 170) lights.push({ x: rx - ROAD_W / 2 - 10, y });
  for (const ry of ROAD_YS) for (let x = 90; x < WORLD_W; x += 190) lights.push({ x, y: ry - ROAD_W / 2 - 10 });

  // ---------- vegetation: palms + bushes ----------
  const palms = [];
  // Beach promenade row (dense, along the sand) + the v2 avenue rows.
  for (let x = 84; x < BEACH_X - 30; x += 74) palms.push({ x: x + rng.range(-10, 10), y: WATER_Y - 66 + rng.range(-5, 5), s: rng.range(0.9, 1.3) });
  for (let x = 110; x < WORLD_W - 60; x += 128) palms.push({ x: x + rng.range(-14, 14), y: WATER_Y - 44 + rng.range(-6, 6), s: rng.range(0.85, 1.2) });
  for (let y = 330; y < WATER_Y - 120; y += 250) {
    palms.push({ x: 1220 - ROAD_W / 2 - 17, y: y + rng.range(-16, 16), s: rng.range(0.85, 1.15) });
    palms.push({ x: 1220 + ROAD_W / 2 + 17, y: y + 120 + rng.range(-16, 16), s: rng.range(0.85, 1.15) });
  }
  for (let y = 330; y < WATER_Y - 120; y += 330) palms.push({ x: 1720 - ROAD_W / 2 - 17, y: y + rng.range(-16, 16), s: rng.range(0.85, 1.15) });
  for (let y = 300; y < WATER_Y - 160; y += 300) palms.push({ x: 720 + ROAD_W / 2 + 17, y: y + rng.range(-16, 16), s: rng.range(0.8, 1.1) });
  // A palm or two inside residential blocks, clear of the houses.
  for (let i = 0; i + 1 < xEdges.length; i += 2) {
    for (let j = 0; j + 1 < yEdges.length; j += 2) {
      const bx = xEdges[i], bw = xEdges[i + 1] - bx, by = yEdges[j], bh = yEdges[j + 1] - by;
      if (bw < 90 || bh < 80 || districtAt(bx + bw / 2, by + bh / 2) !== 'residential') continue;
      for (let t = 0; t < 3; t++) {
        const x = bx + rng.range(14, bw - 14), y = by + rng.range(14, bh - 14);
        if (!overlaps(x - 12, y - 12, 24, 24, 2)) { palms.push({ x, y, s: rng.range(0.75, 1.05) }); break; }
      }
    }
  }
  // Bushes: clustered in residential blocks, a few planters downtown.
  const bushes = [];
  for (let i = 0; i + 1 < xEdges.length; i += 2) {
    for (let j = 0; j + 1 < yEdges.length; j += 2) {
      const bx = xEdges[i], bw = xEdges[i + 1] - bx, by = yEdges[j], bh = yEdges[j + 1] - by;
      if (bw < 90 || bh < 80) continue;
      const d = districtAt(bx + bw / 2, by + bh / 2);
      const tries = d === 'residential' ? 4 : d === 'downtown' ? 2 : 0;
      for (let t = 0; t < tries; t++) {
        const x = bx + rng.range(10, bw - 10), y = by + rng.range(10, bh - 10);
        if (!overlaps(x - 10, y - 8, 20, 16, 1)) bushes.push({ x, y, s: rng.range(0.7, 1.4) });
      }
    }
  }

  // ---------- street props ----------
  const benches = [];
  for (const rx of ROAD_XS) {
    for (let y = 150 + rng.range(0, 60); y < WATER_Y - 90; y += rng.range(215, 310)) {
      benches.push({ x: rx + (rng.chance(0.5) ? -ROAD_W / 2 - 11 : ROAD_W / 2 + 11), y, vert: true });
    }
  }
  for (const ry of ROAD_YS) {
    for (let x = 320 + rng.range(0, 80); x < WORLD_W - 120; x += rng.range(300, 430)) {
      benches.push({ x, y: ry - ROAD_W / 2 - 11, vert: false });
    }
  }
  const hydrants = [];
  for (const rx of ROAD_XS) for (const ry of ROAD_YS) {
    if (!rng.chance(0.45)) continue;
    const sx = rng.chance(0.5) ? 1 : -1, sy = rng.chance(0.5) ? 1 : -1;
    hydrants.push({ x: rx + sx * (ROAD_W / 2 + 9), y: ry + sy * (ROAD_W / 2 + 9) });
  }
  // Containers: a gridded yard in the docklands landmark block, a row along
  // the east harbor edge, and scattered stacks inside docklands blocks.
  const containers = [];
  const contHit = (x, y, w, h) => containers.some((c) => x - 4 < c.x + c.w && x + w + 4 > c.x && y - 4 < c.y + c.h && y + h + 4 > c.y);
  if (yard) {
    for (let gx = yard.x + 118; gx + 46 < yard.x + yard.w - 6; gx += 54) {
      for (let gy = yard.y + 14; gy + 22 < yard.y + yard.h - 6; gy += 34) {
        if (rng.chance(0.15)) continue;
        containers.push({ x: gx, y: gy, w: 46, h: 22, color: rng.pick(CONTAINER_COLORS), stack: rng.chance(0.3) ? 1 : 0 });
      }
    }
  }
  for (let x = 1470; x < WORLD_W - 90; x += 96) {
    if (rng.chance(0.18)) continue;
    containers.push({ x: x + rng.range(-6, 6), y: WATER_Y - 40 + rng.range(-4, 4), w: 52, h: 24, color: rng.pick(CONTAINER_COLORS), stack: rng.chance(0.35) ? 1 : 0 });
  }
  for (let t = 0; t < 30; t++) {
    const x = rng.range(BEACH_X + 40, WORLD_W - 120), y = rng.range(DOCK_Y + 30, WATER_Y - 130);
    // the whole 48x24 footprint must sit off-road (centre + corners), clear of
    // buildings and other containers
    if (districtAt(x, y) !== 'docklands' || isRoad(x, y) || isRoad(x + 48, y) || isRoad(x, y + 24) || isRoad(x + 48, y + 24) || overlaps(x, y, 48, 24, 6) || contHit(x, y, 48, 24)) continue;
    containers.push({ x, y, w: 48, h: 24, color: rng.pick(CONTAINER_COLORS), stack: rng.chance(0.3) ? 1 : 0 });
  }
  // Crates clustered at warehouse doors.
  const crates = [];
  for (const b of buildings) {
    if (!b.warehouse) continue;
    const n = rng.int(0, 3);
    for (let k = 0; k < n; k++) crates.push({ x: b.x + rng.range(4, Math.max(5, b.w - 18)), y: b.y + b.h + rng.range(3, 9), s: rng.range(10, 16) });
  }
  // Beach umbrellas on the sand.
  const umbrellas = [];
  for (let x = 92; x < BEACH_X - 60; x += 96) {
    if (rng.chance(0.2)) continue;
    umbrellas.push({ x: x + rng.range(-16, 16), y: WATER_Y - 26 + rng.range(-8, 8), color: rng.pick(NEON_COLORS), s: rng.range(0.85, 1.2) });
  }

  // Harbor life: bobbing boats on the water and dock crane silhouettes,
  // now all along the industrial (east) waterfront.
  const boats = [];
  for (let i = 0; i < 6; i++) boats.push({ x: rng.range(180, WORLD_W - 180), y: WATER_Y + rng.range(56, 168), phase: rng.range(0, Math.PI * 2), color: rng.pick(['#e8ecff', '#ff8a65', '#69f0ae', '#ffd166', '#7fd4ff']) });
  const cranes = [{ x: 1560, dir: -1 }, { x: 2050, dir: 1 }, { x: 2560, dir: -1 }];

  // District landmarks for the minimap + world labels. The lighthouse is a
  // prop on the beach (not a building); the others sit on their buildings.
  const spire = buildings.find((b) => b.landmark === 'SOLANA SPIRE');
  const hotel = buildings.find((b) => b.landmark === 'PALM COURT HOTEL');
  const terminal = buildings.find((b) => b.landmark === 'VOSS FREIGHT TERMINAL');
  const landmarks = [
    { x: 150, y: 2032, name: 'SUNSET LIGHTHOUSE', kind: 'lighthouse', district: 'residential' },
    ...(hotel ? [{ x: hotel.x + hotel.w / 2, y: hotel.y + hotel.h / 2, name: 'PALM COURT HOTEL', kind: 'hotel', district: 'residential' }] : []),
    ...(spire ? [{ x: spire.x + spire.w / 2, y: spire.y + spire.h / 2, name: 'SOLANA SPIRE', kind: 'spire', district: 'downtown' }] : []),
    ...(terminal ? [{ x: terminal.x + terminal.w / 2, y: terminal.y + terminal.h / 2, name: 'VOSS FREIGHT TERMINAL', kind: 'terminal', district: 'docklands' }] : []),
  ];

  function collidesBuilding(x, y, r) {
    for (const b of buildings) if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    return null;
  }
  function roadPoint(rng2) {
    if (rng2.chance(0.5)) return { x: rng2.pick(ROAD_XS) + rng2.range(-20, 20), y: rng2.range(80, WATER_Y - 60) };
    return { x: rng2.range(80, WORLD_W - 80), y: rng2.pick(ROAD_YS) + rng2.range(-20, 20) };
  }

  const cars = [];
  let carId = 1;
  // Vehicle variety: mostly sedans, some yellow taxis, some long vans/trucks.
  function styleCar(c) {
    const roll = rng.next();
    if (roll < 0.15) { c.len = 64; c.wid = 27; c.truck = true; } // van / truck
    else if (roll < 0.33) { c.taxi = true; c.color = TAXI_COLOR; c.len = 48; c.wid = 24; }
    else { c.len = 48; c.wid = 24; }
    return c;
  }
  // Parked cars along road edges.
  for (let i = 0; i < 36; i++) {
    const p = roadPoint(rng);
    cars.push(styleCar({ id: carId++, x: p.x, y: p.y, angle: rng.chance(0.5) ? 0 : Math.PI / 2, speed: 0, color: rng.pick(CAR_COLORS), parked: true, traffic: false, hp: 100, marked: false, wrecked: false, skid: [] }));
  }
  // Moving traffic: each car runs along one road, turns at intersections sometimes.
  for (let i = 0; i < 26; i++) {
    const horiz = rng.chance(0.5);
    const dir = rng.chance(0.5) ? 1 : -1;
    const lane = 22 * dir;
    const c = styleCar({ id: carId++, x: 0, y: 0, angle: 0, speed: rng.range(55, 95), color: rng.pick(CAR_COLORS), parked: false, traffic: true, hp: 100, marked: false, wrecked: false, horiz, dir, skid: [] });
    if (horiz) { c.y = rng.pick(ROAD_YS) + lane; c.x = rng.range(80, WORLD_W - 80); c.angle = dir > 0 ? 0 : Math.PI; }
    else { c.x = rng.pick(ROAD_XS) + lane; c.y = rng.range(80, WATER_Y - 80); c.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    cars.push(c);
  }
  // The specific car mission 2 asks for: a gold coupe near the east side.
  const markedCar = { id: carId++, x: 2220, y: 640, angle: 0, speed: 0, color: '#ffd700', parked: true, traffic: false, hp: 100, marked: true, wrecked: false, len: 48, wid: 24, skid: [] };
  cars.push(markedCar);

  const peds = [];
  for (let i = 0; i < 56; i++) {
    const p = roadPoint(rng);
    peds.push({ x: p.x + rng.range(-46, 46), y: p.y + rng.range(-46, 46), angle: rng.range(0, Math.PI * 2), speed: rng.range(22, 42), hp: 30, flee: 0, color: rng.pick(PED_COLORS), wander: rng.range(1, 4), boarded: false });
  }
  const chips = CHIP_SPOTS.map(([x, y], i) => ({ id: i, x, y, taken: false }));
  const garage = { x: 290, y: 220 };
  const harbor = { x: 1500, y: 2010 };
  const weapon = { x: 1220, y: 1120, taken: false }; // alley by the central crossing
  const props = { benches, hydrants, bushes, containers, crates, umbrellas };
  return { buildings, lights, cars, peds, palms, boats, cranes, chips, garage, harbor, weapon, markedCar, props, landmarks, yard, collidesBuilding, roadPoint, worldW: WORLD_W, worldH: WORLD_H };
}
