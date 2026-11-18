// PORT SOLANA: Neon Harbor — main loop and game logic: on-foot + driving, traffic,
// pedestrians, wanted/police, combat, 5-mission story, HUD state, save, sound.
// Vanilla JS ES modules on canvas. No network, no build step.
import { WORLD_W, WORLD_H, WATER_Y, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, isRoad, isWater } from './world.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
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

// ---------- tiny WebAudio synth (all generated, no files) ----------
let audioCtx = null; let muted = false;
function beep(freq, dur, type, vol, slide) {
  if (muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), audioCtx.currentTime + dur);
    g.gain.value = vol || 0.06; g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + dur);
  } catch { /* audio unavailable */ }
}
function noiseBurst(dur, vol) {
  if (muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const len = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const g = audioCtx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(audioCtx.destination); src.start();
  } catch { /* audio unavailable */ }
}
let sirenT = 0;

// ---------- state ----------
const MISSIONS = [
  { title: 'MISSION 1 — MEET MARA', obj: 'Go to the GARAGE and meet fixer Mara Voss.', pay: 100 },
  { title: 'MISSION 2 — GOLD COUPE', obj: 'Steal the marked gold coupe (★) and deliver it to the GARAGE.', pay: 400 },
  { title: 'MISSION 3 — LOSE THE HEAT', obj: 'Escape! Lose your wanted level completely.', pay: 300 },
  { title: 'MISSION 4 — HARBOR RUN', obj: 'Hit every checkpoint before the timer runs out!', pay: 500 },
  { title: 'MISSION 5 — THE FINAL JOB', obj: 'Pick up the package at the HARBOR, then deliver it to the GARAGE.', pay: 1000 },
];
const DIALOGUE = [
  'Mara Voss: "Nico. You drive, I pay. First job is waiting."',
  'Mara Voss: "That gold coupe? Its owner owes me. Bring it home."',
  'Mara Voss: "Cops are all over you — vanish, then we talk."',
  'Mara Voss: "Four checkpoints, one timer. Show me speed, Nico."',
  'Mara Voss: "Last job. Harbor package, heavy heat. Do not fail me."',
  'Mara Voss: "You own this harbor now, Nico. Stay golden."',
];
const S = {
  world, screen: 'title', hasSave: false,
  player: { x: 720, y: 670, angle: 0, hp: 100, car: null },
  police: [], bullets: [], money: 0, wanted: 0, armed: false, ammo: 0,
  missionIdx: 0, missionTitle: '', objective: '', dialogue: '', target: null,
  msg: '', msgTimer: 0, muzzle: 0, bustedMeter: 0, hideTimer: 0, seenTimer: 0,
  stage: 0, timer: 0, checkpoints: [], cpIdx: 0, hasPackage: false, time: 0, sirenNear: false,
  spawnPolice, refreshMission,
};
const cam = { x: 0, y: 0 };

function saveGame() {
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify({ money: S.money, missionIdx: S.missionIdx, x: S.player.x, y: S.player.y })); } catch { /* ignore */ }
}
function loadSave() {
  try { const raw = window.localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
S.hasSave = !!loadSave();

function flash(msg) { S.msg = msg; S.msgTimer = 3; }
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
    S.objective = 'Cruise the neon harbor. Steal cars, dodge the law, have fun.';
    S.target = null; return;
  }
  const m = MISSIONS[S.missionIdx];
  S.missionTitle = m.title; S.objective = m.obj;
  S.dialogue = DIALOGUE[S.missionIdx];
  if (S.missionIdx === 0) S.target = { ...world.garage };
  else if (S.missionIdx === 1) S.target = S.stage === 0 ? { x: world.markedCar.x, y: world.markedCar.y } : { ...world.garage };
  else if (S.missionIdx === 2) S.target = null;
  else if (S.missionIdx === 3) S.target = S.checkpoints[S.cpIdx] || null;
  else if (S.missionIdx === 4) S.target = S.stage === 0 ? { ...world.harbor } : { ...world.garage };
}
function completeMission() {
  const pay = MISSIONS[S.missionIdx].pay;
  S.money += pay; flash(`Mission complete! +$${pay}`);
  beep(880, 0.18, 'square', 0.07); setTimeout(() => beep(1320, 0.22, 'square', 0.07), 120);
  S.missionIdx += 1; S.stage = 0; S.hasPackage = false;
  if (S.missionIdx === 2) { /* escape mission starts clean; heat comes from setup below */ }
  if (S.missionIdx === 3) startCheckpoints();
  if (S.missionIdx >= MISSIONS.length) { S.screen = 'win'; }
  refreshMission(); saveGame();
}
function startCheckpoints() {
  S.checkpoints = [
    { x: 2720, y: 220 }, { x: 2720, y: 1570 }, { x: 720, y: 1950 }, { x: 290, y: 220 },
  ];
  S.cpIdx = 0; S.timer = 75;
}
function failMissionTimer() {
  flash('Time up! The Harbor Run restarts — hit the checkpoints!');
  startCheckpoints(); refreshMission();
}
function spawnPolice(n, near) {
  // Spawn ON roads near the player (never inside a building): pick a road through
  // the player's area and place the unit along it, facing the player.
  const roadXs = [220, 720, 1220, 1720, 2220, 2720];
  const roadYs = [220, 670, 1120, 1570, 1950];
  const nearest = (arr, v) => arr.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), arr[0]);
  for (let i = 0; i < n; i++) {
    const d = near ? rng.range(190, 300) : rng.range(550, 850);
    const side = rng.chance(0.5) ? 1 : -1;
    let x, y;
    if (rng.chance(0.5)) { x = Math.min(WORLD_W - 60, Math.max(60, S.player.x + side * d)); y = nearest(roadYs, S.player.y); }
    else { x = nearest(roadXs, S.player.x); y = Math.min(WATER_Y - 60, Math.max(60, S.player.y + side * d)); }
    const angle = Math.atan2(S.player.y - y, S.player.x - x);
    S.police.push({ id: 900 + i + S.police.length, x, y, angle, speed: 0, color: '#dfe6ff', hp: 120, traffic: false, parked: false, skid: [] });
  }
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
    S.ammo -= 1; S.muzzle = 0.07; noiseBurst(0.12, 0.16);
    S.bullets.push({ x: p.x + Math.cos(ang) * 20, y: p.y + Math.sin(ang) * 20, vx: Math.cos(ang) * 720, vy: Math.sin(ang) * 720, life: 0.55 });
    crime(1, p.x, p.y);
  } else if (S.armed && S.ammo <= 0) {
    beep(180, 0.06, 'square', 0.05); flash('Out of ammo!');
  } else {
    // punch: hit whatever is in front
    noiseBurst(0.05, 0.07);
    const hx = p.x + Math.cos(ang) * 34, hy = p.y + Math.sin(ang) * 34;
    for (const ped of world.peds) if (ped.hp > 0 && Math.hypot(ped.x - hx, ped.y - hy) < 26) { hurtPed(ped, 30); crime(1, p.x, p.y); }
    for (const c of S.police) if (Math.hypot(c.x - hx, c.y - hy) < 34) c.hp -= 10;
  }
}
function hurtPed(ped, dmg) {
  ped.hp -= dmg; ped.flee = 3;
  if (ped.hp <= 0) { crime(1, ped.x, ped.y); flash('Pedestrian down! Wanted up.'); }
}

// ---------- update ----------
function update(dt) {
  S.time += dt;
  if (S.msgTimer > 0) S.msgTimer -= dt;
  if (S.muzzle > 0) S.muzzle -= dt;
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
    // water / building safety: blockedAt already prevents entry
    // weapon pickup
    if (!world.weapon.taken && Math.hypot(p.x - world.weapon.x, p.y - world.weapon.y) < 30) {
      world.weapon.taken = true; S.armed = true; S.ammo = 24; flash('Pistol acquired! F / click to shoot.'); beep(1200, 0.12, 'square', 0.07);
    }
    // enter car
    if (input.wasPressed('KeyE')) {
      let best = null, bd = 52;
      for (const c of world.cars) { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = c; } }
      if (best) {
        const wasParked = best.parked;
        p.car = best; best.parked = false; best.traffic = false;
        beep(140, 0.25, 'sawtooth', 0.04, 120);
        if (wasParked) crime(1, p.x, p.y); // stealing in view raises wanted
        if (best.marked && S.missionIdx === 1 && S.stage === 0) { S.stage = 1; flash('Got the gold coupe! Deliver it to the GARAGE.'); refreshMission(); }
        else flash(wasParked ? 'Car stolen!' : 'Driving!');
      }
    }
    // busted check: police pin a slow on-foot player
    let pinning = false;
    for (const c of S.police) if (Math.hypot(c.x - p.x, c.y - p.y) < 58 && p.speedNow < 40) pinning = true;
    if (pinning && S.wanted > 0) { S.bustedMeter += dt; if (S.bustedMeter > 2) { S.screen = 'busted'; beep(220, 0.5, 'square', 0.08, -120); } }
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
    else { if (Math.abs(car.speed) > 130) { p.hp -= 6; noiseBurst(0.15, 0.12); } car.speed *= -0.25; }
    car.x = Math.min(WORLD_W - 30, Math.max(30, car.x)); car.y = Math.min(WATER_Y - 10, Math.max(30, car.y));
    // skid marks when turning hard at speed
    if (Math.abs(car.speed) > 130 && steer) { car.skid.push({ x: car.x, y: car.y }); if (car.skid.length > 46) car.skid.shift(); }
    else if (car.skid.length) car.skid.shift();
    p.x = car.x; p.y = car.y; p.angle = car.angle; p.speedNow = Math.abs(car.speed);
    // running over peds / hitting cars
    for (const ped of world.peds) {
      if (ped.hp > 0 && Math.abs(car.speed) > 30 && Math.hypot(ped.x - car.x, ped.y - car.y) < 26) { hurtPed(ped, 40); crime(1, car.x, car.y); p.hp -= 1; }
    }
    for (const oc of [...world.cars, ...S.police]) {
      if (oc === car) continue;
      if (Math.hypot(oc.x - car.x, oc.y - car.y) < 40 && Math.abs(car.speed) > 60) { oc.hp -= 14; car.speed *= 0.55; p.hp -= 2; noiseBurst(0.1, 0.1); if (S.police.includes(oc)) crime(1, car.x, car.y); }
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
    if (!c.traffic || c.parked || p.car === c) continue;
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

  // --- pedestrians: wander, flee danger ---
  for (const ped of world.peds) {
    if (ped.hp <= 0) continue;
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

  // --- wanted + police ---
  const wantPolice = S.wanted === 0 ? 0 : 1 + S.wanted; // 2..6 cars
  if (S.wanted > 0 && S.police.length < wantPolice && rng.chance(0.02)) spawnPolice(1, false);
  if (S.wanted === 0 && S.police.length) S.police.splice(0, S.police.length);
  let anySee = false;
  for (const c of S.police) {
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < 460) anySee = true;
    const targetA = Math.atan2(p.y - c.y, p.x - c.x);
    let diff = targetA - c.angle;
    while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const top = p.car ? 305 : 235;
    c.speed = Math.min(top, (c.speed || 0) + 200 * dt);
    if (d < 52) c.speed = Math.min(c.speed, 40); // pin / ram range
    const nx = c.x + Math.cos(c.angle) * c.speed * dt, ny = c.y + Math.sin(c.angle) * c.speed * dt;
    if (!blockedAt(nx, ny, 20)) { c.x = nx; c.y = ny; } else { c.angle += 1.4 * dt; c.speed *= 0.5; }
    if (d < 44 && Math.abs(c.speed) > 50) { p.hp -= 9 * dt * 3; if (p.car) p.car.speed *= 0.92; }
    if (c.hp <= 0) { c.dead = true; crime(1, c.x, c.y); flash('Police car wrecked!'); }
  }
  S.police = S.police.filter((c) => !c.dead);
  S.sirenNear = S.police.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 420);
  if (S.sirenNear) { sirenT -= dt; if (sirenT <= 0) { beep(Math.floor(S.time * 2) % 2 ? 660 : 880, 0.16, 'triangle', 0.028); sirenT = 0.18; } }
  if (anySee) { S.hideTimer = 0; S.seenTimer += dt; } else if (S.wanted > 0) {
    S.hideTimer += dt;
    if (S.hideTimer > 7) { S.wanted -= 1; S.hideTimer = 0; flash(S.wanted === 0 ? 'You lost the police!' : 'Heat is cooling…'); }
  }

  // --- bullets ---
  for (const b of S.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const ped of world.peds) if (ped.hp > 0 && Math.hypot(ped.x - b.x, ped.y - b.y) < 12) { hurtPed(ped, 30); b.life = 0; }
    for (const c of [...world.cars, ...S.police]) if (Math.hypot(c.x - b.x, c.y - b.y) < 24) { c.hp -= 22; b.life = 0; if (S.police.includes(c) && c.hp <= 0) { /* handled in police loop next frame */ } }
    if (world.collidesBuilding(b.x, b.y, 2)) b.life = 0;
  }
  S.bullets = S.bullets.filter((b) => b.life > 0);
  // police cars destroyed by bullets
  for (const c of S.police) if (c.hp <= 0) c.dead = true;
  S.police = S.police.filter((c) => !c.dead);

  // --- missions ---
  updateMissions(dt);

  // --- health / wasted ---
  if (p.hp <= 0) { S.screen = 'over'; beep(160, 0.6, 'sawtooth', 0.08, -100); }
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
    S.objective = `HARBOUR RUN: checkpoint ${S.cpIdx + 1}/4 — ${Math.max(0, Math.ceil(S.timer))}s left!`;
    if (S.timer <= 0) failMissionTimer();
    else if (S.checkpoints[S.cpIdx] && distTo(S.checkpoints[S.cpIdx]) < 64) {
      S.cpIdx += 1; beep(990, 0.1, 'square', 0.06);
      if (S.cpIdx >= S.checkpoints.length) completeMission(); else refreshMission();
    }
  } else if (S.missionIdx === 4) {
    if (S.stage === 0 && distTo(world.harbor) < 60) {
      S.stage = 1; S.hasPackage = true; S.wanted = Math.max(S.wanted, 3);
      flash('Package secured! Heavy heat — deliver it to the GARAGE!'); refreshMission();
    } else if (S.stage === 1 && distTo(world.garage) < 70) completeMission();
  }
}

// ---------- flow ----------
function startGame(continueSave) {
  const sv = continueSave ? loadSave() : null;
  if (sv) {
    S.money = sv.money || 0; S.missionIdx = Math.min(sv.missionIdx || 0, MISSIONS.length);
    S.player.x = sv.x || 720; S.player.y = sv.y || 670;
  } else {
    S.money = 0; S.missionIdx = 0; S.player.x = 720; S.player.y = 670;
    try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  }
  S.player.hp = 100; S.player.car = null; S.wanted = 0; S.police = []; S.bullets = [];
  S.stage = 0; S.bustedMeter = 0; S.hasPackage = false;
  if (S.missionIdx === 3) startCheckpoints();
  if (S.missionIdx === 2) S.wanted = 3;
  refreshMission();
  S.screen = 'play';
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
    if (input.wasPressed('KeyM')) { muted = !muted; flash(muted ? 'Sound muted' : 'Sound on'); }
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
      if (input.wasPressed('Enter') || input.mouse.clicked) { S.screen = 'play'; saveGame(); }
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
