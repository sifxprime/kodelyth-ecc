/**
 * brand/veltix-convert.js
 * Renders the Veltix SVG assets to PNG, including the 8K masters.
 *
 * Usage:
 *   node brand/veltix-convert.js              # render all
 *   node brand/veltix-convert.js --check      # report stale, change nothing
 *   node brand/veltix-convert.js veltix-og    # render one, by output name
 *
 * Carried the same two defects as brand/convert.js: it required puppeteer-core,
 * which is neither installed nor declared in package.json, so a clean checkout
 * failed with module-not-found before rendering anything; and it hardcoded a
 * macOS Chrome path, so it could not have run on Linux or Windows regardless.
 *
 * Now uses rsvg-convert, matching brand/convert.js and
 * scripts/brand/export-assets.js so the whole brand pipeline renders through one
 * tool, with no runtime dependency added.
 *
 * Sizes are a target WIDTH only. Every published Veltix PNG was checked against
 * its SVG's viewBox and all ten are exact aspect-preserving scales, so letting
 * rsvg derive the height reproduces each one without a second number that can
 * drift from the artwork. The previous form carried both and rendered at
 * viewport=out/2 with deviceScaleFactor 2 to reach the final size; that dance is
 * a workaround for Chrome screenshots and is not needed here.
 *
 * On fonts: the text-bearing assets ask for 'Space Grotesk' then 'Inter' then
 * system-ui. Those are font-family NAMES resolved against installed fonts, not
 * @font-face webfonts, so rsvg resolves them the same way Chrome did — which is
 * also why the old `document.fonts.ready` wait has no counterpart here. If Space
 * Grotesk is not installed, both renderers fall back identically down the stack.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const BRAND_DIR = __dirname;

// { input, output, width, label } — width in final pixels; height follows the viewBox.
const ASSETS = [
  { input: 'veltix-mark.svg',       output: 'veltix-mark-8k.png',     width: 8192, label: 'Mark 8K' },
  { input: 'veltix-light.svg',      output: 'veltix-light-8k.png',    width: 7680, label: 'Lockup light 8K' },
  { input: 'veltix-dark.svg',       output: 'veltix-dark-8k.png',     width: 7680, label: 'Lockup dark 8K' },
  { input: 'veltix-icon.svg',       output: 'veltix-icon-512.png',    width: 512,  label: 'App icon 512' },
  { input: 'veltix-icon.svg',       output: 'veltix-icon-192.png',    width: 192,  label: 'App icon 192' },
  { input: 'veltix-icon.svg',       output: 'veltix-favicon-180.png', width: 180,  label: 'Apple touch 180' },
  { input: 'veltix-icon.svg',       output: 'veltix-favicon-32.png',  width: 32,   label: 'Favicon 32' },
  { input: 'veltix-fb-profile.svg', output: 'veltix-fb-profile.png',  width: 1600, label: 'FB profile' },
  { input: 'veltix-fb-cover.svg',   output: 'veltix-fb-cover.png',    width: 1640, label: 'FB cover' },
  { input: 'veltix-og.svg',         output: 'veltix-og.png',          width: 1200, label: 'OG card 1200x630' },
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
  if (!fs.existsSync(svg)) return false;
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
  for (const a of missing) console.error(`  SKIP  ${a.input} - not found`);
  const renderable = assets.filter((a) => !missing.includes(a));

  if (check) {
    const stale = renderable.filter(isStale);
    for (const a of stale) console.log(`  STALE  ${a.output}`);
    console.log(
      stale.length === 0
        ? `  all ${renderable.length} Veltix PNGs are newer than their SVG`
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

  console.log('\nVeltix Brand — SVG to PNG');
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
      console.log(`  [DONE] ${a.output.padEnd(30)} ${a.label}  (${kb} KB)`);
      ok += 1;
    } else {
      failed.push(`${a.output}: ${String(r.stderr || '').trim() || `exit ${r.status}`}`);
    }
  }

  console.log(`\n  rendered ${ok}/${renderable.length}`);
  for (const f of failed) console.error(`  [FAIL] ${f}`);
  return failed.length === 0 ? 0 : 1;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const only = args.find((a) => !a.startsWith('--')) || null;
  process.exit(run({ check, only }));
}

module.exports = { run, ASSETS, isStale };
