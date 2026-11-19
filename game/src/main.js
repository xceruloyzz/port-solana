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
import { MISSIONS, DIALOGUE, HARBOR_CHECKPOINTS, RUSH_DROPS, RUSH_TIME, BUYER } from './missions.js';
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
  world, screen: 'title', hasSave: false, effects,
  player: { x: 720, y: 670, angle: 0, hp: 100, car: null, speedNow: 0 },
  police: [], bullets: [], money: 0, wanted: 0, armed: false, ammo: 0,
  missionIdx: 0, missionTitle: '', objective: '', dialogue: '', target: null,
  msg: '', msgTimer: 0, muzzle: 0, bustedMeter: 0, hideTimer: 0, seenTimer: 0,
  stage: 0, timer: 0, checkpoints: [], cpIdx: 0, drops: [], dropIdx: 0, hasPackage: false,
  chipsCollected: 0, taxiCount: 0, taxiEarned: 0,
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
      v: 2, money: S.money, missionIdx: S.missionIdx, x: S.player.x, y: S.player.y,
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
    S.objective = 'Cruise the golden harbor. Run taxi fares, hunt neon chips, dodge the law.';
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
  else if (S.missionIdx === 5) S.target = S.stage === 0 ? { ...world.harbor } : { ...BUYER };
  else if (S.missionIdx === 6) S.target = S.stage === 0 ? { ...world.harbor } : { ...world.garage };
}
function completeMission() {
  const m = MISSIONS[S.missionIdx];
  const pay = m.pay;
  S.money += pay;
  effects.popup(S.player.x, S.player.y - 34, `+$${pay}`, '#69f0ae');
  effects.sparkle(S.player.x, S.player.y);
  pushBanner('MISSION COMPLETE', `${m.title} · +$${pay}`);
  audio.jingle();
  S.missionIdx += 1; S.stage = 0; S.hasPackage = false;
  if (S.missionIdx === 3) startCheckpoints();
  if (S.missionIdx === 4) startDrops();
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

// ---------- combat ----------
function attack() {
  const p = S.player;
  const aimX = input.mouse.x + cam.x, aimY = input.mouse.y + cam.y;
  const ang = Math.atan2(aimY - p.y, aimX - p.x);
  p.angle = ang;
  if (S.armed && S.ammo > 0) {
    S.ammo -= 1; S.muzzle = 0.07; audio.noise(0.12, 0.16);
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
      S.objective = 'Cruise the golden harbor. Run taxi fares, hunt neon chips, dodge the law.';
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
      flash(`Neon chip ${S.chipsCollected}/12 collected! +$25`);
      saveGame();
    }
  }
}

// ---------- update ----------
function update(dt) {
  S.time += dt;
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
    // enter car
    if (input.wasPressed('KeyE')) {
      let best = null, bd = 52;
      for (const c of world.cars) { if (c.wrecked) continue; const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = c; } }
      if (best) {
        const wasParked = best.parked;
        p.car = best; best.parked = false; best.traffic = false;
        audio.beep(140, 0.25, 'sawtooth', 0.04, 120);
        if (wasParked) crime(1, p.x, p.y); // stealing in view raises wanted
        if (best.marked && S.missionIdx === 1 && S.stage === 0) { S.stage = 1; flash('Got the gold coupe! Deliver it to the GARAGE.'); refreshMission(); }
        else flash(wasParked ? 'Car stolen!' : 'Driving!');
      }
    }
    // busted check: police pin a slow on-foot player
    let pinning = false;
    for (const c of S.police) if (Math.hypot(c.x - p.x, c.y - p.y) < 58 && p.speedNow < 40) pinning = true;
    if (pinning && S.wanted > 0) { S.bustedMeter += dt; if (S.bustedMeter > 2) { S.screen = 'busted'; audio.beep(220, 0.5, 'square', 0.08, -120); } }
    else S.bustedMeter = Math.max(0, S.bustedMeter - dt * 1.5);
  } else {
    // --- driving ---
    const car = p.car;
    if (input.down('KeyW', 'ArrowUp')) car.speed += 260 * dt;
    else if (input.down('KeyS', 'ArrowDown')) car.speed -= (car.speed > 10 ? 340 : 150) * dt;
    else car.speed -= car.speed * 0.55 * dt; // drag
    car.speed = Math.max(-110, Math.min(330, car.speed));
    const steer = (input.down('KeyA', 'ArrowLeft') ? -1 : 0) + (input.down('KeyD', 'ArrowRight') ? 1 : 0);
    if (steer && Math.abs(car.speed) > 4) car.angle += steer * 1.9 * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 120);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!blockedAt(nx, ny, 20)) { car.x = nx; car.y = ny; }
    else {
      if (Math.abs(car.speed) > 130) { p.hp -= 6; audio.noise(0.15, 0.12); effects.sparks(car.x, car.y, 10); effects.addShake(7); }
      car.speed *= -0.25;
    }
    car.x = Math.min(WORLD_W - 30, Math.max(30, car.x)); car.y = Math.min(WATER_Y - 10, Math.max(30, car.y));
    // skid marks when turning hard at speed
    if (Math.abs(car.speed) > 130 && steer) { car.skid.push({ x: car.x, y: car.y }); if (car.skid.length > 46) car.skid.shift(); }
    else if (car.skid.length) car.skid.shift();
    p.x = car.x; p.y = car.y; p.angle = car.angle; p.speedNow = Math.abs(car.speed);
    // running over peds / hitting cars
    for (const ped of world.peds) {
      if (ped.hp > 0 && !ped.boarded && Math.abs(car.speed) > 30 && Math.hypot(ped.x - car.x, ped.y - car.y) < 26) { hurtPed(ped, 40); crime(1, car.x, car.y); p.hp -= 1; }
    }
    for (const oc of [...world.cars, ...S.police]) {
      if (oc === car) continue;
      if (Math.hypot(oc.x - car.x, oc.y - car.y) < 40 && Math.abs(car.speed) > 60) {
        oc.hp -= 14; car.speed *= 0.55; p.hp -= 2; audio.noise(0.1, 0.1);
        effects.sparks((oc.x + car.x) / 2, (oc.y + car.y) / 2, 6); effects.addShake(3);
        if (S.police.includes(oc)) crime(1, car.x, car.y);
      }
    }
    if (input.wasPressed('KeyE')) {
      const side = car.angle + Math.PI / 2;
      p.car = null; car.speed = 0; car.parked = true;
      p.x = car.x + Math.cos(side) * 34; p.y = car.y + Math.sin(side) * 34;
      if (blockedAt(p.x, p.y, 13)) { p.x = car.x - Math.cos(side) * 34; p.y = car.y - Math.sin(side) * 34; }
      flash('On foot.');
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
      if (Math.hypot(p.x - c.x, p.y - c.y) < 320) effects.addShake(5);
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

  // --- health / wasted ---
  if (p.hp <= 0) { S.screen = 'over'; audio.beep(160, 0.6, 'sawtooth', 0.08, -100); }
  if (p.hp < 100 && S.screen === 'play') p.hp = Math.min(100, p.hp + dt * 1.2); // slow regen

  // camera follows player
  cam.x = Math.min(WORLD_W - canvas.width, Math.max(0, p.x - canvas.width / 2));
  cam.y = Math.min(WORLD_H - canvas.height, Math.max(0, p.y - canvas.height / 2));
  if (canvas.width >= WORLD_W) cam.x = 0;
  if (canvas.height >= WORLD_H) cam.y = 0;
}

function distTo(t) { return t ? Math.hypot(S.player.x - t.x, S.player.y - t.y) : Infinity; }
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
    if (S.stage === 0 && distTo(world.harbor) < 60) {
      S.stage = 1; S.wanted = Math.max(S.wanted, 2);
      flash('Goods loaded! Heat is rising — deliver them to the BUYER downtown!'); refreshMission();
    } else if (S.stage === 1 && distTo(BUYER) < 62) completeMission();
  } else if (S.missionIdx === 6) {
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
    // Old (v1) saves used the 5-mission numbering: 4 was THE FINAL JOB, 5 was
    // free roam. Remap those onto the 7-mission chain; clamp everything else.
    let mi = Number.isInteger(sv.missionIdx) ? sv.missionIdx : 0;
    if (sv.v !== 2) { if (mi === 4) mi = 6; else if (mi >= 5) mi = MISSIONS.length; }
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
  if (S.missionIdx === 3) startCheckpoints();
  if (S.missionIdx === 4) startDrops();
  if (S.missionIdx === 2) S.wanted = 3;
  refreshMission();
  S.screen = 'play';
  if (S.missionIdx < MISSIONS.length) pushBanner(MISSIONS[S.missionIdx].title, MISSIONS[S.missionIdx].obj);
  else pushBanner('FREE ROAM', 'Taxi fares and neon chips await, Nico.');
  flash(S.missionIdx >= MISSIONS.length ? 'Free roam — Port Solana is yours.' : 'Welcome to Port Solana, Nico.');
}

function snapshot() {
  return {
    x: Math.round(S.player.x), y: Math.round(S.player.y),
    mode: S.player.car ? 'driving' : 'onfoot',
    money: S.money, wanted: S.wanted, mission: S.missionIdx,
    hp: Math.round(S.player.hp), screen: S.screen, armed: S.armed, ammo: S.ammo,
    police: S.police.length, peds: world.peds.filter((p) => p.hp > 0).length,
  };
}
window.__game = snapshot;

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
