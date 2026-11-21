// Rendering for Port Solana v3: a three-district harbor city — neon downtown
// towers with textured façades and rooftop props, industrial docklands with
// warehouses and container stacks, and a beach/residential quarter with sand,
// palms and a lighthouse — under a deterministic day-night cycle with seeded
// rain (see atmosphere.js; everything keys off sim time, never wall clock),
// plus HUD with a district-tinted living minimap, banners, and screens.
import { WORLD_W, WORLD_H, WATER_Y, ROAD_W, ROAD_XS, ROAD_YS } from './config.js';
import { getAtmosphere, hash01 } from './atmosphere.js';
import { BEACH_X, DOCK_Y } from './world.js';

export function createRenderer(canvas, miniCanvas) {
  const ctx = canvas.getContext('2d');
  const mctx = miniCanvas.getContext('2d');
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize(); window.addEventListener('resize', resize);
  let nowT = 0; // S.time for this frame; all animation derives from sim time
  let atmo = getAtmosphere(0, 7); // refreshed every draw()

  function drawCar(c, cam, police) {
    const x = c.x - cam.x, y = c.y - cam.y;
    if (x < -80 || y < -80 || x > canvas.width + 80 || y > canvas.height + 80) return;
    if (c.skid && c.skid.length > 1) { ctx.strokeStyle = 'rgba(10,10,14,.5)'; ctx.lineWidth = 3; ctx.beginPath(); c.skid.forEach((p, i) => { const sx = p.x - cam.x, sy = p.y - cam.y; if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy); }); ctx.stroke(); }
    const L = c.len || 48, Wd = c.wid || 24;
    ctx.save(); ctx.translate(x, y); ctx.rotate(c.angle);
    if (!c.wrecked) {
      // headlight glow (tight cone, subtle; stronger at night)
      const g = ctx.createRadialGradient(L / 2 + 6, 0, 2, L / 2 + 20, 0, 26);
      const ha = 0.30 + atmo.glow * 0.30;
      g.addColorStop(0, `rgba(255,240,180,${ha})`); g.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = g; ctx.fillRect(L / 2, -18, 44, 36);
    }
    ctx.fillStyle = c.wrecked ? '#2b2320' : (police ? '#e8ecff' : c.color);
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-L / 2, -Wd / 2, L, Wd, 6); ctx.fill(); ctx.stroke();
    if (c.truck && !c.wrecked) { // cargo box for vans / trucks
      ctx.fillStyle = 'rgba(240,240,235,.82)'; ctx.fillRect(-L / 2 + 3, -Wd / 2 + 3, L * 0.52, Wd - 6);
      ctx.fillStyle = 'rgba(12,16,30,.85)'; ctx.fillRect(L * 0.14, -Wd / 2 + 4, L * 0.2, Wd - 8);
    } else {
      ctx.fillStyle = police ? '#2244cc' : 'rgba(12,16,30,.85)';
      ctx.fillRect(-L * 0.17, -Wd * 0.38, L * 0.38, Wd * 0.76);
    }
    if (!c.wrecked) {
      ctx.fillStyle = '#ffe9a8'; ctx.fillRect(L / 2 - 2, -Wd / 2 + 3, 3, 5); ctx.fillRect(L / 2 - 2, Wd / 2 - 8, 3, 5);
      ctx.fillStyle = '#ff2244'; ctx.fillRect(-L / 2 - 1, -Wd / 2 + 3, 3, 5); ctx.fillRect(-L / 2 - 1, Wd / 2 - 8, 3, 5);
    }
    if (c.taxi && !c.wrecked) {
      ctx.fillStyle = '#14100a'; ctx.fillRect(-8, -6, 16, 12);
      ctx.fillStyle = '#ffd21f'; ctx.font = 'bold 8px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('TAXI', 0, 0.5); ctx.textBaseline = 'top';
    }
    if (police) { ctx.fillStyle = (Math.floor(nowT * 3.6) % 2 ? '#ff3355' : '#3388ff'); ctx.fillRect(-4, -3, 8, 6); }
    if (c.marked) { ctx.fillStyle = '#ffd700'; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center'; ctx.fillText('★ TARGET', 0, -22); }
    ctx.restore();
  }

  function drawPalm(px, py, s) {
    ctx.strokeStyle = '#6b4a2f'; ctx.lineWidth = 4 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + 3 * s, py - 14 * s, px + 6 * s, py - 26 * s); ctx.stroke();
    const tx = px + 6 * s, ty = py - 26 * s;
    ctx.strokeStyle = '#35b06a'; ctx.lineWidth = 3 * s;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * 0.92 + i * (Math.PI * 0.85 / 5);
      ctx.beginPath(); ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + Math.cos(a) * 11 * s, ty + Math.sin(a) * 9 * s - 3 * s, tx + Math.cos(a) * 17 * s, ty + Math.sin(a) * 13 * s + 3 * s);
      ctx.stroke();
    }
    ctx.fillStyle = '#8a5a2b'; ctx.beginPath(); ctx.arc(tx - 2 * s, ty + 2 * s, 2.2 * s, 0, 7); ctx.arc(tx + 3 * s, ty + 2 * s, 2.2 * s, 0, 7); ctx.fill();
    ctx.lineCap = 'butt';
  }

  // One building: soft drop shadow, textured façade (window grid with
  // lit/unlit variation from the building's own seed + the time-of-day lit
  // fraction), signage band or billboard, awning, and rooftop props.
  function drawBuilding(b, vx, vy, W, H) {
    const x = b.x - vx, y = b.y - vy;
    if (x + b.w < -20 || y + b.h < -20 || x > W + 20 || y > H + 20) return;
    // soft drop shadow, offset south-east
    ctx.fillStyle = 'rgba(12,6,20,.30)';
    ctx.fillRect(x + 9, y + 11, b.w, b.h);
    // body + roof inset + darker trim edge
    ctx.fillStyle = b.color; ctx.fillRect(x, y, b.w, b.h);
    ctx.fillStyle = b.roofColor || b.color; ctx.fillRect(x + 5, y + 5, b.w - 10, b.h - 10);
    ctx.strokeStyle = b.trimColor || 'rgba(0,0,0,.4)'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, b.w - 2, b.h - 2);
    const seed = b.seed || 1;
    if (b.warehouse) {
      // warehouse: skylight strips on the roof, a big dock door on the south
      // face, and sparse small windows high on the walls
      ctx.fillStyle = 'rgba(190,220,235,.30)';
      const strips = Math.max(1, Math.floor(b.w / 64));
      for (let i = 0; i < strips; i++) ctx.fillRect(x + 14 + i * 64, y + 10, 38, b.h - 34);
      ctx.fillStyle = 'rgba(16,14,12,.55)'; ctx.fillRect(x + b.w / 2 - 21, y + b.h - 20, 42, 15);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + b.w / 2 - 21, y + b.h - 13, 42, 2);
      ctx.fillStyle = 'rgba(255,224,160,.75)';
      for (let i = 0; i < Math.floor(b.w / 34); i++) if (hash01(seed ^ (i * 40503)) < atmo.windowLit * (b.litBase || 0.6)) ctx.fillRect(x + 9 + i * 34, y + 7, 8, 6);
    } else {
      // window grid: each cell lit or dark by the building's seeded hash;
      // downtown glass leans cool, houses lean warm
      const cols = Math.max(2, Math.floor(b.w / 17)), rows = Math.max(2, Math.floor(b.h / 17));
      const cw = (b.w - 12) / cols, ch = (b.h - 12) / rows;
      const litP = atmo.windowLit * (b.litBase || 0.8);
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const h1 = hash01(seed ^ Math.imul(i + 1, 73856093) ^ Math.imul(j + 1, 19349663));
        const wx = x + 6 + i * cw, wy = y + 6 + j * ch;
        if (h1 < litP) {
          const cool = b.district === 'downtown' && hash01(seed ^ Math.imul(i + 7, 83492791) ^ Math.imul(j + 3, 29712150)) < 0.4;
          ctx.fillStyle = cool ? 'rgba(174,230,255,.88)' : 'rgba(255,216,140,.88)';
          ctx.fillRect(wx, wy, Math.max(3, cw - 5), Math.max(3, ch - 6));
        } else {
          ctx.fillStyle = 'rgba(10,14,26,.38)';
          ctx.fillRect(wx, wy, Math.max(3, cw - 5), Math.max(3, ch - 6));
        }
      }
    }
    // rooftop props
    if (b.roof === 'helipad') {
      const cx = x + b.w / 2, cy = y + b.h / 2, r = Math.min(b.w, b.h) * 0.34;
      ctx.strokeStyle = 'rgba(255,209,102,.95)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,209,102,.95)'; ctx.font = `bold ${Math.round(r)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('H', cx, cy + 1); ctx.textBaseline = 'top';
    } else if (b.roof === 'wt') { // water tower: tank disc + rim, near a corner
      const cx = x + 16 + hash01(seed ^ 777) * Math.max(4, b.w - 32), cy = y + 16 + hash01(seed ^ 778) * Math.max(4, b.h - 32);
      ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, 7); ctx.fill();
      ctx.strokeStyle = '#4e3822'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, 7); ctx.stroke();
      ctx.fillStyle = '#96754c'; ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, 7); ctx.fill();
    } else if (b.roof === 'ac') { // AC units: 1-3 grey boxes
      ctx.fillStyle = 'rgba(168,175,188,.85)'; ctx.strokeStyle = 'rgba(30,32,40,.5)'; ctx.lineWidth = 1;
      const n = 1 + Math.floor(hash01(seed ^ 555) * 3);
      for (let i = 0; i < n; i++) {
        const ax = x + 10 + hash01(seed ^ (900 + i * 17)) * Math.max(4, b.w - 34), ay = y + 10 + hash01(seed ^ (1200 + i * 23)) * Math.max(4, b.h - 30);
        ctx.fillRect(ax, ay, 13, 10); ctx.strokeRect(ax, ay, 13, 10);
      }
    } else if (b.roof === 'vents') { // docklands vents: dark boxes in a row
      ctx.fillStyle = 'rgba(40,36,34,.7)';
      for (let i = 0; i < Math.floor(b.w / 52); i++) ctx.fillRect(x + 16 + i * 52, y + b.h - 26, 18, 10);
    }
    // signage: billboard (named business) or a neon district sign band
    if (b.billboard) {
      const bw = b.w - 12;
      ctx.fillStyle = b.neon; ctx.fillRect(x + 6, y + 5, bw, 19);
      ctx.fillStyle = '#171126'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let fs = 11; ctx.font = `bold ${fs}px system-ui`;
      while (ctx.measureText(b.billboard).width > bw - 8 && fs > 7) { fs -= 1; ctx.font = `bold ${fs}px system-ui`; }
      ctx.fillText(b.billboard, x + b.w / 2, y + 15);
      ctx.textBaseline = 'top';
    } else if (b.sign && b.signText) {
      const bw = Math.min(b.w - 10, 118);
      ctx.fillStyle = b.neon; ctx.globalAlpha = 0.92; ctx.fillRect(x + b.w / 2 - bw / 2, y + 5, bw, 14); ctx.globalAlpha = 1;
      ctx.fillStyle = '#171126'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.signText, x + b.w / 2, y + 12.5); ctx.textBaseline = 'top';
    }
    // striped awning over the south face (houses, cafés, downtown shops)
    if (b.awning) {
      const aw = Math.min(b.w - 12, 74), ax = x + b.w / 2 - aw / 2, ay = y + b.h - 9;
      for (let i = 0; i < Math.floor(aw / 7); i++) { ctx.fillStyle = i % 2 ? '#f5f0e6' : b.awning; ctx.fillRect(ax + i * 7, ay, 7, 7); }
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(ax, ay + 7, aw, 2);
    }
    // landmark name tag
    if (b.landmark) {
      ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(10,6,20,.85)'; ctx.lineWidth = 3;
      ctx.strokeText(b.landmark, x + b.w / 2, y - 5);
      ctx.fillStyle = '#ffd700'; ctx.fillText(b.landmark, x + b.w / 2, y - 5);
    }
  }

  function drawWorld(S, cam) {
    const W = canvas.width, H = canvas.height;
    const fx = S.effects;
    const ox = fx ? fx.shakeX : 0, oy = fx ? fx.shakeY : 0;
    const vx = cam.x + ox, vy = cam.y + oy; // shaken view origin for world only
    const props = S.world.props || { benches: [], hydrants: [], bushes: [], containers: [], crates: [], umbrellas: [] };
    // --- district ground tints (residential base, downtown, docklands) ---
    ctx.fillStyle = '#4a3d47'; ctx.fillRect(0, 0, W, H); // beach/residential ground
    ctx.fillStyle = '#3b3454'; ctx.fillRect(950 - vx, -vy, 1400, 1250); // downtown blocks
    ctx.fillStyle = '#514236'; ctx.fillRect(BEACH_X - vx, DOCK_Y - vy, WORLD_W - BEACH_X, WATER_Y - DOCK_Y); // docklands ground
    ctx.fillStyle = '#514236'; ctx.fillRect(2520 - vx, -vy, WORLD_W - 2520, WATER_Y); // east industrial fringe
    ctx.fillStyle = '#5d5148'; ctx.fillRect(0 - vx, DOCK_Y - vy, BEACH_X, WATER_Y - DOCK_Y); // south-west residential ground
    // --- water (harbor, south) with animated deterministic shimmer ---
    const waterTop = WATER_Y - vy;
    const wg = ctx.createLinearGradient(0, waterTop, 0, waterTop + 220);
    wg.addColorStop(0, '#1d5a86'); wg.addColorStop(1, '#123a5e');
    ctx.fillStyle = wg; ctx.fillRect(0, waterTop, W, WORLD_H - WATER_Y + 400);
    // moving highlight dashes: offset is a pure function of sim time + row
    for (let row = 0; row < 9; row++) {
      const wy = WATER_Y + 30 + row * 24 - vy;
      if (wy < -6 || wy > H + 6) continue;
      const dir = row % 2 ? 1 : -1;
      const off = ((nowT * 34 * dir + row * 57) % 132 + 132) % 132;
      ctx.strokeStyle = row % 3 === 0 ? 'rgba(255,170,80,.30)' : 'rgba(0,229,255,.20)';
      ctx.lineWidth = 2; ctx.beginPath();
      for (let sx = -132 + off; sx < W + 60; sx += 132) { ctx.moveTo(sx, wy); ctx.lineTo(sx + 46, wy + Math.sin(row * 2.1 + nowT * 0.7) * 2); }
      ctx.stroke();
    }
    // sparkle glints drifting on the swell
    ctx.fillStyle = 'rgba(190,240,255,.35)';
    for (let i = 0; i < 26; i++) {
      const gx = ((hash01(i * 131 + 7) * (WORLD_W + 200) + nowT * (14 + (i % 5) * 6)) % (W + 240)) - 120;
      const gy = WATER_Y + 24 + hash01(i * 733 + 13) * 168 - vy + Math.sin(nowT * 1.4 + i * 1.9) * 2;
      if (gy < -4 || gy > H + 4) continue;
      ctx.fillRect(gx, gy, 9 + (i % 3) * 5, 1.6);
    }
    // boats bobbing on the water
    for (const b of S.world.boats) {
      const bx = b.x - vx, by = b.y - vy + Math.sin(nowT * 1.3 + b.phase) * 3;
      if (bx < -60 || by < -40 || bx > W + 60 || by > H + 40) continue;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.sin(nowT * 0.9 + b.phase) * 0.03);
      ctx.fillStyle = 'rgba(255,190,90,.18)'; ctx.fillRect(-34, 10, 68, 3); // sunset wake
      ctx.fillStyle = b.color; ctx.beginPath(); ctx.roundRect(-26, -8, 52, 16, 6); ctx.fill();
      ctx.fillStyle = '#f5f0e6'; ctx.fillRect(-6, -6, 16, 12);
      ctx.fillStyle = '#2244cc'; ctx.fillRect(-2, -4, 6, 8);
      ctx.restore();
    }
    // --- waterfront edge: sand beach (west) with animated foam, timber dock (east) ---
    ctx.fillStyle = '#d3ab72'; ctx.fillRect(-vx, WATER_Y - 54 - vy, BEACH_X, 54); // sand
    ctx.fillStyle = 'rgba(255,244,214,.5)'; ctx.fillRect(-vx, WATER_Y - 54 - vy, BEACH_X, 5); // dry sand line
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let sx = -40; sx < Math.min(W, BEACH_X - vx); sx += 46) {
      const fy = WATER_Y - 2 - vy + Math.sin(nowT * 1.6 + sx * 0.05) * 2.4;
      ctx.moveTo(sx, fy); ctx.lineTo(sx + 30, fy);
    }
    ctx.stroke();
    ctx.fillStyle = '#6e5136'; ctx.fillRect(BEACH_X - vx, WATER_Y - 14 - vy, WORLD_W - BEACH_X, 16); // dock edge, sunlit timber
    ctx.fillStyle = 'rgba(30,22,16,.6)'; ctx.fillRect(BEACH_X - vx, WATER_Y - 14 - vy, WORLD_W - BEACH_X, 3);
    // dock cranes silhouetted against the sky (docklands waterfront)
    for (const cr of S.world.cranes) {
      const cx = cr.x - vx, cy = WATER_Y - vy;
      if (cx < -140 || cx > W + 140) continue;
      ctx.strokeStyle = '#241a30'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 118); ctx.stroke();
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(cx - 34 * cr.dir, cy - 118); ctx.lineTo(cx + 96 * cr.dir, cy - 118); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,150,80,.55)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(cx + 88 * cr.dir, cy - 118); ctx.lineTo(cx + 88 * cr.dir, cy - 74); ctx.stroke();
      ctx.fillStyle = '#241a30'; ctx.fillRect(cx + 88 * cr.dir - 5, cy - 74, 10, 8);
    }
    // --- sidewalks + roads with markings ---
    ctx.fillStyle = '#5d4a63';
    for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_W / 2 - 12 - vx, -vy, ROAD_W + 24, WATER_Y);
    for (const ry of ROAD_YS) ctx.fillRect(-vx, ry - ROAD_W / 2 - 12 - vy, WORLD_W, ROAD_W + 24);
    ctx.fillStyle = '#2c2739';
    for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_W / 2 - vx, -vy, ROAD_W, WATER_Y);
    for (const ry of ROAD_YS) ctx.fillRect(-vx, ry - ROAD_W / 2 - vy, WORLD_W, ROAD_W);
    // solid edge lines
    ctx.strokeStyle = 'rgba(240,240,230,.20)'; ctx.lineWidth = 2;
    for (const rx of ROAD_XS) for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(rx + s * (ROAD_W / 2 - 5) - vx, -vy); ctx.lineTo(rx + s * (ROAD_W / 2 - 5) - vx, WATER_Y - vy); ctx.stroke(); }
    for (const ry of ROAD_YS) for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-vx, ry + s * (ROAD_W / 2 - 5) - vy); ctx.lineTo(WORLD_W - vx, ry + s * (ROAD_W / 2 - 5) - vy); ctx.stroke(); }
    // centre lane dashes
    ctx.strokeStyle = 'rgba(255,190,90,.55)'; ctx.setLineDash([18, 16]); ctx.lineWidth = 2;
    for (const rx of ROAD_XS) { ctx.beginPath(); ctx.moveTo(rx - vx, -vy); ctx.lineTo(rx - vx, WATER_Y - vy); ctx.stroke(); }
    for (const ry of ROAD_YS) { ctx.beginPath(); ctx.moveTo(-vx, ry - vy); ctx.lineTo(WORLD_W - vx, ry - vy); ctx.stroke(); }
    ctx.setLineDash([]);
    // crosswalks + stop lines at every intersection
    ctx.fillStyle = 'rgba(240,240,230,.34)';
    for (const rx of ROAD_XS) for (const ry of ROAD_YS) {
      const cx = rx - vx, cy = ry - vy;
      if (cx < -90 || cy < -90 || cx > W + 90 || cy > H + 90) continue;
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(cx + i * 19 - 6, cy - ROAD_W / 2 - 15, 12, 11); // north zebra
        ctx.fillRect(cx + i * 19 - 6, cy + ROAD_W / 2 + 4, 12, 11); // south zebra
        ctx.fillRect(cx - ROAD_W / 2 - 15, cy + i * 19 - 6, 11, 12); // west zebra
        ctx.fillRect(cx + ROAD_W / 2 + 4, cy + i * 19 - 6, 11, 12); // east zebra
      }
      ctx.fillStyle = 'rgba(240,240,230,.5)';
      ctx.fillRect(cx - ROAD_W / 2 + 8, cy - ROAD_W / 2 - 21, ROAD_W / 2 - 14, 4); // stop lines
      ctx.fillRect(cx + 6, cy + ROAD_W / 2 + 17, ROAD_W / 2 - 14, 4);
      ctx.fillStyle = 'rgba(240,240,230,.34)';
    }
    // --- buildings (textured façades, shadows, rooftop props) ---
    for (const b of S.world.buildings) drawBuilding(b, vx, vy, W, H);
    // --- containers + crates (docklands dressing) ---
    for (const c of props.containers) {
      const x = c.x - vx, y = c.y - vy;
      if (x + c.w < -10 || y + c.h < -10 || x > W + 10 || y > H + 10) continue;
      ctx.fillStyle = 'rgba(12,6,20,.28)'; ctx.fillRect(x + 5, y + 6, c.w, c.h);
      ctx.fillStyle = c.color; ctx.fillRect(x, y, c.w, c.h);
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, c.w - 1, c.h - 1);
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      for (let i = 1; i < 5; i++) ctx.fillRect(x + i * (c.w / 5), y + 2, 2, c.h - 4); // corrugation
      if (c.stack) { // a second box stacked on top, drawn offset
        ctx.fillStyle = c.color; ctx.globalAlpha = 0.92; ctx.fillRect(x + 4, y - 7, c.w - 8, 9); ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.strokeRect(x + 4.5, y - 6.5, c.w - 9, 8);
      }
    }
    ctx.fillStyle = '#9a7448';
    for (const cr of props.crates) {
      const x = cr.x - vx, y = cr.y - vy;
      if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      ctx.fillRect(x, y, cr.s, cr.s);
      ctx.strokeStyle = 'rgba(60,40,20,.6)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, cr.s - 1, cr.s - 1);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cr.s, y + cr.s); ctx.moveTo(x + cr.s, y); ctx.lineTo(x, y + cr.s); ctx.stroke();
    }
    // --- vegetation + small street props ---
    for (const bs of props.bushes) {
      const x = bs.x - vx, y = bs.y - vy;
      if (x < -24 || y < -24 || x > W + 24 || y > H + 24) continue;
      ctx.fillStyle = '#2e6b3e';
      ctx.beginPath(); ctx.arc(x, y, 8 * bs.s, 0, 7); ctx.arc(x + 7 * bs.s, y + 2 * bs.s, 6 * bs.s, 0, 7); ctx.arc(x - 7 * bs.s, y + 2 * bs.s, 6 * bs.s, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(110,220,140,.35)'; ctx.beginPath(); ctx.arc(x - 2 * bs.s, y - 3 * bs.s, 3.4 * bs.s, 0, 7); ctx.fill();
    }
    for (const pm of S.world.palms) {
      const x = pm.x - vx, y = pm.y - vy;
      if (x < -40 || y < -50 || x > W + 40 || y > H + 20) continue;
      drawPalm(x, y, pm.s);
    }
    // beach umbrellas on the sand
    for (const u of props.umbrellas) {
      const x = u.x - vx, y = u.y - vy;
      if (x < -24 || y < -24 || x > W + 24 || y > H + 24) continue;
      ctx.strokeStyle = '#e8e2d2'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 9 * u.s); ctx.stroke();
      ctx.fillStyle = u.color;
      ctx.beginPath(); ctx.moveTo(x - 13 * u.s, y - 6 * u.s); ctx.quadraticCurveTo(x + 3, y - 17 * u.s, x + 16 * u.s, y - 6 * u.s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(245,240,230,.85)'; ctx.fillRect(x - 8, y + 3, 15, 5); // towel
    }
    // benches + hydrants
    ctx.fillStyle = '#7a5a3a';
    for (const bn of props.benches) {
      const x = bn.x - vx, y = bn.y - vy;
      if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      if (bn.vert) ctx.fillRect(x - 3, y - 9, 6, 18); else ctx.fillRect(x - 9, y - 3, 18, 6);
      ctx.fillStyle = '#5d4430'; if (bn.vert) ctx.fillRect(x - 3, y - 2, 6, 3); else ctx.fillRect(x - 2, y - 3, 3, 6);
      ctx.fillStyle = '#7a5a3a';
    }
    for (const hd of props.hydrants) {
      const x = hd.x - vx, y = hd.y - vy;
      if (x < -12 || y < -12 || x > W + 12 || y > H + 12) continue;
      ctx.fillStyle = '#d23b2e'; ctx.beginPath(); ctx.arc(x, y, 4.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(x, y - 1, 1.8, 0, 7); ctx.fill();
    }
    // lighthouse on the beach point (residential landmark)
    const lh = (S.world.landmarks || []).find((l) => l.kind === 'lighthouse');
    if (lh) {
      const x = lh.x - vx, y = lh.y - vy;
      if (x > -70 && y > -70 && x < W + 70 && y < H + 70) {
        ctx.fillStyle = 'rgba(12,6,20,.3)'; ctx.beginPath(); ctx.ellipse(x + 5, y + 8, 15, 6, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#e8e2d2'; ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.fill();
        ctx.fillStyle = '#d23b2e'; ctx.beginPath(); ctx.arc(x, y, 13, 0.6, 2.2); ctx.arc(x, y, 13, 3.7, 5.3); ctx.fill();
        ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(20,16,30,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.stroke();
        ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(10,6,20,.85)'; ctx.lineWidth = 3; ctx.strokeText('LIGHTHOUSE', x, y - 20);
        ctx.fillStyle = '#ffd700'; ctx.fillText('LIGHTHOUSE', x, y - 20);
      }
    }
    // streetlights (dots by day; glow halos are added after the night grade)
    ctx.fillStyle = '#ffd166';
    for (const l of S.world.lights) { const x = l.x - vx, y = l.y - vy; if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
    // neon chips: glowing diamonds, pulsing on sim time
    for (const ch of S.world.chips) {
      if (ch.taken) continue;
      const x = ch.x - vx, y = ch.y - vy;
      if (x < -30 || y < -30 || x > W + 30 || y > H + 30) continue;
      const pulse = 1 + Math.sin(nowT * 4 + ch.id * 1.7) * 0.18;
      ctx.fillStyle = 'rgba(255,209,102,.22)'; ctx.beginPath(); ctx.arc(x, y, 17 * pulse, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.scale(pulse, pulse);
      ctx.fillStyle = '#ffd166'; ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = '#fff3c4'; ctx.fillRect(-3.5, -3.5, 7, 7);
      ctx.restore();
    }
    // garage + harbor + weapon markers
    marker(S.world.garage.x, S.world.garage.y, vx, vy, '#69f0ae', 'GARAGE');
    marker(S.world.harbor.x, S.world.harbor.y, vx, vy, '#00e5ff', 'HARBOR');
    if (!S.world.weapon.taken) marker(S.world.weapon.x, S.world.weapon.y, vx, vy, '#ff2e88', 'PISTOL');
    // mission marker with pulsing ring
    if (S.target) {
      const x = S.target.x - vx, y = S.target.y - vy;
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 20 + Math.sin(nowT * 5) * 4, 0, 7); ctx.stroke();
      ctx.fillStyle = '#ffd700'; ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center'; ctx.fillText('▼', x, y - 26);
    }
    // peds (a boarded taxi passenger is inside the cab, not drawn)
    for (const p of S.world.peds) {
      if (p.hp <= 0 || p.boarded) continue;
      const x = p.x - vx, y = p.y - vy;
      if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(x, y - 2, 3.4, 0, 7); ctx.fill();
      if (S.taxi && S.taxi.ped === p && S.taxi.state === 'idle') {
        const bob = Math.sin(nowT * 5) * 3;
        ctx.fillStyle = '#ffd700'; ctx.font = 'bold 19px system-ui'; ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(10,6,20,.85)'; ctx.lineWidth = 3;
        ctx.strokeText('!', x, y - 30 + bob); ctx.fillText('!', x, y - 30 + bob);
      }
    }
    for (const c of S.world.cars) drawCar({ ...c, x: c.x - ox, y: c.y - oy }, cam, false);
    for (const c of S.police) drawCar({ ...c, x: c.x - ox, y: c.y - oy }, cam, true);
    // bullets + muzzle
    ctx.fillStyle = '#ffe082';
    for (const b of S.bullets) ctx.fillRect(b.x - vx - 2, b.y - vy - 2, 4, 4);
    if (S.muzzle > 0) { ctx.fillStyle = 'rgba(255,200,60,.9)'; ctx.beginPath(); ctx.arc(S.player.x - vx + Math.cos(S.player.angle) * 22, S.player.y - vy + Math.sin(S.player.angle) * 22, 9, 0, 7); ctx.fill(); }
    // player (on foot)
    if (!S.player.car) {
      const x = S.player.x - vx, y = S.player.y - vy;
      ctx.save(); ctx.translate(x, y); ctx.rotate(S.player.angle);
      ctx.fillStyle = '#ff2e88'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill();
      ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(0, -2, 5.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(8, -2, 8, 4);
      ctx.restore();
    }
    // effects: particles, then floating cash popups
    if (fx) {
      for (const pt of fx.particles) {
        const x = pt.x - vx, y = pt.y - vy;
        if (x < -30 || y < -30 || x > W + 30 || y > H + 30) continue;
        const a = Math.max(0, pt.life / pt.maxLife);
        if (pt.kind === 'smoke') { ctx.fillStyle = `rgba(58,50,48,${0.42 * a})`; ctx.beginPath(); ctx.arc(x, y, pt.size, 0, 7); ctx.fill(); }
        else { ctx.globalAlpha = a; ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(x, y, pt.size, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      }
      ctx.textAlign = 'center';
      for (const pp of fx.popups) {
        const x = pp.x - vx, y = pp.y - vy;
        const a = Math.max(0, 1 - pp.t / pp.life);
        ctx.globalAlpha = a; ctx.font = 'bold 16px system-ui';
        ctx.strokeStyle = 'rgba(10,6,20,.9)'; ctx.lineWidth = 3;
        ctx.strokeText(pp.text, x, y); ctx.fillStyle = pp.color; ctx.fillText(pp.text, x, y);
        ctx.globalAlpha = 1;
      }
    }
    // --- atmosphere grade: tint wash, then night darkness (+ rain dimming) ---
    const [tr, tg, tb] = atmo.tint;
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, `rgba(${tr | 0},${tg | 0},${tb | 0},${atmo.tintA})`);
    gr.addColorStop(0.5, `rgba(${tr | 0},${tg | 0},${tb | 0},${atmo.tintA * 0.4})`);
    gr.addColorStop(1, `rgba(38,12,64,${0.06 + atmo.darkness * 0.10})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    if (waterLineVisible(waterTop, H)) {
      const sun = ctx.createRadialGradient(W / 2, waterTop, 10, W / 2, waterTop, 340);
      sun.addColorStop(0, `rgba(255,150,60,${0.20 * (1 - atmo.darkness)})`); sun.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    }
    const dark = Math.min(0.62, atmo.darkness * 0.62 + atmo.rain * 0.10);
    if (dark > 0.01) { ctx.fillStyle = `rgba(7,9,34,${dark})`; ctx.fillRect(0, 0, W, H); }
    // --- glow pass (additive): streetlights, lighthouse beam at night ---
    if (atmo.glow > 0.05) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const l of S.world.lights) {
        const x = l.x - vx, y = l.y - vy;
        if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue;
        const g = ctx.createRadialGradient(x, y, 1, x, y, 30);
        g.addColorStop(0, `rgba(255,196,96,${0.20 * atmo.glow})`); g.addColorStop(1, 'rgba(255,196,96,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 30, 0, 7); ctx.fill();
      }
      if (lh && atmo.darkness > 0.2) { // rotating lighthouse beam, angle from sim time
        const x = lh.x - vx, y = lh.y - vy;
        if (x > -320 && y > -320 && x < W + 320 && y < H + 320) {
          const a = nowT * 0.7;
          const bg = ctx.createRadialGradient(x, y, 4, x, y, 300);
          bg.addColorStop(0, `rgba(255,236,170,${0.16 * atmo.glow})`); bg.addColorStop(1, 'rgba(255,236,170,0)');
          ctx.fillStyle = bg;
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.arc(x, y, 300, a - 0.16, a + 0.16); ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    }
    // --- rain streaks (deterministic: positions are a function of sim time) ---
    if (atmo.rain > 0.03) {
      ctx.strokeStyle = `rgba(174,194,224,${0.38 * atmo.rain})`; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 130; i++) {
        const bx = hash01(i * 311 + 7) * (W + 200) - 100;
        const fall = (hash01(i * 733 + 13) * 900 + nowT * 640) % (H + 120);
        const x = bx + fall * 0.16, y = fall - 60;
        ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 15);
      }
      ctx.stroke();
      // splash rings where drops land near the ground plane
      ctx.strokeStyle = `rgba(174,194,224,${0.20 * atmo.rain})`;
      ctx.beginPath();
      for (let i = 0; i < 36; i++) {
        const sx = hash01(i * 977 + 31) * W, sy = hash01(i * 389 + 17) * H;
        const rr = 2 + ((nowT * 9 + i * 2.3) % 5);
        ctx.moveTo(sx + rr, sy); ctx.arc(sx, sy, rr, 0, 7);
      }
      ctx.stroke();
    }
    // vignette (deepens with the night)
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.85);
    v.addColorStop(0, 'rgba(24,6,20,0)'); v.addColorStop(1, `rgba(24,6,20,${0.34 + atmo.darkness * 0.25})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  function waterLineVisible(waterTop, H) { return waterTop > -80 && waterTop < H + 80; }
  function marker(wx, wy, vx, vy, color, label) {
    const x = wx - vx, y = wy - vy;
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(x - 16, y - 16, 32, 32);
    ctx.fillStyle = color; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(label, x, y - 22);
  }

  function drawBanner(S) {
    if (!S.banners || !S.banners.length) return;
    const b = S.banners[0];
    const W = canvas.width;
    const alpha = Math.min(1, b.t / 0.45, (b.dur - b.t) / 0.25 + 0.15);
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    const bw = Math.min(560, W - 40), bx = W / 2 - bw / 2, by = 58;
    ctx.fillStyle = 'rgba(8,8,24,.84)'; ctx.fillRect(bx, by, bw, 64);
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, 64);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 21px system-ui'; ctx.fillText(b.title, W / 2, by + 9);
    ctx.fillStyle = '#e8ecff'; ctx.font = '13px system-ui';
    const sub = b.sub.length > 74 ? b.sub.slice(0, 73) + '…' : b.sub;
    ctx.fillText(sub, W / 2, by + 38);
    ctx.restore();
  }

  function drawEdgeArrow(S, cam) {
    if (!S.target) return;
    const W = canvas.width, H = canvas.height;
    const tx = S.target.x - cam.x, ty = S.target.y - cam.y;
    if (tx > 30 && tx < W - 30 && ty > 30 && ty < H - 30) return; // on screen already
    const px = S.player.x - cam.x, py = S.player.y - cam.y;
    const ang = Math.atan2(ty - py, tx - px);
    let ex = Math.min(W - 34, Math.max(34, tx)), ey = Math.min(H - 34, Math.max(34, ty));
    // Keep the arrow clear of the HUD furniture: health panel, minimap, objective panel.
    if (ex < 262 && ey < 114) ey = 114;
    if (ex > W - 232 && ey < 178) ey = 178;
    if (ex < 596 && ey > H - 148) ey = H - 148;
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
    ctx.fillStyle = '#ffd700'; ctx.strokeStyle = 'rgba(10,6,20,.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-9, -10); ctx.lineTo(-4, 0); ctx.lineTo(-9, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    const d = Math.hypot(S.target.x - S.player.x, S.target.y - S.player.y);
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(d / 4)} m`, ex, ey + 16);
  }

  function drawHUD(S, cam) {
    const W = canvas.width;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    // health / cash / status panel
    ctx.fillStyle = 'rgba(5,8,20,.72)'; ctx.fillRect(12, 12, 236, 84);
    ctx.fillStyle = '#3a0d22'; ctx.fillRect(20, 20, 200, 14);
    ctx.fillStyle = S.player.hp > 30 ? '#00e676' : '#ff3355'; ctx.fillRect(20, 20, 200 * Math.max(0, S.player.hp) / 100, 14);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px system-ui'; ctx.fillText(`$${S.money}`, 20, 40);
    ctx.font = '12px system-ui'; ctx.fillStyle = '#b388ff';
    ctx.fillText(S.player.car ? `Speed ${Math.round(Math.abs(S.player.car.speed) * 0.6)} mph` : (S.armed ? `Pistol · ${S.ammo} ammo` : 'Unarmed — F/click to punch'), 110, 42);
    ctx.font = '12px system-ui'; ctx.fillStyle = '#ffd166';
    ctx.fillText(`◆ Neon chips ${S.chipsCollected}/12`, 20, 62);
    ctx.fillStyle = '#9fb4d8';
    ctx.fillText(S.taxiCount > 0 ? `Taxi fares ${S.taxiCount} · $${S.taxiEarned} earned` : 'Free-roam taxi fares after the story', 20, 78);
    // wanted stars: one row, gold for earned stars, hollow for the rest, left of the minimap
    ctx.font = '21px system-ui'; ctx.textAlign = 'right';
    let starRow = ''; for (let i = 0; i < 5; i++) starRow += i < S.wanted ? '★' : '☆';
    ctx.fillStyle = S.wanted > 0 ? '#ffd700' : 'rgba(255,255,255,.35)';
    ctx.fillText(starRow, W - 202, 16);
    if (S.wanted > 0) { ctx.font = 'bold 10px system-ui'; ctx.fillStyle = '#ff8a65'; ctx.fillText('WANTED', W - 202, 42); }
    // sky / weather readout under the stars (deterministic sim atmosphere)
    ctx.font = 'bold 11px system-ui'; ctx.fillStyle = atmo.raining ? '#9fd8ff' : '#ffd9a0';
    ctx.fillText(atmo.raining ? `${atmo.name} · RAIN` : atmo.name, W - 202, 58);
    // objective panel
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(5,8,20,.78)'; ctx.fillRect(12, canvas.height - 118, Math.min(560, W - 24), 106);
    ctx.fillStyle = '#00e5ff'; ctx.font = 'bold 14px system-ui'; ctx.fillText(S.missionTitle || 'FREE ROAM', 22, canvas.height - 108);
    if (S.target) {
      const d = Math.hypot(S.target.x - S.player.x, S.target.y - S.player.y);
      ctx.fillStyle = '#ffd700'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'right';
      ctx.fillText(`TARGET ${Math.round(d / 4)} m`, 22 + Math.min(560, W - 24) - 10, canvas.height - 107);
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = '#fff'; ctx.font = '13px system-ui'; ctx.fillText(S.objective || '', 22, canvas.height - 86);
    if (S.dialogue) { ctx.fillStyle = '#ffd166'; ctx.font = 'italic 13px system-ui'; ctx.fillText(S.dialogue, 22, canvas.height - 64); }
    ctx.fillStyle = '#9fb4d8'; ctx.font = '11px system-ui';
    ctx.fillText('WASD move · Shift sprint · E enter/exit car · F/click attack · P pause · M mute', 22, canvas.height - 40);
    if (S.msgTimer > 0 && S.msg) { ctx.fillStyle = '#69f0ae'; ctx.font = 'bold 17px system-ui'; ctx.textAlign = 'center'; ctx.fillText(S.msg, W / 2, 128); }
    if (S.bustedMeter > 0.15) { ctx.fillStyle = '#ff3355'; ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'center'; ctx.fillText('POLICE ARE PINNING YOU — MOVE!', W / 2, 164); }
    drawBanner(S);
    drawEdgeArrow(S, cam);
  }

  function drawMinimap(S) {
    const w = 180, h = 140, sx = w / WORLD_W, sy = h / WORLD_H;
    // district tints: residential base, downtown, docklands, beach sand, water
    mctx.fillStyle = '#4a3d47'; mctx.fillRect(0, 0, w, h);
    mctx.fillStyle = '#463d63'; mctx.fillRect(950 * sx, 0, 1400 * sx, 1250 * sy); // downtown
    mctx.fillStyle = '#5d4a38'; mctx.fillRect(BEACH_X * sx, DOCK_Y * sy, (WORLD_W - BEACH_X) * sx, (WATER_Y - DOCK_Y) * sy); // docklands
    mctx.fillStyle = '#5d4a38'; mctx.fillRect(2520 * sx, 0, (WORLD_W - 2520) * sx, WATER_Y * sy); // east fringe
    mctx.fillStyle = '#d3ab72'; mctx.fillRect(0, (WATER_Y - 54) * sy, BEACH_X * sx, 54 * sy); // beach
    mctx.fillStyle = '#17456b'; mctx.fillRect(0, WATER_Y * sy, w, h - WATER_Y * sy); // water
    // buildings as blocks, tinted by district; landmarks in gold
    for (const b of S.world.buildings) {
      mctx.fillStyle = b.landmark ? '#ffd700' : b.district === 'downtown' ? '#8fa3cc' : b.district === 'docklands' ? '#b08d5f' : '#c9a27a';
      mctx.fillRect(b.x * sx, b.y * sy, Math.max(1.4, b.w * sx), Math.max(1.4, b.h * sy));
    }
    // roads
    mctx.strokeStyle = 'rgba(220,220,235,.5)'; mctx.lineWidth = 2;
    for (const rx of ROAD_XS) { mctx.beginPath(); mctx.moveTo(rx * sx, 0); mctx.lineTo(rx * sx, h); mctx.stroke(); }
    for (const ry of ROAD_YS) { mctx.beginPath(); mctx.moveTo(0, ry * sy); mctx.lineTo(w, ry * sy); mctx.stroke(); }
    // landmark markers: gold diamonds (lighthouse gets a white core)
    for (const lm of S.world.landmarks || []) {
      const x = lm.x * sx, y = lm.y * sy;
      mctx.save(); mctx.translate(x, y); mctx.rotate(Math.PI / 4);
      mctx.fillStyle = '#ffd700'; mctx.fillRect(-3, -3, 6, 6);
      mctx.strokeStyle = 'rgba(10,6,20,.8)'; mctx.lineWidth = 1; mctx.strokeRect(-3, -3, 6, 6);
      mctx.restore();
      if (lm.kind === 'lighthouse') { mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.arc(x, y, 1.8, 0, 7); mctx.fill(); }
    }
    mctx.fillStyle = '#69f0ae'; mctx.fillRect(S.world.garage.x * sx - 2.5, S.world.garage.y * sy - 2.5, 5, 5); // garage
    mctx.fillStyle = '#00e5ff'; mctx.fillRect(S.world.harbor.x * sx - 2.5, S.world.harbor.y * sy - 2.5, 5, 5); // harbor
    mctx.fillStyle = '#ffd166';
    for (const ch of S.world.chips) if (!ch.taken) mctx.fillRect(ch.x * sx - 1.2, ch.y * sy - 1.2, 2.4, 2.4); // chips left
    if (S.taxi && S.taxi.ped && S.taxi.state === 'idle') { mctx.fillStyle = '#ff8a65'; mctx.beginPath(); mctx.arc(S.taxi.ped.x * sx, S.taxi.ped.y * sy, 3, 0, 7); mctx.fill(); }
    mctx.fillStyle = '#ff3355';
    for (const c of S.police) mctx.fillRect(c.x * sx - 2, c.y * sy - 2, 4, 4);
    if (S.target) { mctx.fillStyle = '#ffd700'; mctx.beginPath(); mctx.arc(S.target.x * sx, S.target.y * sy, 4, 0, 7); mctx.fill(); }
    mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.arc(S.player.x * sx, S.player.y * sy, 3.4, 0, 7); mctx.fill();
    // night dimming on the map itself
    if (atmo.darkness > 0.05) { mctx.fillStyle = `rgba(7,9,34,${atmo.darkness * 0.30})`; mctx.fillRect(0, 0, w, h); }
  }

  function panel(title, lines, prompt, accent) {
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = 'rgba(10,6,22,.72)'; ctx.fillRect(0, 0, W, H);
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
    nowT = S.time || 0;
    atmo = getAtmosphere(nowT, S.seed ?? 7);
    const inGame = S.screen === 'play' || S.screen === 'pause';
    miniCanvas.style.display = inGame ? 'block' : 'none'; // no empty minimap box on menu screens
    drawWorld(S, cam);
    if (inGame) { drawHUD(S, cam); drawMinimap(S); }
    if (S.screen === 'title') panel('PORT SOLANA', ['NEON HARBOR — an original open-world crime story.', '', 'You are Nico Vale, a wheelman down on his luck in a sun-soaked', 'neon harbor city at golden hour. Fixer Mara Voss has work:', 'steal, run, deliver — and outrun the law.', 'Seven story jobs, taxi fares and 12 hidden neon chips await.', 'Controls: WASD/arrows move · Shift sprint · E enter/exit car', 'F or click: punch / shoot · P pause · M mute sound', S.hasSave ? 'ENTER / click: Continue saved game · N: New game' : ''], S.hasSave ? 'Click or press ENTER to continue' : 'Click or press ENTER to start', '#ff2e88');
    else if (S.screen === 'pause') panel('PAUSED', ['Port Solana waits.'], 'Press P or Esc to resume', '#b388ff');
    else if (S.screen === 'over') panel('WASTED', ['Nico was taken down in Port Solana.', `Money kept in story: $${S.money}`], 'Click or press ENTER to restart', '#ff3355');
    else if (S.screen === 'busted') panel('BUSTED', ['The Port Solana police pinned Nico down.', `Money kept in story: $${S.money}`], 'Click or press ENTER to restart', '#3388ff');
    else if (S.screen === 'win') panel('KING OF THE HARBOR', ['All seven of Mara\'s jobs are done. Port Solana is yours.', `Final money: $${S.money}`, 'Free roam continues — run taxi fares and hunt the neon chips.'], 'Press ENTER for free roam', '#ffd700');
  }
  return { draw };
}
