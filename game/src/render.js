// Rendering for Port Solana: neon-evening city, entities, HUD, screens, minimap.
import { WORLD_W, WORLD_H, WATER_Y, ROAD_W, ROAD_XS, ROAD_YS } from './config.js';

export function createRenderer(canvas, miniCanvas) {
  const ctx = canvas.getContext('2d');
  const mctx = miniCanvas.getContext('2d');
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize(); window.addEventListener('resize', resize);

  function drawCar(c, cam, police) {
    const x = c.x - cam.x, y = c.y - cam.y;
    if (x < -70 || y < -70 || x > canvas.width + 70 || y > canvas.height + 70) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(c.angle);
    // skid marks
    ctx.restore();
    if (c.skid && c.skid.length > 1) { ctx.strokeStyle = 'rgba(10,10,14,.5)'; ctx.lineWidth = 3; ctx.beginPath(); c.skid.forEach((p, i) => { const sx = p.x - cam.x, sy = p.y - cam.y; if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy); }); ctx.stroke(); }
    ctx.save(); ctx.translate(x, y); ctx.rotate(c.angle);
    // headlight glow (tight cone, subtle)
    const g = ctx.createRadialGradient(30, 0, 2, 44, 0, 26);
    g.addColorStop(0, 'rgba(255,240,180,.28)'); g.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = g; ctx.fillRect(20, -18, 44, 36);
    ctx.fillStyle = police ? '#e8ecff' : c.color;
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-24, -12, 48, 24, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = police ? '#2244cc' : 'rgba(12,16,30,.85)';
    ctx.fillRect(-8, -9, 18, 18);
    ctx.fillStyle = '#ffe9a8'; ctx.fillRect(22, -9, 3, 5); ctx.fillRect(22, 4, 3, 5);
    ctx.fillStyle = '#ff2244'; ctx.fillRect(-25, -9, 3, 5); ctx.fillRect(-25, 4, 3, 5);
    if (police) { ctx.fillStyle = (Math.floor(performance.now() / 280) % 2 ? '#ff3355' : '#3388ff'); ctx.fillRect(-4, -3, 8, 6); }
    if (c.marked) { ctx.fillStyle = '#ffd700'; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center'; ctx.fillText('★ TARGET', 0, -22); }
    ctx.restore();
  }

  function drawWorld(S, cam) {
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#141a2e'; ctx.fillRect(0, 0, W, H); // ground / blocks base
    // water (harbor, south)
    ctx.fillStyle = '#0a2e4a'; ctx.fillRect(0, WATER_Y - cam.y, W, WORLD_H - WATER_Y + 400);
    ctx.strokeStyle = 'rgba(0,229,255,.25)';
    for (let i = 0; i < 8; i++) { const wy = WATER_Y + 40 + i * 26 - cam.y; ctx.beginPath(); ctx.moveTo(0, wy); ctx.lineTo(W, wy + Math.sin(i * 2.1) * 4); ctx.stroke(); }
    ctx.fillStyle = '#5a4632'; ctx.fillRect(0, WATER_Y - 14 - cam.y, W, 16); // dock edge
    // sidewalks: lighter border around roads
    ctx.fillStyle = '#232c47';
    for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_W / 2 - 12 - cam.x, -cam.y, ROAD_W + 24, WATER_Y);
    for (const ry of ROAD_YS) ctx.fillRect(-cam.x, ry - ROAD_W / 2 - 12 - cam.y, WORLD_W, ROAD_W + 24);
    // roads
    ctx.fillStyle = '#0d1120';
    for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_W / 2 - cam.x, -cam.y, ROAD_W, WATER_Y);
    for (const ry of ROAD_YS) ctx.fillRect(-cam.x, ry - ROAD_W / 2 - cam.y, WORLD_W, ROAD_W);
    ctx.strokeStyle = 'rgba(255,209,102,.5)'; ctx.setLineDash([18, 16]); ctx.lineWidth = 2;
    for (const rx of ROAD_XS) { ctx.beginPath(); ctx.moveTo(rx - cam.x, -cam.y); ctx.lineTo(rx - cam.x, WATER_Y - cam.y); ctx.stroke(); }
    for (const ry of ROAD_YS) { ctx.beginPath(); ctx.moveTo(-cam.x, ry - cam.y); ctx.lineTo(WORLD_W - cam.x, ry - cam.y); ctx.stroke(); }
    ctx.setLineDash([]);
    // buildings
    for (const b of S.world.buildings) {
      const x = b.x - cam.x, y = b.y - cam.y;
      if (x + b.w < 0 || y + b.h < 0 || x > W || y > H) continue;
      ctx.fillStyle = b.color; ctx.fillRect(x, y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,229,255,.18)'; ctx.strokeRect(x, y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,230,150,.75)';
      const cols = Math.max(2, Math.floor(b.w / 18)), rows = Math.max(2, Math.floor(b.h / 18));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if ((i * 7 + j * 13 + b.floors) % 3 !== 0) ctx.fillRect(x + 5 + i * 16, y + 5 + j * 16, 7, 9);
      if (b.sign) { ctx.fillStyle = b.neon; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('NEON', x + b.w / 2, y + 14); }
    }
    // streetlights
    ctx.fillStyle = '#ffd166';
    for (const l of S.world.lights) { const x = l.x - cam.x, y = l.y - cam.y; if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
    // garage + harbor + weapon markers
    marker(S.world.garage.x, S.world.garage.y, cam, '#69f0ae', 'GARAGE');
    marker(S.world.harbor.x, S.world.harbor.y, cam, '#00e5ff', 'HARBOR');
    if (!S.world.weapon.taken) marker(S.world.weapon.x, S.world.weapon.y, cam, '#ff2e88', 'PISTOL');
    // mission marker with pulsing ring
    if (S.target) {
      const x = S.target.x - cam.x, y = S.target.y - cam.y;
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 20 + Math.sin(performance.now() / 200) * 4, 0, 7); ctx.stroke();
      ctx.fillStyle = '#ffd700'; ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center'; ctx.fillText('▼', x, y - 26);
    }
    // peds
    for (const p of S.world.peds) {
      if (p.hp <= 0) continue;
      const x = p.x - cam.x, y = p.y - cam.y;
      if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(x, y - 2, 3.4, 0, 7); ctx.fill();
    }
    for (const c of S.world.cars) drawCar(c, cam, false);
    for (const c of S.police) drawCar(c, cam, true);
    // bullets + muzzle
    ctx.fillStyle = '#ffe082';
    for (const b of S.bullets) ctx.fillRect(b.x - cam.x - 2, b.y - cam.y - 2, 4, 4);
    if (S.muzzle > 0) { ctx.fillStyle = 'rgba(255,200,60,.9)'; ctx.beginPath(); ctx.arc(S.player.x - cam.x + Math.cos(S.player.angle) * 22, S.player.y - cam.y + Math.sin(S.player.angle) * 22, 9, 0, 7); ctx.fill(); }
    // player (on foot)
    if (!S.player.car) {
      const x = S.player.x - cam.x, y = S.player.y - cam.y;
      ctx.save(); ctx.translate(x, y); ctx.rotate(S.player.angle);
      ctx.fillStyle = '#ff2e88'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill();
      ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(0, -2, 5.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(8, -2, 8, 4);
      ctx.restore();
    }
    // vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.85);
    v.addColorStop(0, 'rgba(4,4,16,0)'); v.addColorStop(1, 'rgba(4,4,16,.5)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  function marker(wx, wy, cam, color, label) {
    const x = wx - cam.x, y = wy - cam.y;
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(x - 16, y - 16, 32, 32);
    ctx.fillStyle = color; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(label, x, y - 22);
  }

  function drawHUD(S) {
    const W = canvas.width;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    // health bar
    ctx.fillStyle = 'rgba(5,8,20,.72)'; ctx.fillRect(12, 12, 236, 64);
    ctx.fillStyle = '#3a0d22'; ctx.fillRect(20, 20, 200, 14);
    ctx.fillStyle = S.player.hp > 30 ? '#00e676' : '#ff3355'; ctx.fillRect(20, 20, 200 * Math.max(0, S.player.hp) / 100, 14);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px system-ui'; ctx.fillText(`$${S.money}`, 20, 40);
    ctx.font = '12px system-ui'; ctx.fillStyle = '#b388ff';
    ctx.fillText(S.player.car ? `Speed ${Math.round(Math.abs(S.player.car.speed) * 0.6)} mph` : (S.armed ? `Pistol · ${S.ammo} ammo` : 'Unarmed — F/click to punch'), 110, 42);
    // wanted stars: one row, gold for earned stars, hollow for the rest, left of the minimap
    ctx.font = '21px system-ui'; ctx.textAlign = 'right';
    let starRow = ''; for (let i = 0; i < 5; i++) starRow += i < S.wanted ? '★' : '☆';
    ctx.fillStyle = S.wanted > 0 ? '#ffd700' : 'rgba(255,255,255,.35)';
    ctx.fillText(starRow, W - 202, 16);
    if (S.wanted > 0) { ctx.font = 'bold 10px system-ui'; ctx.fillStyle = '#ff8a65'; ctx.fillText('WANTED', W - 202, 42); }
    // objective panel
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(5,8,20,.78)'; ctx.fillRect(12, canvas.height - 118, Math.min(560, W - 24), 106);
    ctx.fillStyle = '#00e5ff'; ctx.font = 'bold 14px system-ui'; ctx.fillText(S.missionTitle || 'FREE ROAM', 22, canvas.height - 108);
    ctx.fillStyle = '#fff'; ctx.font = '13px system-ui'; ctx.fillText(S.objective || '', 22, canvas.height - 86);
    if (S.dialogue) { ctx.fillStyle = '#ffd166'; ctx.font = 'italic 13px system-ui'; ctx.fillText(S.dialogue, 22, canvas.height - 64); }
    ctx.fillStyle = '#9fb4d8'; ctx.font = '11px system-ui';
    ctx.fillText('WASD move · Shift sprint · E enter/exit car · F/click attack · P pause · M mute', 22, canvas.height - 40);
    if (S.msgTimer > 0 && S.msg) { ctx.fillStyle = '#69f0ae'; ctx.font = 'bold 17px system-ui'; ctx.textAlign = 'center'; ctx.fillText(S.msg, W / 2, 92); }
    if (S.bustedMeter > 0.15) { ctx.fillStyle = '#ff3355'; ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'center'; ctx.fillText('POLICE ARE PINNING YOU — MOVE!', W / 2, 130); }
  }

  function drawMinimap(S) {
    const w = 180, h = 140, sx = w / WORLD_W, sy = h / WORLD_H;
    mctx.fillStyle = '#0a0f22'; mctx.fillRect(0, 0, w, h);
    mctx.fillStyle = '#0a2e4a'; mctx.fillRect(0, WATER_Y * sy, w, h - WATER_Y * sy);
    mctx.strokeStyle = '#3d4a75'; mctx.lineWidth = 3;
    for (const rx of ROAD_XS) { mctx.beginPath(); mctx.moveTo(rx * sx, 0); mctx.lineTo(rx * sx, h); mctx.stroke(); }
    for (const ry of ROAD_YS) { mctx.beginPath(); mctx.moveTo(0, ry * sy); mctx.lineTo(w, ry * sy); mctx.stroke(); }
    mctx.fillStyle = '#ff3355';
    for (const c of S.police) mctx.fillRect(c.x * sx - 2, c.y * sy - 2, 4, 4);
    if (S.target) { mctx.fillStyle = '#ffd700'; mctx.beginPath(); mctx.arc(S.target.x * sx, S.target.y * sy, 4, 0, 7); mctx.fill(); }
    mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.arc(S.player.x * sx, S.player.y * sy, 3.4, 0, 7); mctx.fill();
  }

  function panel(title, lines, prompt, accent) {
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = 'rgba(4,6,18,.78)'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = accent || '#00e5ff'; ctx.lineWidth = 2;
    ctx.strokeRect(W / 2 - 330, H / 2 - 190, 660, 380);
    ctx.fillStyle = accent || '#00e5ff'; ctx.font = 'bold 42px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, H / 2 - 118);
    ctx.fillStyle = '#e8ecff'; ctx.font = '15px system-ui';
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, H / 2 - 62 + i * 24));
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 16px system-ui';
    ctx.fillText(prompt, W / 2, H / 2 + 158);
  }

  function draw(S, cam) {
    const inGame = S.screen === 'play' || S.screen === 'pause';
    miniCanvas.style.display = inGame ? 'block' : 'none'; // no empty minimap box on menu screens
    drawWorld(S, cam);
    if (inGame) { drawHUD(S); drawMinimap(S); }
    if (S.screen === 'title') panel('PORT SOLANA', ['NEON HARBOR — an original open-world crime story.', '', 'You are Nico Vale, a wheelman down on his luck in a neon harbor city.', 'Fixer Mara Voss has work: steal, run, deliver — and outrun the law.', '', 'Controls: WASD/arrows move · Shift sprint · E enter/exit car', 'F or click: punch / shoot · P pause · M mute sound', S.hasSave ? 'ENTER / click: Continue saved game · N: New game' : ''], S.hasSave ? 'Click or press ENTER to continue' : 'Click or press ENTER to start', '#ff2e88');
    else if (S.screen === 'pause') panel('PAUSED', ['Port Solana waits.'], 'Press P or Esc to resume', '#b388ff');
    else if (S.screen === 'over') panel('WASTED', ['Nico was taken down in Port Solana.', `Money kept in story: $${S.money}`], 'Click or press ENTER to restart', '#ff3355');
    else if (S.screen === 'busted') panel('BUSTED', ['The Port Solana police pinned Nico down.', `Money kept in story: $${S.money}`], 'Click or press ENTER to restart', '#3388ff');
    else if (S.screen === 'win') panel('KING OF THE HARBOR', ['All of Mara\'s jobs are done. Port Solana is yours.', `Final money: $${S.money}`, 'Free roam continues — press ENTER to keep cruising.'], 'Press ENTER for free roam', '#ffd700');
  }
  return { draw };
}
