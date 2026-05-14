// scripts/supply-chain/manifest.js
//
// Content manifest generator for kodelyth-ecc.
//
// Walks every shipped asset directory, computes sha256 of each file, and
// produces a stable, deterministic JSON manifest.
//
// The manifest is the "ground truth" for `kodelyth-ecc verify`: an installed
// copy is compared file-by-file against this manifest.
//
// Pure functions — no network, no external deps.
//
// Exports:
//   - MANIFEST_SCHEMA
//   - SHIPPED_DIRS                 (default list of asset directories)
//   - generateManifest({ rootDir, dirs?, timestamp? })
//   - hashFile(absPath)
//   - walkFiles(rootDir, dirs)     (iterator-friendly array, sorted)
//
'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const MANIFEST_SCHEMA  = 'kodelyth.content-manifest/v1';
const MANIFEST_VERSION = 1;

// Directories whose contents are considered part of the shipped artifact.
// Order doesn't matter — output is sorted by relative path.
const SHIPPED_DIRS = [
  'agents',
  'skills',
  'commands',
  'rules',
  'hooks',
  'scripts',
  'bin',
  'parallel-commands',
  'bundles',
];

// Files that should be included individually from the repo root.
const SHIPPED_ROOT_FILES = [
  'package.json',
  'README.md',
  'CHANGELOG.md',
  'VERSION',
  'install.sh',
  'install.ps1',
];

// Patterns to skip even within shipped dirs.
// Use [/\\] so patterns match on both POSIX (/) and Windows (\) paths.
const SKIP_PATTERNS = [
  /[/\\]\.DS_Store$/,
  /[/\\]node_modules[/\\]/,
  /[/\\]\.git[/\\]/,
  /[/\\]__pycache__[/\\]/,
  /\.pyc$/,
];

function isSkipped(absPath) {
  return SKIP_PATTERNS.some(p => p.test(absPath));
}

function hashFile(absPath) {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function* walkRecursive(absDir) {
  let entries;
  try { entries = fs.readdirSync(absDir, { withFileTypes: true }); }
  catch { return; }
  // Sort for stability.
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    const abs = path.join(absDir, e.name);
    if (isSkipped(abs)) continue;
    if (e.isDirectory()) yield* walkRecursive(abs);
    else if (e.isFile()) yield abs;
  }
}

function walkFiles(rootDir, dirs = SHIPPED_DIRS, rootFiles = SHIPPED_ROOT_FILES) {
  if (!rootDir) throw new Error('walkFiles: rootDir is required');
  const out = [];

  for (const file of rootFiles) {
    const abs = path.join(rootDir, file);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile() && !isSkipped(abs)) {
      out.push(abs);
    }
  }

  for (const dir of dirs) {
    const abs = path.join(rootDir, dir);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) continue;
    for (const f of walkRecursive(abs)) out.push(f);
  }

  // Final sort by relative path so manifest output is deterministic.
  return out.sort((a, b) => a.localeCompare(b));
}

function generateManifest({ rootDir, dirs, rootFiles, timestamp } = {}) {
  if (!rootDir) throw new Error('generateManifest: rootDir is required');
  const files = walkFiles(rootDir, dirs, rootFiles);

  const pkgPath = path.join(rootDir, 'package.json');
  let pkgName = 'kodelyth-ecc';
  let pkgVersion = '0.0.0';
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkgName = pkg.name || pkgName;
    pkgVersion = pkg.version || pkgVersion;
  } catch { /* leave defaults */ }

  const entries = files.map(abs => {
    const rel = path.relative(rootDir, abs).split(path.sep).join('/');
    const stat = fs.statSync(abs);
    return {
      path:   rel,
      size:   stat.size,
      sha256: hashFile(abs),
    };
  });

  // Compute a manifest-level digest = sha256 over the deterministic JSON of entries.
  const entriesJson = JSON.stringify(entries);
  const manifestDigest = crypto.createHash('sha256').update(entriesJson).digest('hex');

  return {
    schema:    MANIFEST_SCHEMA,
    version:   MANIFEST_VERSION,
    package:   pkgName,
    pkg_version: pkgVersion,
    generated_at: timestamp || new Date().toISOString(),
    file_count:   entries.length,
    digest:       manifestDigest,
    files:        entries,
  };
}

module.exports = {
  MANIFEST_SCHEMA,
  MANIFEST_VERSION,
  SHIPPED_DIRS,
  SHIPPED_ROOT_FILES,
  SKIP_PATTERNS,
  generateManifest,
  hashFile,
  walkFiles,
};
