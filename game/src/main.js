// PORT SOLANA: Neon Harbor — main orchestration: game state, player on foot +
// driving, traffic and pedestrian updates, combat, mission flow, taxi fares,
// neon chips, HUD state, and the localStorage save. Vanilla JS ES modules.
import { WORLD_W, WORLD_H, WATER_Y, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, isRoad, isWater } from './world.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { createPolice } from './police.js';
import { getAtmosphere } from './atmosphere.js';
import { MISSIONS, DIALOGUE, HARBOR_CHECKPOINTS, RUSH_DROPS, RUSH_TIME, BUYER, TAIL_ROUTE, TAIL_SPEED, TAIL_MIN, TAIL_MAX, ROADBLOCKS, CARGO, PIER } from './missions.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;
const rng = createRandom(seed);
const canvas = document.getElementById('game');
const mini = document.getElementById('minimap');
const status = document.getElementById('status');
const input = createInput(canvas);
const renderer = createRenderer(canvas, mini);
const world = createWorld(createRandom(seed));
const audio = createAudio();
const effects = createEffects(createRandom(seed ^ 0x9e3779b9)); // own stream: sim RNG stays pure

// ---------- state ----------
const S = {
  world, seed, screen: 'title', hasSave: false, effects,
  player: { x: 720, y: 670, angle: 0, hp: 100, car: null, speedNow: 0 },
  police: [], bullets: [], money: 0, wanted: 0, armed: false, ammo: 0,
  missionIdx: 0, missionTitle: '', objective: '', dialogue: '', target: null,
  msg: '', msgTimer: 0, muzzle: 0, bustedMeter: 0, hideTimer: 0, seenTimer: 0,
  stage: 0, timer: 0, checkpoints: [], cpIdx: 0, drops: [], dropIdx: 0, hasPackage: false,
  tail: null, tailResets: 0, roadblocks: [], cargo: [], cargoIdx: 0,
  hitStop: 0, pendingEnd: null, flashT: 0, tick: 0,
  chipsCollected: 0, taxiCount: 0, taxiEarned: 0, chipBonus6: false, chipBonus12: false,
  taxi: { state: 'idle', ped: null, dest: null, t: 0, cool: 0 },
  banners: [], time: 0, sirenNear: false,
  spawnPolice: null, refreshMission,
};
const cam = { x: 0, y: 0 };
const police = createPolice({ S, rng, blockedAt, crime, flash, audio, effects });
S.spawnPolice = police.spawn;

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 3, money: S.money, missionIdx: S.missionIdx, x: S.player.x, y: S.player.y,
      chips: world.chips.filter((c) => c.taken).map((c) => c.id),
      taxiCount: S.taxiCount, taxiEarned: S.taxiEarned,
    }));
  } catch { /* ignore */ }
}
function loadSave() {
  try { const raw = window.localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
S.hasSave = !!loadSave();

function flash(msg) { S.msg = msg; S.msgTimer = 3; }
function pushBanner(title, sub, dur = 2.5) { S.banners.push({ title, sub, t: dur, dur }); if (S.banners.length > 3) S.banners.shift(); }
function crime(amount, x, y) {
  // A crime counts double if a ped or police car is watching nearby.
  let witnessed = false;
  for (const p of world.peds) if (p.hp > 0 && Math.hypot(p.x - x, p.y - y) < 260) witnessed = true;
  for (const c of S.police) if (Math.hypot(c.x - x, c.y - y) < 380) witnessed = true;
  if (witnessed || amount >= 1) S.wanted = Math.min(5, S.wanted + amount);
  S.hideTimer = 0;
}
function refreshMission() {
  if (S.missionIdx >= MISSIONS.length) {
    S.missionTitle = 'FREE ROAM — Port Solana is yours';
    S.objective = 'Side activities: TAXI SHIFTS (fares + milestone bonuses) · NEON CHIPS (collect all 12).';
    S.dialogue = DIALOGUE[MISSIONS.length];
    S.target = null; return;
  }
  const m = MISSIONS[S.missionIdx];
  S.missionTitle = m.title; S.objective = m.obj;
  S.dialogue = DIALOGUE[S.missionIdx];
  if (S.missionIdx === 0) S.target = { ...world.garage };
  else if (S.missionIdx === 1) S.target = S.stage === 0 ? { x: world.markedCar.x, y: world.markedCar.y } : { ...world.garage };
  else if (S.missionIdx === 2) S.target = null;
  else if (S.missionIdx === 3) S.target = S.checkpoints[S.cpIdx] || null;
  else if (S.missionIdx === 4) S.target = S.drops[S.dropIdx] || null;
  else if (S.missionIdx === 5) S.target = S.tail ? { x: S.tail.x, y: S.tail.y } : { ...TAIL_ROUTE[0] };
  else if (S.missionIdx === 6) S.target = S.stage === 0 ? { ...world.harbor } : { ...BUYER };
  else if (S.missionIdx === 7) S.target = { ...world.garage };
  else if (S.missionIdx === 8) {
    if (S.stage === 0) S.target = { x: world.boat.x, y: world.harbor.y };
    else if (S.stage === 1) S.target = S.cargo[S.cargoIdx] || { ...PIER };
    else S.target = { ...PIER };
  }
  else if (S.missionIdx === 9) S.target = S.stage === 0 ? { ...world.harbor } : { ...world.garage };
}
// --- v3 mission setups ---
function startTail() {
  const s = TAIL_ROUTE[0];
  S.tail = { x: s.x, y: s.y, angle: 0, wpIdx: 1, spook: 0, lost: 0, arrived: false, engaged: false };
}
function startRoadblocks() {
  S.roadblocks = ROADBLOCKS.map((r) => ({ ...r, hp: 120 }));
  S.wanted = Math.max(S.wanted, 4);
}
function startCargo() {
  S.cargo = CARGO.map((c) => ({ ...c, taken: false }));
  S.cargoIdx = 0;
}
function completeMission() {
  const m = MISSIONS[S.missionIdx];
  const doneIdx = S.missionIdx;
  const pay = m.pay;
  S.money += pay;
  effects.popup(S.player.x, S.player.y - 34, `+$${pay}`, '#69f0ae');
  effects.sparkle(S.player.x, S.player.y);
  pushBanner('MISSION COMPLETE', `${m.title} · +$${pay}`);
  audio.jingle();
  if (doneIdx === 5) S.tail = null; // tailing finished
  if (doneIdx === 7) { S.roadblocks = []; flash('Roadblocks cleared — you made it!'); }
  if (doneIdx === 8 && S.player.car && S.player.car.kind === 'boat') disembark(true); // step ashore at the pier
  S.missionIdx += 1; S.stage = 0; S.hasPackage = false;
  if (S.missionIdx === 3) startCheckpoints();
  if (S.missionIdx === 4) startDrops();
  if (S.missionIdx === 5) startTail();
  if (S.missionIdx === 7) startRoadblocks();
  if (S.missionIdx === 8) startCargo();
  if (S.missionIdx >= MISSIONS.length) { S.screen = 'win'; }
  refreshMission();
  if (S.missionIdx < MISSIONS.length) pushBanner(MISSIONS[S.missionIdx].title, MISSIONS[S.missionIdx].obj);
  saveGame();
}
function startCheckpoints() {
  S.checkpoints = HARBOR_CHECKPOINTS.map((c) => ({ ...c }));
  S.cpIdx = 0; S.timer = 75;
}
function startDrops() {
  S.drops = RUSH_DROPS.map((c) => ({ ...c }));
  S.dropIdx = 0; S.timer = RUSH_TIME;
}
function failMissionTimer() {
  flash('Time up! The Harbor Run restarts — hit the checkpoints!');
  startCheckpoints(); refreshMission();
}
function failDropsTimer() {
  flash('Time up! Rush Hour restarts — three drops, fresh clock!');
  startDrops(); refreshMission();
}

// ---------- collisions ----------
function blockedAt(x, y, r) {
  if (x < 20 || y < 20 || x > WORLD_W - 20 || y > WATER_Y + 6) return true;
  if (isWater(x, y)) return true;
  return !!world.collidesBuilding(x, y, r);
}
function moveCircle(ent, dx, dy, r) {
  if (!blockedAt(ent.x + dx, ent.y, r)) ent.x += dx; else if (!blockedAt(ent.x, ent.y + dy, r)) { /* slide */ } else dx = 0;
  if (!blockedAt(ent.x, ent.y + dy, r)) ent.y += dy;
}
// Boats live by the opposite rule: water only, never the shore or a building.
function blockedForBoat(x, y, r) {
  if (x < 26 || y < WATER_Y + 20 || x > WORLD_W - 26 || y > WORLD_H - 26) return true;
  return false;
}
// Nearest dry spot to step onto when leaving the boat (dock, pier, shore).
function shoreSpot(bx, by) {
  const cands = [
    { x: bx, y: WATER_Y - 26 }, { ...world.dock }, { x: PIER.x, y: WATER_Y - 26 },
    { x: bx - 44, y: WATER_Y - 26 }, { x: bx + 44, y: WATER_Y - 26 },
  ];
  for (const c of cands) if (!blockedAt(c.x, c.y, 13)) return c;
  return { ...world.dock };
}
function disembark(atPier = false) {
  const boat = S.player.car;
  if (!boat || boat.kind !== 'boat') return false;
  const spot = atPier ? shoreSpot(PIER.x, PIER.y) : shoreSpot(boat.x, boat.y);
  S.player.car = null; boat.speed = 0; boat.parked = true;
  boat.x = spot.x; boat.y = WATER_Y + 42; boat.angle = 0; // boat drifts in and moors along the shore
  S.player.x = spot.x; S.player.y = spot.y;
  flash('Ashore. The boat moors itself along the shore.');
  return true;
}

// ---------- combat ----------
function attack() {
  input.consume('KeyF'); input.mouse.clicked = false; // one press = one attack, even across multi-step frames
  const p = S.player;
  const aimX = input.mouse.x + cam.x, aimY = input.mouse.y + cam.y;
  const ang = Math.atan2(aimY - p.y, aimX - p.x);
  p.angle = ang;
  if (S.armed && S.ammo > 0) {
    S.ammo -= 1; S.muzzle = 0.07; audio.noise(0.12, 0.16);
    effects.muzzleFx(p.x + Math.cos(ang) * 22, p.y + Math.sin(ang) * 22, ang); // muzzle flash fan
    effects.shell(p.x, p.y); // ejected brass
    effects.addShake(1.2); // recoil kick
    S.bullets.push({ x: p.x + Math.cos(ang) * 20, y: p.y + Math.sin(ang) * 20, vx: Math.cos(ang) * 720, vy: Math.sin(ang) * 720, life: 0.55 });
    crime(1, p.x, p.y);
  } else if (S.armed && S.ammo <= 0) {
    audio.beep(180, 0.06, 'square', 0.05); flash('Out of ammo!');
  } else {
    // punch: hit whatever is in front
    audio.noise(0.05, 0.07);
    const hx = p.x + Math.cos(ang) * 34, hy = p.y + Math.sin(ang) * 34;
    for (const ped of world.peds) if (ped.hp > 0 && !ped.boarded && Math.hypot(ped.x - hx, ped.y - hy) < 26) { hurtPed(ped, 30); crime(1, p.x, p.y); }
    for (const c of S.police) if (Math.hypot(c.x - hx, c.y - hy) < 34) c.hp -= 10;
  }
}
function hurtPed(ped, dmg) {
  ped.hp -= dmg; ped.flee = 3;
  if (ped.hp <= 0) { crime(1, ped.x, ped.y); flash('Pedestrian down! Wanted up.'); }
}

// ---------- taxi fares (free-roam side activity) ----------
function resetTaxi() {
  const T = S.taxi;
  if (T.ped && T.ped.boarded) { // passenger steps back out where the cab stopped
    T.ped.boarded = false;
    T.ped.x = S.player.x + 30; T.ped.y = S.player.y + 10;
  }
  S.taxi = { state: 'idle', ped: null, dest: null, t: 0, cool: 4 };
}
function updateTaxi(dt) {
  const T = S.taxi;
  const p = S.player;
  if (S.missionIdx < MISSIONS.length) { if (T.state !== 'idle' || T.ped) resetTaxi(); return; }
  if (T.cool > 0) T.cool -= dt;
  if (T.state === 'idle') {
    if (T.ped && (T.ped.hp <= 0 || Math.hypot(T.ped.x - p.x, T.ped.y - p.y) > 780)) T.ped = null;
    if (!T.ped && T.cool <= 0) {
      let best = null, bd = 460;
      for (const ped of world.peds) {
        if (ped.hp <= 0 || ped.boarded) continue;
        const d = Math.hypot(ped.x - p.x, ped.y - p.y);
        if (d < bd) { bd = d; best = ped; }
      }
      T.ped = best;
    }
    if (T.ped) {
      S.objective = 'TAXI: a passenger is hailing you (!) — drive a car to them to pick them up.';
      S.target = { x: T.ped.x, y: T.ped.y };
      if (p.car && Math.hypot(T.ped.x - p.x, T.ped.y - p.y) < 48) {
        T.ped.boarded = true; T.state = 'ride'; T.t = 0;
        let dest = world.roadPoint(rng);
        for (let i = 0; i < 6 && Math.hypot(dest.x - p.x, dest.y - p.y) < 700; i++) dest = world.roadPoint(rng);
        T.dest = dest;
        audio.beep(1175, 0.1, 'square', 0.06);
        flash('Passenger in! Follow the gold marker — fast trips earn a tip.');
      }
    } else {
      S.objective = 'Side activities: TAXI SHIFTS (fares + milestone bonuses) · NEON CHIPS (collect all 12).';
      S.target = null;
    }
  } else if (T.state === 'ride') {
    T.t += dt;
    S.objective = 'TAXI: deliver your passenger to the gold marker — base fare plus a speed tip!';
    S.target = T.dest;
    if (!p.car) {
      resetTaxi(); flash('Fare cancelled — your passenger bailed out.');
      refreshMission();
    } else if (T.dest && Math.hypot(T.dest.x - p.x, T.dest.y - p.y) < 62) {
      const fare = 60 + Math.max(0, 90 - Math.floor(T.t));
      S.money += fare; S.taxiCount += 1; S.taxiEarned += fare;
      effects.popup(p.x, p.y - 34, `+$${fare} FARE`, '#ffd166');
      if (S.taxiCount % 5 === 0) { // Taxi Shifts milestone: every 5th fare pays a bonus
        S.money += 100; S.taxiEarned += 100;
        effects.popup(p.x, p.y - 58, '+$100 TAXI SHIFT BONUS', '#69f0ae');
        pushBanner('TAXI SHIFTS MILESTONE', `${S.taxiCount} fares done — +$100 bonus`);
      }
      effects.sparkle(T.dest.x, T.dest.y);
      audio.jingle();
      flash(`Fare paid: +$${fare} (taxi earnings $${S.taxiEarned})`);
      const ped = T.ped;
      S.taxi = { state: 'idle', ped: null, dest: null, t: 0, cool: 8 };
      if (ped) { ped.boarded = false; ped.x = T.dest.x + 26; ped.y = T.dest.y + 12; ped.flee = 0; }
      refreshMission(); saveGame();
    }
  }
}

// ---------- neon chips (collectible side activity) ----------
function updateChips() {
  const p = S.player;
  for (const ch of world.chips) {
    if (ch.taken) continue;
    if (Math.hypot(p.x - ch.x, p.y - ch.y) < 36) {
      ch.taken = true; S.chipsCollected += 1; S.money += 25;
      effects.sparkle(ch.x, ch.y);
      effects.popup(ch.x, ch.y - 26, '+$25', '#ffd166');
      audio.beep(1560, 0.09, 'square', 0.05);
      flash(`Neon Chips ${S.chipsCollected}/12 collected! +$25`);
      // Neon Chips milestones: half the set and the full set pay cash bonuses.
      if (S.chipsCollected === 6 && !S.chipBonus6) {
        S.chipBonus6 = true; S.money += 50;
        effects.popup(ch.x, ch.y - 50, '+$50 CHIP BONUS', '#69f0ae');
        pushBanner('NEON CHIPS MILESTONE', 'Half the set (6/12) — +$50 bonus');
      }
      if (S.chipsCollected === 12 && !S.chipBonus12) {
        S.chipBonus12 = true; S.money += 150;
        effects.popup(ch.x, ch.y - 50, '+$150 FULL SET BONUS', '#69f0ae');
        pushBanner('NEON CHIPS COMPLETE', 'All 12 chips — +$150 bonus');
      }
      saveGame();
    }
  }
}

// ---------- update ----------
function update(dt) {
  S.time += dt;
  S.tick += 1;
  // Hit-stop: a few frozen sim ticks on the biggest hits (and on the blow
  // that ends the run) — time is sim ticks only, never wall clock.
  if (S.hitStop > 0) {
    S.hitStop -= 1;
    effects.update(dt);
    if (S.hitStop === 0 && S.pendingEnd) { S.screen = S.pendingEnd; S.pendingEnd = null; }
    return;
  }
  if (S.flashT > 0) S.flashT = Math.max(0, S.flashT - dt * 2.4);
  if (S.msgTimer > 0) S.msgTimer -= dt;
  if (S.muzzle > 0) S.muzzle -= dt;
  if (S.banners.length) { const b = S.banners[0]; b.t -= dt; if (b.t <= 0) S.banners.shift(); }
  effects.update(dt);
  const p = S.player;

  // --- player on foot ---
  if (!p.car) {
    let dx = 0, dy = 0;
    if (input.down('KeyW', 'ArrowUp')) dy -= 1;
    if (input.down('KeyS', 'ArrowDown')) dy += 1;
    if (input.down('KeyA', 'ArrowLeft')) dx -= 1;
    if (input.down('KeyD', 'ArrowRight')) dx += 1;
    const len = Math.hypot(dx, dy) || 1;
    const sprint = input.down('ShiftLeft', 'ShiftRight');
    const sp = sprint ? 235 : 145;
    if (dx || dy) { p.angle = Math.atan2(dy, dx); moveCircle(p, (dx / len) * sp * dt, (dy / len) * sp * dt, 13); }
    p.speedNow = (dx || dy) ? sp : 0;
    // weapon pickup
    if (!world.weapon.taken && Math.hypot(p.x - world.weapon.x, p.y - world.weapon.y) < 30) {
      world.weapon.taken = true; S.armed = true; S.ammo = 24; flash('Pistol acquired! F / click to shoot.'); audio.beep(1200, 0.12, 'square', 0.07);
      effects.sparkle(world.weapon.x, world.weapon.y);
    }
    // enter vehicle (car, motorbike or the harbor boat — all live in world.cars)
    if (input.wasPressed('KeyE')) {
      let best = null, bd = 52;
      for (const c of world.cars) { if (c.wrecked) continue; const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = c; } }
      // At the shore, E means "board the boat": the moored boat wins over any
      // car parked along the waterfront, with a longer boarding reach.
      if (p.y > WATER_Y - 70 && !world.boat.wrecked && Math.hypot(world.boat.x - p.x, world.boat.y - p.y) < 68) best = world.boat;
      if (best) {
        input.consume('KeyE'); // don't let the exit branch see this same press in a later step of this frame
        const wasParked = best.parked;
        p.car = best; best.parked = false; best.traffic = false;
        audio.beep(140, 0.25, 'sawtooth', 0.04, 120);
        if (best.kind === 'boat') {
          flash('Aboard! W/S throttle, A/D rudder — E at a shore or pier to disembark.');
          if (S.missionIdx === 8 && S.stage === 0) { S.stage = 1; refreshMission(); }
        } else if (best.kind === 'bike') {
          if (wasParked) crime(1, p.x, p.y);
          flash('Motorbike! Quick off the line, turns on a dime.');
        } else if (best.marked && S.missionIdx === 1 && S.stage === 0) {
          if (wasParked) crime(1, p.x, p.y);
          S.stage = 1; flash('Got the gold coupe! Deliver it to the GARAGE.'); refreshMission();
        } else {
          if (wasParked) crime(1, p.x, p.y); // stealing in view raises wanted
          flash(wasParked ? 'Car stolen!' : 'Driving!');
        }
      }
    }
    // busted check: police pin a slow on-foot player
    let pinning = false;
    for (const c of S.police) if (Math.hypot(c.x - p.x, c.y - p.y) < 58 && p.speedNow < 40) pinning = true;
    if (pinning && S.wanted > 0) { S.bustedMeter += dt; if (S.bustedMeter > 2 && !S.pendingEnd) { S.pendingEnd = 'busted'; S.hitStop = 9; S.flashT = 1; effects.addShake(9); audio.beep(220, 0.5, 'square', 0.08, -120); } }
    else S.bustedMeter = Math.max(0, S.bustedMeter - dt * 1.5);
  } else {
    // --- driving: car, motorbike (quick + tight) or boat (water only) ---
    const car = p.car;
    const kind = car.kind || 'car';
    const SPEC = kind === 'bike' ? { accel: 430, brake: 380, rev: 130, top: 365, revTop: 85, steer: 2.9, r: 13, drag: 0.5 }
      : kind === 'boat' ? { accel: 150, brake: 170, rev: 90, top: 225, revTop: 60, steer: 1.25, r: 20, drag: 0.35 }
      : { accel: 260, brake: 340, rev: 150, top: 330, revTop: 110, steer: 1.9, r: 20, drag: 0.55 };
    if (input.down('KeyW', 'ArrowUp')) car.speed += SPEC.accel * dt;
    else if (input.down('KeyS', 'ArrowDown')) car.speed -= (car.speed > 10 ? SPEC.brake : SPEC.rev) * dt;
    else car.speed -= car.speed * SPEC.drag * dt; // drag
    car.speed = Math.max(-SPEC.revTop, Math.min(SPEC.top, car.speed));
    const steer = (input.down('KeyA', 'ArrowLeft') ? -1 : 0) + (input.down('KeyD', 'ArrowRight') ? 1 : 0);
    if (steer && Math.abs(car.speed) > 4) car.angle += steer * SPEC.steer * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 120);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const hitBlock = kind !== 'boat' && S.missionIdx === 7 && S.roadblocks.some((rb) => Math.hypot(rb.x - nx, rb.y - ny) < 38);
    const blockedMove = kind === 'boat' ? blockedForBoat(nx, ny, SPEC.r) : (blockedAt(nx, ny, SPEC.r) || hitBlock);
    if (!blockedMove) { car.x = nx; car.y = ny; }
    else {
      if (Math.abs(car.speed) > 130) {
        p.hp -= kind === 'boat' ? 2 : 6; audio.noise(0.15, 0.12); effects.sparks(car.x, car.y, 10); effects.addShake(7);
        if (hitBlock) { flash('ROADBLOCK! Ram through or go around!'); S.hitStop = Math.max(S.hitStop, 3); }
      }
      car.speed *= -0.25;
    }
    if (kind === 'boat') {
      car.x = Math.min(WORLD_W - 30, Math.max(30, car.x)); car.y = Math.min(WORLD_H - 34, Math.max(WATER_Y + 22, car.y));
      if (Math.abs(car.speed) > 40 && S.tick % 3 === 0) effects.wake(car.x - Math.cos(car.angle) * 30, car.y - Math.sin(car.angle) * 30);
    } else {
      car.x = Math.min(WORLD_W - 30, Math.max(30, car.x)); car.y = Math.min(WATER_Y - 10, Math.max(30, car.y));
    }
    // skid marks + tire smoke when turning hard at speed (land vehicles)
    if (kind !== 'boat' && Math.abs(car.speed) > 130 && steer) {
      car.skid.push({ x: car.x, y: car.y }); if (car.skid.length > 46) car.skid.shift();
      if (Math.abs(car.speed) > 165 && S.tick % 2 === 0) effects.tireSmoke(car.x - Math.cos(car.angle) * 16, car.y - Math.sin(car.angle) * 16);
    }
    else if (car.skid.length) car.skid.shift();
    p.x = car.x; p.y = car.y; p.angle = car.angle; p.speedNow = Math.abs(car.speed);
    if (kind !== 'boat') {
      // running over peds / hitting cars
      for (const ped of world.peds) {
        if (ped.hp > 0 && !ped.boarded && Math.abs(car.speed) > 30 && Math.hypot(ped.x - car.x, ped.y - car.y) < 26) { hurtPed(ped, 40); crime(1, car.x, car.y); p.hp -= 1; }
      }
      for (const oc of [...world.cars, ...S.police]) {
        if (oc === car || oc.kind === 'boat') continue;
        if (Math.hypot(oc.x - car.x, oc.y - car.y) < 40 && Math.abs(car.speed) > 60) {
          oc.hp -= 14; car.speed *= 0.55; p.hp -= 2; audio.noise(0.1, 0.1);
          effects.sparks((oc.x + car.x) / 2, (oc.y + car.y) / 2, 6); effects.addShake(3);
          if (S.police.includes(oc)) crime(1, car.x, car.y);
        }
      }
    }
    if (input.wasPressed('KeyE')) {
      input.consume('KeyE');
      if (kind === 'boat') {
        // Docking: only near a shore line the player can step onto.
        const nearShore = car.y < WATER_Y + 78 || Math.hypot(car.x - PIER.x, car.y - PIER.y) < 92;
        if (nearShore) disembark(false);
        else flash('Too far from shore — sail to the dock or a pier marker to disembark.');
      } else {
        const side = car.angle + Math.PI / 2;
        p.car = null; car.speed = 0; car.parked = true;
        p.x = car.x + Math.cos(side) * 34; p.y = car.y + Math.sin(side) * 34;
        if (blockedAt(p.x, p.y, 13)) { p.x = car.x - Math.cos(side) * 34; p.y = car.y - Math.sin(side) * 34; }
        flash('On foot.');
      }
    }
  }

  // attack input (on foot only)
  if (!p.car && (input.wasPressed('KeyF') || input.mouse.clicked)) attack();

  // --- traffic AI: follow roads, slow for the car ahead, turn at crossings ---
  for (const c of world.cars) {
    if (!c.traffic || c.parked || c.wrecked || p.car === c) continue;
    let sp = c.speed;
    for (const oc of world.cars) if (oc !== c && Math.hypot(oc.x - c.x, oc.y - c.y) < 62) sp = Math.min(sp, 26);
    if (Math.hypot(p.x - c.x, p.y - c.y) < 56 && !p.car) sp = 0; // stop for a pedestrian-player
    c.x += Math.cos(c.angle) * sp * dt; c.y += Math.sin(c.angle) * sp * dt;
    // at an intersection, sometimes turn onto the crossing road
    const nearX = Math.min(...[220, 720, 1220, 1720, 2220, 2720].map((v) => Math.abs(v - c.x)));
    const nearY = Math.min(...[220, 670, 1120, 1570, 1950].map((v) => Math.abs(v - c.y)));
    if (nearX < 8 && nearY < 8 && rng.chance(0.012)) c.angle += (rng.chance(0.5) ? 1 : -1) * Math.PI / 2;
    if (c.x < 40 || c.x > WORLD_W - 40 || c.y < 40 || c.y > WATER_Y - 30) c.angle += Math.PI; // turn around at edges
    c.x = Math.min(WORLD_W - 30, Math.max(30, c.x)); c.y = Math.min(WATER_Y - 20, Math.max(30, c.y));
  }

  // --- car damage states: wrecks stop and burn, hurt cars smoke ---
  for (const c of world.cars) {
    if (!c.wrecked && c.hp <= 0 && c !== p.car) {
      c.wrecked = true; c.traffic = false; c.parked = true; c.speed = 0;
      effects.burst(c.x, c.y); flash('Car wrecked!');
      if (Math.hypot(p.x - c.x, p.y - c.y) < 340) { effects.addShake(9); S.flashT = Math.max(S.flashT, 0.45); S.hitStop = Math.max(S.hitStop, 2); }
    }
    if (c.wrecked || (c.hp > 0 && c.hp < 35)) {
      c.smokeT = (c.smokeT || 0) + dt;
      const interval = c.wrecked ? 0.13 : 0.3;
      if (c.smokeT >= interval) { c.smokeT = 0; effects.smoke(c.x, c.y, c.wrecked); }
    }
  }

  // --- pedestrians: wander, flee danger ---
  for (const ped of world.peds) {
    if (ped.hp <= 0 || ped.boarded) continue;
    let danger = null;
    if (Math.hypot(p.x - ped.x, p.y - ped.y) < 120 && (p.car || S.muzzle > 0)) danger = p;
    for (const c of S.police) if (Math.hypot(c.x - ped.x, c.y - ped.y) < 90) danger = c;
    if (danger || ped.flee > 0) {
      ped.flee = Math.max(0, ped.flee - dt);
      const a = Math.atan2(ped.y - (danger ? danger.y : p.y), ped.x - (danger ? danger.x : p.x));
      moveCircle(ped, Math.cos(a) * 105 * dt, Math.sin(a) * 105 * dt, 8);
    } else {
      ped.wander -= dt;
      if (ped.wander <= 0) { ped.angle = rng.range(0, Math.PI * 2); ped.wander = rng.range(1.5, 4); }
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt, ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      if (!blockedAt(nx, ny, 8) && isRoad(nx, ny) !== false) { ped.x = nx; ped.y = ny; } else ped.angle += Math.PI / 2;
      ped.x = Math.min(WORLD_W - 30, Math.max(30, ped.x)); ped.y = Math.min(WATER_Y - 20, Math.max(30, ped.y));
    }
  }

  // --- wanted + police (spawning, pursuit, siren, heat decay) ---
  police.update(dt);

  // --- bullets ---
  for (const b of S.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const ped of world.peds) if (ped.hp > 0 && !ped.boarded && Math.hypot(ped.x - b.x, ped.y - b.y) < 12) { hurtPed(ped, 30); b.life = 0; }
    for (const c of [...world.cars, ...S.police]) if (Math.hypot(c.x - b.x, c.y - b.y) < 24) { c.hp -= 22; b.life = 0; effects.sparks(b.x, b.y, 3); }
    if (world.collidesBuilding(b.x, b.y, 2)) b.life = 0;
  }
  S.bullets = S.bullets.filter((b) => b.life > 0);
  // police cars destroyed by bullets burst and despawn (wreck bonus handled in police.update path)
  for (const c of S.police) if (c.hp <= 0 && !c.dead) { c.dead = true; effects.burst(c.x, c.y); }
  S.police = S.police.filter((c) => !c.dead);

  // --- missions + side activities ---
  updateMissions(dt);
  updateTaxi(dt);
  updateChips();

  // --- health / wasted (through hit-stop + flash, on sim ticks) ---
  if (p.hp <= 0 && !S.pendingEnd) { S.pendingEnd = 'over'; S.hitStop = 10; S.flashT = 1; effects.addShake(12); effects.burst(p.x, p.y); audio.beep(160, 0.6, 'sawtooth', 0.08, -100); }
  if (p.hp < 100 && S.screen === 'play') p.hp = Math.min(100, p.hp + dt * 1.2); // slow regen

  // camera follows player
  cam.x = Math.min(WORLD_W - canvas.width, Math.max(0, p.x - canvas.width / 2));
  cam.y = Math.min(WORLD_H - canvas.height, Math.max(0, p.y - canvas.height / 2));
  if (canvas.width >= WORLD_W) cam.x = 0;
  if (canvas.height >= WORLD_H) cam.y = 0;
}

function distTo(t) { return t ? Math.hypot(S.player.x - t.x, S.player.y - t.y) : Infinity; }
// Mission 6 tailing: the informant drives TAIL_ROUTE segment by segment. The
// player must hold the [TAIL_MIN, TAIL_MAX] band: too close builds spook,
// too far builds lost; either meter filling restarts the tail (no run fail).
function updateTail(dt) {
  if (!S.tail) startTail();
  const T = S.tail;
  const dest = TAIL_ROUTE[TAIL_ROUTE.length - 1];
  if (!T.arrived) {
    const wp = TAIL_ROUTE[T.wpIdx];
    if (wp) {
      const d = Math.hypot(wp.x - T.x, wp.y - T.y);
      const step = Math.min(d, TAIL_SPEED * dt);
      T.angle = Math.atan2(wp.y - T.y, wp.x - T.x);
      T.x += Math.cos(T.angle) * step; T.y += Math.sin(T.angle) * step;
      if (d < 6) { T.wpIdx += 1; if (T.wpIdx >= TAIL_ROUTE.length) T.arrived = true; }
    } else T.arrived = true;
  }
  const dist = Math.hypot(S.player.x - T.x, S.player.y - T.y);
  if (dist <= TAIL_MAX) T.engaged = true; // meters only run once the player has picked up the tail
  if (dist < TAIL_MIN) T.spook += dt; else T.spook = Math.max(0, T.spook - dt * 1.6);
  if (dist > TAIL_MAX && T.engaged) T.lost += dt; else if (dist <= TAIL_MAX) T.lost = Math.max(0, T.lost - dt * 1.6);
  const band = dist < TAIL_MIN ? 'TOO CLOSE — back off!' : dist > TAIL_MAX ? 'TOO FAR — catch up!' : 'in the pocket';
  S.objective = `TAIL: follow the violet sedan to the freight terminal — ${Math.round(dist / 4)} m away (${band}).`;
  S.target = { x: T.x, y: T.y };
  if (T.spook > 2) {
    S.tailResets += 1; startTail();
    flash('Spooked! The informant bolted — the tail restarts. Stay back!');
    S.target = { ...TAIL_ROUTE[0] }; return;
  }
  if (T.lost > 3) {
    S.tailResets += 1; startTail();
    flash('You lost him in traffic — the tail restarts. Keep up!');
    S.target = { ...TAIL_ROUTE[0] }; return;
  }
  if (T.arrived) {
    if (dist <= TAIL_MAX) { completeMission(); }
    else { S.tailResets += 1; startTail(); flash('He reached the terminal unseen-by-you — tail restarts!'); }
  }
}
function updateMissions(dt) {
  if (S.missionIdx >= MISSIONS.length) return;
  if (S.missionIdx === 0 && distTo(world.garage) < 56) completeMission();
  else if (S.missionIdx === 1 && S.stage === 1 && S.player.car === world.markedCar && distTo(world.garage) < 70) {
    world.markedCar.parked = true; S.player.car = null; S.player.x += 40; completeMission();
    // set up mission 3 heat
    S.wanted = 3; flash('The owner called the cops — LOSE THE HEAT!');
  } else if (S.missionIdx === 2 && S.wanted === 0) completeMission();
  else if (S.missionIdx === 3) {
    S.timer -= dt;
    S.objective = `HARBOR RUN: checkpoint ${S.cpIdx + 1}/4 — ${Math.max(0, Math.ceil(S.timer))}s left!`;
    if (S.timer <= 0) failMissionTimer();
    else if (S.checkpoints[S.cpIdx] && distTo(S.checkpoints[S.cpIdx]) < 64) {
      S.cpIdx += 1; audio.beep(990, 0.1, 'square', 0.06);
      if (S.cpIdx >= S.checkpoints.length) completeMission(); else refreshMission();
    }
  } else if (S.missionIdx === 4) {
    S.timer -= dt;
    S.objective = `RUSH HOUR: drop-off ${S.dropIdx + 1}/3 — ${Math.max(0, Math.ceil(S.timer))}s left!`;
    if (S.timer <= 0) failDropsTimer();
    else if (S.drops[S.dropIdx] && distTo(S.drops[S.dropIdx]) < 62) {
      S.dropIdx += 1; audio.beep(990, 0.1, 'square', 0.06);
      effects.popup(S.player.x, S.player.y - 30, 'DROP MADE!', '#00e5ff');
      if (S.dropIdx >= S.drops.length) completeMission(); else refreshMission();
    }
  } else if (S.missionIdx === 5) {
    updateTail(dt);
  } else if (S.missionIdx === 6) {
    if (S.stage === 0 && distTo(world.harbor) < 60) {
      S.stage = 1; S.wanted = Math.max(S.wanted, 2);
      flash('Goods loaded! Heat is rising — deliver them to the BUYER downtown!'); refreshMission();
    } else if (S.stage === 1 && distTo(BUYER) < 62) completeMission();
  } else if (S.missionIdx === 7) {
    S.wanted = Math.max(S.wanted, 4); // the heat stays forced up for the whole getaway
    S.objective = `ROADBLOCK GETAWAY: ${S.roadblocks.length} roadblocks up — reach the GARAGE!`;
    S.target = { ...world.garage };
    if (distTo(world.garage) < 70) completeMission();
  } else if (S.missionIdx === 8) {
    if (S.stage === 0) {
      S.objective = 'HARBOR CARGO: board Mara\'s boat at the HARBOR dock (walk to the shore, press E).';
      S.target = { x: world.boat.x, y: world.harbor.y };
      if (S.player.car && S.player.car.kind === 'boat') { S.stage = 1; refreshMission(); }
    } else if (S.stage === 1) {
      const c = S.cargo[S.cargoIdx];
      S.objective = `HARBOR CARGO: recover floating crate ${S.cargoIdx + 1}/3 on the water.`;
      S.target = c ? { ...c } : { ...PIER };
      if (c && S.player.car && S.player.car.kind === 'boat' && Math.hypot(S.player.x - c.x, S.player.y - c.y) < 54) {
        c.taken = true; S.cargoIdx += 1; audio.beep(1175, 0.1, 'square', 0.06);
        effects.popup(c.x, c.y - 26, 'CARGO ABOARD', '#00e5ff'); effects.sparkle(c.x, c.y);
        if (S.cargoIdx >= S.cargo.length) { S.stage = 2; flash('All cargo aboard! Dock at the EAST PIER marker.'); }
        refreshMission();
      }
    } else if (S.stage === 2) {
      S.objective = 'HARBOR CARGO: dock at the EAST PIER to unload.';
      S.target = { ...PIER };
      if (S.player.car && S.player.car.kind === 'boat' && distTo(PIER) < 64) completeMission();
    }
  } else if (S.missionIdx === 9) {
    if (S.stage === 0 && distTo(world.harbor) < 60) {
      S.stage = 1; S.hasPackage = true; S.wanted = Math.max(S.wanted, 3);
      flash('Package secured! Heavy heat — deliver it to the GARAGE!'); refreshMission();
    } else if (S.stage === 1 && distTo(world.garage) < 70) completeMission();
  }
}

// ---------- flow ----------
function startGame(continueSave) {
  const sv = continueSave ? loadSave() : null;
  resetTaxi();
  world.chips.forEach((c) => { c.taken = false; });
  S.chipsCollected = 0; S.taxiCount = 0; S.taxiEarned = 0;
  if (sv) {
    S.money = sv.money || 0;
    // Old saves used shorter chains: v1 had 5 missions (4 = FINAL JOB, 5 =
    // free roam); v2 had 7 (5 = DOCKSIDE DEAL, 6 = FINAL JOB, 7 = free roam).
    // Remap both onto the 10-mission v3 chain; clamp everything else.
    let mi = Number.isInteger(sv.missionIdx) ? sv.missionIdx : 0;
    if (sv.v === 2) { if (mi === 5) mi = 6; else if (mi === 6) mi = 9; else if (mi >= 7) mi = MISSIONS.length; }
    else if (sv.v !== 3) { if (mi === 4) mi = 9; else if (mi >= 5) mi = MISSIONS.length; }
    S.missionIdx = Math.min(Math.max(mi, 0), MISSIONS.length);
    S.player.x = sv.x || 720; S.player.y = sv.y || 670;
    if (Array.isArray(sv.chips)) for (const id of sv.chips) if (world.chips[id]) world.chips[id].taken = true;
    S.chipsCollected = world.chips.filter((c) => c.taken).length;
    S.taxiCount = sv.taxiCount || 0; S.taxiEarned = sv.taxiEarned || 0;
  } else {
    S.money = 0; S.missionIdx = 0; S.player.x = 720; S.player.y = 670;
    try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  }
  S.player.hp = 100; S.player.car = null; S.wanted = 0; S.police = []; S.bullets = [];
  S.stage = 0; S.bustedMeter = 0; S.hasPackage = false; S.banners = [];
  S.tail = null; S.roadblocks = []; S.cargo = []; S.cargoIdx = 0;
  S.hitStop = 0; S.pendingEnd = null; S.flashT = 0;
  S.chipBonus6 = S.chipsCollected >= 6; S.chipBonus12 = S.chipsCollected >= 12;
  // The boat always starts a session moored at the harbor dock.
  world.boat.x = 1500; world.boat.y = 2122; world.boat.angle = 0; world.boat.speed = 0; world.boat.parked = true; world.boat.wrecked = false; world.boat.hp = 100;
  if (S.missionIdx === 3) startCheckpoints();
  if (S.missionIdx === 4) startDrops();
  if (S.missionIdx === 5) startTail();
  if (S.missionIdx === 7) startRoadblocks();
  if (S.missionIdx === 8) startCargo();
  if (S.missionIdx === 2) S.wanted = 3;
  refreshMission();
  S.screen = 'play';
  if (S.missionIdx < MISSIONS.length) pushBanner(MISSIONS[S.missionIdx].title, MISSIONS[S.missionIdx].obj);
  else pushBanner('FREE ROAM', 'Taxi fares and neon chips await, Nico.');
  flash(S.missionIdx >= MISSIONS.length ? 'Free roam — Port Solana is yours.' : 'Welcome to Port Solana, Nico.');
}

function snapshot() {
  const atmo = getAtmosphere(S.time, seed);
  return {
    x: Math.round(S.player.x), y: Math.round(S.player.y),
    mode: S.player.car ? 'driving' : 'onfoot',
    veh: S.player.car ? (S.player.car.kind || 'car') : 'foot',
    money: S.money, wanted: S.wanted, mission: S.missionIdx, stage: S.stage,
    hp: Math.round(S.player.hp), screen: S.screen, armed: S.armed, ammo: S.ammo,
    police: S.police.length, peds: world.peds.filter((p) => p.hp > 0).length,
    time: Math.round(S.time * 10) / 10,
    chips: S.chipsCollected, taxiCount: S.taxiCount, taxiEarned: S.taxiEarned,
    tail: S.tail ? { x: Math.round(S.tail.x), y: Math.round(S.tail.y), dist: Math.round(Math.hypot(S.player.x - S.tail.x, S.player.y - S.tail.y)), arrived: S.tail.arrived, resets: S.tailResets } : null,
    roadblocks: S.roadblocks.length,
    cargo: S.missionIdx === 8 ? { got: S.cargoIdx, total: S.cargo.length } : null,
    boat: { x: Math.round(world.boat.x), y: Math.round(world.boat.y) },
    bikes: world.bikes.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y) })),
    env: { phase: atmo.name, rain: Math.round(atmo.rain * 100) / 100, darkness: Math.round(atmo.darkness * 100) / 100 },
  };
}
window.__game = snapshot;
// Test-only hook (active only with ?test=1): lets the headless harness place
// the player/vehicles and read live mission state for playthrough checks.
// It is never installed in normal play and changes no game rules.
if (params.get('test')) {
  window.__test = {
    S, world,
    teleport(x, y) {
      S.player.x = x; S.player.y = y;
      if (S.player.car) { S.player.car.x = x; S.player.car.y = y; }
    },
    setWanted(n) { S.wanted = n; },
    clearPolice() { S.police = []; },
    heal() { S.player.hp = 100; },
  };
}
// Deterministic fingerprint of the generated world (buildings, props,
// landmarks) — same seed must always produce the same hash.
window.__worldHash = () => {
  let h = 2166136261;
  const mix = (n) => { h = Math.imul(h ^ (n | 0), 16777619); };
  const mixStr = (s) => { for (let i = 0; i < s.length; i++) mix(s.charCodeAt(i)); };
  for (const b of world.buildings) { mix(b.x * 10); mix(b.y * 10); mix(b.w * 10); mix(b.h * 10); mix(b.seed); mixStr(b.district); if (b.landmark) mixStr(b.landmark); }
  const P = world.props;
  for (const c of P.containers) { mix(c.x * 10); mix(c.y * 10); }
  for (const p of world.palms) { mix(p.x * 10); mix(p.y * 10); }
  mix(P.benches.length); mix(P.hydrants.length); mix(P.bushes.length); mix(P.umbrellas.length); mix(P.crates.length);
  for (const l of world.landmarks) mixStr(l.name);
  return (h >>> 0).toString(16);
};

// ---------- shot mode: stage, freeze, flag ready ----------
if (shotName) {
  S.hasSave = !!loadSave();
  stageShot(shotName, S);
  cam.x = Math.min(WORLD_W - 1280, Math.max(0, S.player.x - 640));
  cam.y = Math.min(WORLD_H - 800, Math.max(0, S.player.y - 400));
  renderer.draw(S, cam);
  renderer.draw(S, cam);
  window.__shotReady = true;
  status.textContent = `Port Solana screenshot scene: ${shotName}`;
} else {
  // ---------- live loop ----------
  let last = performance.now(); let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.25) dt = 0.25;
    // global keys
    if (input.wasPressed('KeyM')) { const m = audio.toggleMute(); flash(m ? 'Sound muted' : 'Sound on'); }
    if (S.screen === 'title') {
      if (input.wasPressed('KeyN')) startGame(false);
      else if (input.wasPressed('Enter') || input.mouse.clicked) startGame(S.hasSave);
    } else if (S.screen === 'play') {
      if (input.wasPressed('KeyP', 'Escape')) S.screen = 'pause';
      else { acc += dt; while (acc >= STEP) { update(STEP); acc -= STEP; if (S.screen !== 'play') { acc = 0; break; } } }
    } else if (S.screen === 'pause') {
      if (input.wasPressed('KeyP', 'Escape')) S.screen = 'play';
    } else if (S.screen === 'over' || S.screen === 'busted') {
      if (input.wasPressed('Enter') || input.mouse.clicked) startGame(false);
    } else if (S.screen === 'win') {
      if (input.wasPressed('Enter') || input.mouse.clicked) { S.screen = 'play'; pushBanner('FREE ROAM', 'Taxi fares and neon chips await, Nico.'); saveGame(); }
    }
    cam.x = Math.min(Math.max(0, WORLD_W - canvas.width), Math.max(0, S.player.x - canvas.width / 2));
    cam.y = Math.min(Math.max(0, WORLD_H - canvas.height), Math.max(0, S.player.y - canvas.height / 2));
    renderer.draw(S, cam);
    status.textContent = `Port Solana — $${S.money}, wanted ${S.wanted}, mission ${S.missionIdx + 1}`;
    input.endFrame();
  }
  requestAnimationFrame(frame);
}
refreshMission();
