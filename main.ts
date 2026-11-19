// PORT SOLANA: Neon Harbor — entry program for make.fun bounty gta6-01 ("Make GTA 6").
// The game is this directory's game/ folder: an original top-down 2D open-world crime game
// (vanilla JS ES modules on canvas, static files, no network, no build step) with a golden-
// hour neon harbor city larger than the screen, on-foot and driving play, traffic and
// pedestrian AI, a 0-5 star wanted system with police chases, pistol combat, a 7-mission
// story chain for fixer Mara Voss plus taxi fares and neon-chip collectibles, a HUD with
// minimap, title/pause/wasted/busted/win screens, a localStorage save, and WebAudio sounds. This program copies game/ and screenshots/ to the
// output directory and writes dossier.json with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

console.log('PORT SOLANA: Neon Harbor — packaging game/ and screenshots/ for gta6-01');
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Sanity check authored for this entry: the dossier requires 3-4 screenshot images, so fail
// loudly here (exactly where the scorer would) instead of handing in a broken entry.
const shotFiles = existsSync(join(here, 'screenshots'))
  ? readdirSync(join(here, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f))
  : [];
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`PORT SOLANA: screenshots/ must hold 3-4 images, found ${shotFiles.length}: ${shotFiles.join(', ')}`);
}
console.log(`PORT SOLANA: ${shotFiles.length} screenshots packaged: ${shotFiles.join(', ')}`);

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log('PORT SOLANA: dossier.json written — entry ready.');
