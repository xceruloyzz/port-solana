// Cosmetic effects for Port Solana: a deterministic particle system (sparks,
// smoke, sparkles), floating cash popups, and camera shake. Effects are purely
// visual — they never touch gameplay state or the __game snapshot — and they
// run on their own seeded RNG so the simulation RNG stream is untouched.
export function createEffects(rng) {
  const particles = [];
  const popups = [];
  let shake = 0;
  let shakeX = 0;
  let shakeY = 0;

  function spawn(kind, x, y, vx, vy, life, size, color) {
    if (particles.length > 420) particles.shift();
    particles.push({ kind, x, y, vx, vy, life, maxLife: life, size, color });
  }
  function sparks(x, y, n = 9) {
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2), sp = rng.range(40, 190);
      spawn('spark', x, y, Math.cos(a) * sp, Math.sin(a) * sp, rng.range(0.18, 0.45), rng.range(1.6, 3), rng.pick(['#ffd166', '#ffb347', '#fff3c4']));
    }
  }
  function smoke(x, y, big = false) {
    spawn('smoke', x + rng.range(-6, 6), y + rng.range(-6, 6), rng.range(-8, 8), rng.range(-34, -18), rng.range(0.7, 1.3), big ? rng.range(9, 15) : rng.range(5, 9), '#3a3230');
  }
  function burst(x, y) { // a car wrecking: spark fan + smoke cloud
    sparks(x, y, 16);
    for (let i = 0; i < 7; i++) smoke(x, y, true);
  }
  function sparkle(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = rng.range(0, Math.PI * 2), sp = rng.range(12, 60);
      spawn('sparkle', x, y, Math.cos(a) * sp, Math.sin(a) * sp - 18, rng.range(0.35, 0.7), rng.range(1.8, 3.2), rng.pick(['#ffd166', '#00e5ff', '#fff3c4']));
    }
  }
  // v3 juice: pale tire smoke while drifting, a boat wake, a muzzle fan and a
  // brass shell that pops out of the pistol and falls.
  function tireSmoke(x, y) {
    spawn('tire', x + rng.range(-4, 4), y + rng.range(-4, 4), rng.range(-10, 10), rng.range(-16, -6), rng.range(0.45, 0.8), rng.range(5, 9), '#cfd4dc');
  }
  function wake(x, y) {
    spawn('wake', x + rng.range(-5, 5), y + rng.range(-5, 5), rng.range(-6, 6), rng.range(-6, 6), rng.range(0.6, 1.0), rng.range(4, 8), '#9fd8ff');
  }
  function muzzleFx(x, y, angle) {
    for (let i = 0; i < 5; i++) {
      const a = angle + rng.range(-0.35, 0.35), sp = rng.range(120, 260);
      spawn('spark', x, y, Math.cos(a) * sp, Math.sin(a) * sp, rng.range(0.06, 0.14), rng.range(1.8, 3), rng.pick(['#ffd166', '#ff9d3c', '#fff3c4']));
    }
    spawn('smoke', x, y, Math.cos(angle) * 22, Math.sin(angle) * 22 - 8, rng.range(0.3, 0.5), rng.range(3, 5), '#3a3230');
  }
  function shell(x, y) {
    spawn('shell', x, y, rng.range(-46, -14), rng.range(-70, -30), rng.range(0.4, 0.6), 2, '#e8b23a');
  }
  function popup(x, y, text, color = '#69f0ae') {
    if (popups.length > 12) popups.shift();
    popups.push({ x, y, text, color, t: 0, life: 1.5 });
  }
  function addShake(amount) { shake = Math.min(15, shake + amount); }

  function update(dt) {
    for (const pt of particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      if (pt.kind === 'spark' || pt.kind === 'shell') { pt.vx *= 0.92; pt.vy = pt.vy * 0.92 + 240 * dt; }
      else if (pt.kind === 'smoke') { pt.vx *= 0.98; pt.vy -= 12 * dt; pt.size += 7 * dt; }
      else if (pt.kind === 'tire') { pt.vx *= 0.96; pt.vy -= 9 * dt; pt.size += 9 * dt; }
      else if (pt.kind === 'wake') { pt.vx *= 0.94; pt.vy *= 0.94; pt.size += 6 * dt; }
      else { pt.vx *= 0.94; pt.vy *= 0.94; }
    }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
    for (const pp of popups) { pp.t += dt; pp.y -= 34 * dt; }
    for (let i = popups.length - 1; i >= 0; i--) if (popups[i].t >= popups[i].life) popups.splice(i, 1);
    shake = Math.max(0, shake - dt * 26);
    if (shake > 0.2) { shakeX = rng.range(-shake, shake); shakeY = rng.range(-shake, shake); }
    else { shakeX = 0; shakeY = 0; }
  }
  return {
    particles, popups, sparks, smoke, burst, sparkle, popup, addShake, update, tireSmoke, wake, muzzleFx, shell,
    get shakeX() { return shakeX; },
    get shakeY() { return shakeY; },
  };
}
