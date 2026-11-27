// Entry point for the make.fun submission: stages the finished game into
// the output directory and describes that output with a dossier.
//
// Run it with Node 22, no build step and no extra packages:
//
//   node main.ts
//
// The destination comes from the environment when one is set, and falls
// back to /output otherwise. Everything here only creates and copies;
// nothing already on disk is removed or altered.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The folder this file lives in: game/ and screenshots/ sit beside it.
const here = dirname(fileURLToPath(import.meta.url));

// Where the finished entry goes. The platform normally supplies this;
// /output is the standing default when it does not.
const destination =
  process.env.MAKEFUN_OUTPUT_DIR ??
  process.env.OUTPUT_DIR ??
  '/output';

// Make sure the destination exists, then lay the game and its
// screenshots into it, whole folders, exactly as they sit here.
mkdirSync(destination, { recursive: true });
cpSync(join(here, 'game'), join(destination, 'game'), { recursive: true });
cpSync(join(here, 'screenshots'), join(destination, 'screenshots'), {
  recursive: true,
});

// Describe what was staged, under the bounty's limits, and keep that
// description next to the game as dossier.json.
const dossier = buildDossier(destination, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
});
writeFileSync(join(destination, 'dossier.json'), dossier);
