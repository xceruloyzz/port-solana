// Wanted system for Port Solana: police spawning on roads near the player,
// pursuit and ramming AI, the proximity siren, line-of-sight heat decay, and
// police wreck handling.
import { WORLD_W, WATER_Y } from './config.js';

export function createPolice({ S, rng, blockedAt, crime, flash, audio, effects }) {
  let sirenT = 0;

  function spawn(n, near) {
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
      S.police.push({ id: 900 + i + S.police.length, x, y, angle, speed: 0, color: '#dfe6ff', hp: 120, traffic: false, parked: false, len: 48, wid: 24, skid: [] });
    }
  }

  function update(dt) {
    const p = S.player;
    const wantPolice = S.wanted === 0 ? 0 : 1 + S.wanted; // 2..6 cars
    if (S.wanted > 0 && S.police.length < wantPolice && rng.chance(0.02)) spawn(1, false);
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
      if (c.hp <= 0 && !c.dead) {
        c.dead = true; crime(1, c.x, c.y); flash('Police car wrecked!');
        effects.burst(c.x, c.y);
        if (d < 340) effects.addShake(6);
      }
    }
    S.police = S.police.filter((c) => !c.dead);
    S.sirenNear = S.police.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 420);
    if (S.sirenNear) { sirenT -= dt; if (sirenT <= 0) { audio.beep(Math.floor(S.time * 2) % 2 ? 660 : 880, 0.16, 'triangle', 0.028); sirenT = 0.18; } }
    if (anySee) { S.hideTimer = 0; S.seenTimer += dt; } else if (S.wanted > 0) {
      S.hideTimer += dt;
      if (S.hideTimer > 7) { S.wanted -= 1; S.hideTimer = 0; flash(S.wanted === 0 ? 'You lost the police!' : 'Heat is cooling…'); }
    }
  }
  return { spawn, update };
}
