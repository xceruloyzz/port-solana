// World generation for Port Solana: road grid, city blocks, buildings, harbor,
// parked + traffic cars, pedestrians, and the pistol pickup. All seeded.
import { WORLD_W, WORLD_H, WATER_Y, ROAD_W, ROAD_XS, ROAD_YS, BUILDING_COLORS, NEON_COLORS, CAR_COLORS } from './config.js';

export function isOnRoadX(x) { return ROAD_XS.some((rx) => Math.abs(x - rx) < ROAD_W / 2); }
export function isOnRoadY(y) { return ROAD_YS.some((ry) => Math.abs(y - ry) < ROAD_W / 2); }
export function isRoad(x, y) { return isOnRoadX(x) || isOnRoadY(y); }
export function isWater(x, y) { return y > WATER_Y + 30; }

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
        buildings.push({ x, y, w, h, color: rng.pick(BUILDING_COLORS), neon: rng.pick(NEON_COLORS), floors: rng.int(3, 9), sign: rng.chance(0.4) });
      }
    }
  }
  for (const rx of ROAD_XS) for (let y = 90; y < WATER_Y; y += 170) lights.push({ x: rx - ROAD_W / 2 - 10, y });
  for (const ry of ROAD_YS) for (let x = 90; x < WORLD_W; x += 190) lights.push({ x, y: ry - ROAD_W / 2 - 10 });

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
  // Parked cars along road edges.
  for (let i = 0; i < 26; i++) {
    const p = roadPoint(rng);
    cars.push({ id: carId++, x: p.x, y: p.y, angle: rng.chance(0.5) ? 0 : Math.PI / 2, speed: 0, color: rng.pick(CAR_COLORS), parked: true, traffic: false, hp: 100, marked: false, skid: [] });
  }
  // Moving traffic: each car runs along one road, turns at intersections sometimes.
  for (let i = 0; i < 16; i++) {
    const horiz = rng.chance(0.5);
    const dir = rng.chance(0.5) ? 1 : -1;
    const lane = 22 * dir;
    const c = { id: carId++, x: 0, y: 0, angle: 0, speed: rng.range(55, 95), color: rng.pick(CAR_COLORS), parked: false, traffic: true, hp: 100, marked: false, horiz, dir, skid: [] };
    if (horiz) { c.y = rng.pick(ROAD_YS) + lane; c.x = rng.range(80, WORLD_W - 80); c.angle = dir > 0 ? 0 : Math.PI; }
    else { c.x = rng.pick(ROAD_XS) + lane; c.y = rng.range(80, WATER_Y - 80); c.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    cars.push(c);
  }
  // The specific car mission 2 asks for: a gold coupe near the east side.
  const markedCar = { id: carId++, x: 2220, y: 640, angle: 0, speed: 0, color: '#ffd700', parked: true, traffic: false, hp: 100, marked: true, skid: [] };
  cars.push(markedCar);

  const peds = [];
  for (let i = 0; i < 34; i++) {
    const p = roadPoint(rng);
    peds.push({ x: p.x + rng.range(-46, 46), y: p.y + rng.range(-46, 46), angle: rng.range(0, Math.PI * 2), speed: rng.range(22, 42), hp: 30, flee: 0, color: rng.pick(NEON_COLORS), wander: rng.range(1, 4) });
  }
  const garage = { x: 290, y: 220 };
  const harbor = { x: 1500, y: 2010 };
  const weapon = { x: 1220, y: 1120, taken: false }; // alley by the central crossing
  return { buildings, lights, cars, peds, garage, harbor, weapon, markedCar, collidesBuilding, roadPoint, worldW: WORLD_W, worldH: WORLD_H };
}
