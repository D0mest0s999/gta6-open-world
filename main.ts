// SUNFALL: Neon Harbor — hand-in program for the gta6-01 bounty.
//
// The entry itself is the static game in game/ (open game/index.html in a
// browser and play; it needs no build and no network). This program's one
// job is packaging: copy game/ and screenshots/ into the output folder
// and write dossier.json there with the kit's vendored buildDossier, so
// the grader sees exactly the bytes that were submitted.
//
// Run it the way the kit prescribes:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// MAKEFUN_OUTPUT_DIR stands in for the grader's /output outside it.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return n;
}

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The caps below mirror the gate's own limits (the dossier's text cap and
// the per-part file/size ceilings), so a package that would fail the
// scorer fails here first, on the maker's machine.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

// A one-line receipt for the maker: what went into the package. (Console
// output only — the dossier bytes above are the deliverable, and they do
// not depend on this summary.)
console.log(
  `SUNFALL hand-in: ${countFiles(join(outDir, 'game'))} game files, ` +
  `${countFiles(join(outDir, 'screenshots'))} screenshots, dossier ${dossier.length} bytes -> ${outDir}`,
);
