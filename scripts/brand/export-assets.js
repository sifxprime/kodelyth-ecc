#!/usr/bin/env node
'use strict';

/**
 * Render every social SVG to its 8K PNG export.
 *
 * The PNGs under social/exports/8k/ are rasterised copies of the SVGs, used where
 * an SVG will not do — GitHub's social preview, and most social platforms, accept
 * only raster uploads. Nothing regenerated them, so they drifted badly: by v2.24.5
 * the exports still read v2.7.0, 97 commands and 22+ hooks, against an actual
 * 103 and 44. The SVGs had been corrected several times; the PNGs never were.
 *
 * Every existing export is 7680px wide with the aspect ratio taken from the SVG's
 * own viewBox, so that is what this reproduces.
 *
 *   node scripts/brand/export-assets.js                 # render all
 *   node scripts/brand/export-assets.js --check         # report stale, change nothing
 *   node scripts/brand/export-assets.js card-main       # render one, by name
 *
 * --check compares mtimes and exits non-zero when any PNG is older than its SVG,
 * so a release step can catch exports that no longer match their source.
 *
 * Requires rsvg-convert (librsvg). It is not installed by default anywhere, so its
 * absence is reported as a clear instruction rather than a spawn error.
 *
 * On the choice of renderer: brand/convert.js already renders the brand/ lockups
 * with puppeteer-core, chosen there for font fidelity, and consistency would argue
 * for using it here too. It is not used because it cannot run — puppeteer-core is
 * neither installed nor declared in package.json, so `node brand/convert.js` fails
 * on a clean checkout. That is most likely why these exports went stale in the
 * first place: the tool named in .gitignore for regenerating them does not work.
 *
 * rsvg-convert was checked against the output it replaces rather than assumed
 * equivalent: re-rendering github-social-preview.png produced 491,233 bytes against
 * the previous Chrome-rendered 491,564 at identical dimensions, and the two were
 * compared side by side — same fonts, same geometry, differing only in the text
 * that was actually corrected. If puppeteer-core is ever added as a real
 * dependency, moving this to the same renderer would be a reasonable tidy-up.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const SVG_DIR = path.join(ROOT, 'social');
const PNG_DIR = path.join(SVG_DIR, 'exports', '8k');
const WIDTH = 7680;

function haveRenderer() {
  try {
    execFileSync('rsvg-convert', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function listPairs(filter) {
  if (!fs.existsSync(SVG_DIR)) return [];
  return fs
    .readdirSync(SVG_DIR)
    .filter((f) => f.endsWith('.svg'))
    .map((f) => path.basename(f, '.svg'))
    .filter((name) => !filter || name === filter)
    .sort()
    .map((name) => ({
      name,
      svg: path.join(SVG_DIR, `${name}.svg`),
      png: path.join(PNG_DIR, `${name}.png`),
    }));
}

/** A PNG is stale when it is missing or older than the SVG it came from. */
function isStale({ svg, png }) {
  if (!fs.existsSync(png)) return true;
  return fs.statSync(png).mtimeMs < fs.statSync(svg).mtimeMs;
}

function run({ check = false, only = null } = {}) {
  const pairs = listPairs(only);
  if (pairs.length === 0) {
    console.error(only ? `no such SVG: social/${only}.svg` : `no SVGs in ${SVG_DIR}`);
    return 1;
  }

  const stale = pairs.filter(isStale);

  if (check) {
    for (const p of stale) console.log(`  STALE  ${p.name}.png`);
    console.log(
      stale.length === 0
        ? `  all ${pairs.length} exports are newer than their SVG`
        : `  ${stale.length} of ${pairs.length} export(s) stale`
    );
    return stale.length === 0 ? 0 : 1;
  }

  if (!haveRenderer()) {
    console.error('  rsvg-convert not found. Install librsvg:');
    console.error('    macOS:  brew install librsvg');
    console.error('    Debian: apt-get install librsvg2-bin');
    return 1;
  }

  fs.mkdirSync(PNG_DIR, { recursive: true });

  let ok = 0;
  const failed = [];
  for (const p of pairs) {
    // Width only — rsvg-convert derives the height from the viewBox, so each
    // card keeps its own aspect ratio without hardcoding 49 different heights.
    const r = spawnSync('rsvg-convert', ['-w', String(WIDTH), p.svg, '-o', p.png], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    if (r.status === 0 && fs.existsSync(p.png) && fs.statSync(p.png).size > 0) {
      ok += 1;
    } else {
      failed.push(`${p.name}: ${String(r.stderr || '').trim() || `exit ${r.status}`}`);
    }
  }

  console.log(`  rendered ${ok}/${pairs.length} at ${WIDTH}px wide`);
  for (const f of failed) console.error(`  FAILED  ${f}`);
  return failed.length === 0 ? 0 : 1;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const only = args.find((a) => !a.startsWith('--')) || null;
  process.exit(run({ check, only }));
}

module.exports = { run, listPairs, isStale, WIDTH };
