#!/usr/bin/env node
'use strict';

/**
 * Stamp the current package version into every brand and social SVG.
 *
 * These assets carry a literal "v2.24.1" in their artwork, and nothing kept them
 * in step with releases. By 2.24.5 the ECC copies were four releases behind and
 * the website's copies were SEVEN behind, at v2.18.0 — the two sets had drifted
 * apart as well, so the marketing images on the site advertised a different
 * version from the ones in the README.
 *
 * Only the version token is touched. Counts (70 agents, 196 skills, …) are laid
 * out as artwork and change rarely, so they stay a deliberate edit; a script that
 * silently reflowed them would do more harm than the staleness it fixed.
 *
 *   node scripts/brand/sync-asset-version.js                  # ECC's own assets
 *   node scripts/brand/sync-asset-version.js --check          # report, change nothing
 *   node scripts/brand/sync-asset-version.js --root ../ecc-web/public
 *
 * --check exits non-zero when anything is stale, so a release step can refuse to
 * ship assets that advertise the wrong version.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const VERSION = require(path.join(ROOT, 'package.json')).version;

// A version token in artwork: "v" followed by semver, as a whole word. Anchored
// on the leading "v" so it cannot match an IP address — section-dashboard.svg
// contains "127.0.0.1", which a bare semver pattern happily mangles.
const VERSION_TOKEN = /\bv\d+\.\d+\.\d+\b/g;

function collectSvgs(root) {
  const out = [];
  for (const dir of ['social', 'brand']) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    for (const name of fs.readdirSync(full)) {
      if (name.endsWith('.svg')) out.push(path.join(full, name));
    }
  }
  return out.sort();
}

function run({ root, check }) {
  const files = collectSvgs(root);
  if (files.length === 0) {
    console.error(`no social/ or brand/ SVGs under ${root}`);
    return 1;
  }

  const stale = [];
  let changedFiles = 0;
  let changedTokens = 0;

  for (const file of files) {
    const before = fs.readFileSync(file, 'utf8');
    const found = before.match(VERSION_TOKEN);
    if (!found) continue;

    const outdated = found.filter((t) => t !== `v${VERSION}`);
    if (outdated.length === 0) continue;

    stale.push({ file, versions: [...new Set(outdated)], count: outdated.length });
    changedTokens += outdated.length;
    changedFiles += 1;

    if (!check) {
      fs.writeFileSync(file, before.replace(VERSION_TOKEN, `v${VERSION}`), 'utf8');
    }
  }

  const rel = (f) => path.relative(root, f);
  for (const s of stale) {
    console.log(`  ${check ? 'STALE' : 'updated'}  ${rel(s.file).padEnd(40)} ${s.versions.join(', ')} -> v${VERSION}`);
  }

  if (stale.length === 0) {
    console.log(`  all ${files.length} SVGs already at v${VERSION}`);
    return 0;
  }

  console.log(
    `  ${check ? 'stale' : 'synced'}: ${changedFiles} file(s), ${changedTokens} token(s) -> v${VERSION}`
  );
  return check ? 1 : 0;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const rootFlag = args.indexOf('--root');
  const root = rootFlag >= 0 ? path.resolve(args[rootFlag + 1]) : ROOT;
  process.exit(run({ root, check }));
}

module.exports = { run, collectSvgs, VERSION_TOKEN };
