// World generation for Port Solana: road grid, city blocks, buildings with
// billboards, harbor with boats and cranes, palm trees, crosswalks are drawn
// from the grid, parked + traffic cars (with taxis and trucks), pedestrians,
// neon chips, and the pistol pickup. All seeded and deterministic.
import { WORLD_W, WORLD_H, WATER_Y, ROAD_W, ROAD_XS, ROAD_YS, BUILDING_COLORS, NEON_COLORS, CAR_COLORS, TAXI_COLOR, PED_COLORS, BILLBOARDS } from './config.js';

export function isOnRoadX(x) { return ROAD_XS.some((rx) => Math.abs(x - rx) < ROAD_W / 2); }
export function isOnRoadY(y) { return ROAD_YS.some((ry) => Math.abs(y - ry) < ROAD_W / 2); }
export function isRoad(x, y) { return isOnRoadX(x) || isOnRoadY(y); }
export function isWater(x, y) { return y > WATER_Y + 30; }

// Hand-placed neon chip spots, spread across the whole road grid.
const CHIP_SPOTS = [
  [720, 220], [1720, 220], [2720, 670], [2220, 1120], [1220, 1570], [720, 1950],
  [220, 1120], [2720, 1570], [1220, 670], [1720, 1950], [470, 670], [2470, 1950],
];

export function createWorld(rng) {
  const buildings = [];
  const lights = [];
  // City blocks sit between roads; fill each block with 2-4 varied buildings.
  const xEdges = [40, ...ROAD_XS.flatMap((x) => [x + ROAD_W / 2 + 14, x - ROAD_W / 2 - 14]).sort((a, b) => a - b), WORLD_W - 40];
  const yEdges = [40, ...ROAD_YS.flatMap((y) => [y + ROAD_W / 2 + 14, y - ROAD_W / 2 - 14]).sort((a, b) => a - b), WATER_Y - 20];
  for (let i = 0; i + 1 < xEdges.length; i += 2) {
    for (let j = 0; j + 1 < yEdges.length; j += 2) {
      const bx = xEdges[i], bw = xEdges[i + 1] - bx, by = yEdges[j], bh = yEdges[j + 1] - by;
      if (bw < 90 || bh < 80) continue;
      const n = rng.int(3, 5);
      for (let k = 0; k < n; k++) {
        const w = rng.range(80, Math.max(90, bw * 0.62));
        const h = rng.range(70, Math.max(80, bh * 0.62));
        const x = bx + rng.range(2, Math.max(3, bw - w - 2));
        const y = by + rng.range(2, Math.max(3, bh - h - 2));
        buildings.push({
          x, y, w, h, color: rng.pick(BUILDING_COLORS), neon: rng.pick(NEON_COLORS),
          floors: rng.int(3, 9), sign: rng.chance(0.4),
          billboard: rng.chance(0.17) ? rng.pick(BILLBOARDS) : null,
        });
      }
    }
  }
  for (const rx of ROAD_XS) for (let y = 90; y < WATER_Y; y += 170) lights.push({ x: rx - ROAD_W / 2 - 10, y });
  for (const ry of ROAD_YS) for (let x = 90; x < WORLD_W; x += 190) lights.push({ x, y: ry - ROAD_W / 2 - 10 });

  // Palm trees: a promenade row along the waterfront plus rows flanking the
  // central avenue and the harbor avenue.
  const palms = [];
  for (let x = 110; x < WORLD_W - 60; x += 128) palms.push({ x: x + rng.range(-14, 14), y: WATER_Y - 44 + rng.range(-6, 6), s: rng.range(0.85, 1.2) });
  for (let y = 330; y < WATER_Y - 120; y += 250) {
    palms.push({ x: 1220 - ROAD_W / 2 - 17, y: y + rng.range(-16, 16), s: rng.range(0.85, 1.15) });
    palms.push({ x: 1220 + ROAD_W / 2 + 17, y: y + 120 + rng.range(-16, 16), s: rng.range(0.85, 1.15) });
  }
  for (let y = 330; y < WATER_Y - 120; y += 330) palms.push({ x: 1720 - ROAD_W / 2 - 17, y: y + rng.range(-16, 16), s: rng.range(0.85, 1.15) });

  // Harbor life: bobbing boats on the water and dock crane silhouettes.
  const boats = [];
  for (let i = 0; i < 6; i++) boats.push({ x: rng.range(180, WORLD_W - 180), y: WATER_Y + rng.range(56, 168), phase: rng.range(0, Math.PI * 2), color: rng.pick(['#e8ecff', '#ff8a65', '#69f0ae', '#ffd166', '#7fd4ff']) });
  const cranes = [{ x: 640, dir: 1 }, { x: 1500, dir: -1 }, { x: 2360, dir: 1 }];

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
  return { buildings, lights, cars, peds, palms, boats, cranes, chips, garage, harbor, weapon, markedCar, collidesBuilding, roadPoint, worldW: WORLD_W, worldH: WORLD_H };
}
