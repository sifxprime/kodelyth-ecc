/**
 * brand/convert.js
 * Renders the Kodelyth brand SVGs to PNG at their published sizes.
 *
 * Usage:
 *   node brand/convert.js              # render all
 *   node brand/convert.js --check      # report stale, change nothing
 *   node brand/convert.js fb-cover     # render one, by output name
 *
 * .gitignore points here as the way to regenerate brand/*.png, but this script
 * could not run. It required puppeteer-core, which is neither installed nor
 * declared in package.json, so `node brand/convert.js` failed on a clean checkout
 * with a module-not-found. It also hardcoded a macOS Chrome path, so it could not
 * have run on Linux or Windows even with the dependency present. The PNGs it was
 * supposed to maintain drifted for months as a result.
 *
 * It now uses rsvg-convert, which keeps ECC's no-runtime-dependency rule intact
 * and matches scripts/brand/export-assets.js, so both halves of the brand
 * pipeline render through one tool. The substitution was checked rather than
 * assumed: re-rendering a Chrome-produced export gave a byte-comparable file at
 * identical dimensions with the same fonts and geometry.
 *
 * Sizes are expressed as a target WIDTH only. Every published PNG is an exact
 * aspect-preserving scale of its SVG's viewBox, so letting rsvg derive the height
 * reproduces each one without carrying a second number that can fall out of step
 * with the artwork.
 *
 * The old asset list was also wrong in both directions: it named favicon.svg,
 * which does not exist in this directory, and omitted five assets that do have
 * published PNGs — the ECC badge, icon, and both lockups, plus the legacy post.
 * The list below is derived from the files actually present and the dimensions
 * they are published at.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const BRAND_DIR = __dirname;

// { input, output, width, label } — width in pixels; height follows the viewBox.
const ASSETS = [
  // Facebook assets
  { input: 'fb-profile.svg',          output: 'fb-profile.png',          width: 1600, label: 'Facebook profile (400x400 @4x)' },
  { input: 'fb-cover.svg',            output: 'fb-cover.png',            width: 3280, label: 'Facebook cover (820x312 @4x)' },

  // Kodelyth marks and lockups
  { input: 'kodelyth-mark.svg',       output: 'kodelyth-mark.png',       width: 2400, label: 'Kodelyth mark (400x400 @6x)' },
  { input: 'kodelyth-dark.svg',       output: 'kodelyth-dark.png',       width: 2760, label: 'Lockup dark (460x120 @6x)' },
  { input: 'kodelyth-light.svg',      output: 'kodelyth-light.png',      width: 2760, label: 'Lockup light (460x120 @6x)' },
  { input: 'kodelyth-legacy-post.svg',output: 'kodelyth-legacy-post-8k.png', width: 6144, label: 'Legacy post (1080x1350, 8K tall)' },

  // ECC marks and lockups
  { input: 'ecc-badge.svg',           output: 'ecc-badge.png',           width: 720,  label: 'ECC badge (240x240 @3x)' },
  { input: 'ecc-lockup-dark.svg',     output: 'ecc-lockup-dark.png',     width: 1240, label: 'ECC lockup dark (620x150 @2x)' },
  { input: 'ecc-lockup-light.svg',    output: 'ecc-lockup-light.png',    width: 1240, label: 'ECC lockup light (620x150 @2x)' },

  // ECC icon — one source, two published sizes
  { input: 'ecc-icon.svg',            output: 'ecc-icon-512.png',        width: 512,  label: 'ECC icon 512x512' },
  { input: 'ecc-icon.svg',            output: 'ecc-icon-192.png',        width: 192,  label: 'ECC icon 192x192' },
];

function haveRenderer() {
  try {
    execFileSync('rsvg-convert', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** A PNG is stale when it is missing or older than the SVG it came from. */
function isStale(asset) {
  const svg = path.join(BRAND_DIR, asset.input);
  const png = path.join(BRAND_DIR, asset.output);
  if (!fs.existsSync(svg)) return false;        // nothing to render from
  if (!fs.existsSync(png)) return true;
  return fs.statSync(png).mtimeMs < fs.statSync(svg).mtimeMs;
}

function run({ check = false, only = null } = {}) {
  const assets = only
    ? ASSETS.filter((a) => a.output === only || a.output.replace(/\.png$/, '') === only)
    : ASSETS;

  if (assets.length === 0) {
    console.error(`no such asset: ${only}`);
    return 1;
  }

  const missing = assets.filter((a) => !fs.existsSync(path.join(BRAND_DIR, a.input)));
  for (const a of missing) console.error(`  SKIP  ${a.input} — file not found`);

  const renderable = assets.filter((a) => !missing.includes(a));

  if (check) {
    const stale = renderable.filter(isStale);
    for (const a of stale) console.log(`  STALE  ${a.output}`);
    console.log(
      stale.length === 0
        ? `  all ${renderable.length} brand PNGs are newer than their SVG`
        : `  ${stale.length} of ${renderable.length} stale`
    );
    return stale.length === 0 && missing.length === 0 ? 0 : 1;
  }

  if (!haveRenderer()) {
    console.error('  rsvg-convert not found. Install librsvg:');
    console.error('    macOS:  brew install librsvg');
    console.error('    Debian: apt-get install librsvg2-bin');
    return 1;
  }

  console.log('\nKodelyth Brand — SVG to PNG');
  console.log('--------------------------------------');

  let ok = 0;
  const failed = [];
  for (const a of renderable) {
    const input = path.join(BRAND_DIR, a.input);
    const output = path.join(BRAND_DIR, a.output);
    const r = spawnSync('rsvg-convert', ['-w', String(a.width), input, '-o', output], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    if (r.status === 0 && fs.existsSync(output) && fs.statSync(output).size > 0) {
      const kb = Math.round(fs.statSync(output).size / 1024);
      console.log(`  [DONE]  ${a.output.padEnd(28)} ${a.label}  (${kb} KB)`);
      ok += 1;
    } else {
      failed.push(`${a.output}: ${String(r.stderr || '').trim() || `exit ${r.status}`}`);
    }
  }

  console.log(`\n  rendered ${ok}/${renderable.length}`);
  for (const f of failed) console.error(`  FAILED  ${f}`);
  return failed.length === 0 ? 0 : 1;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const only = args.find((a) => !a.startsWith('--')) || null;
  process.exit(run({ check, only }));
}

module.exports = { run, ASSETS, isStale };
