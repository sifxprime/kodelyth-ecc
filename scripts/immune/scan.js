// scripts/immune/scan.js
//
// Walk a tree and apply every arena-derived detector to it.
//
// The arena finds bugs one repository at a time and remembers them as prose.
// This turns that memory into something executable, so a class confirmed here
// can be found anywhere — including in the repositories of people who never ran
// the arena at all.

'use strict';

const fs = require('fs');
const path = require('path');
const { scanSource, DETECTORS } = require('./detectors');

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next',
  'out', 'vendor', '__pycache__', '.cache', 'tmp',
]);

// Tests deliberately contain the buggy shapes they guard against, so scanning
// them reports the fixtures rather than the code that ships.
function isSkippable(rel) {
  return /(?:^|[\\/])(?:tests?|__tests__|spec)[\\/]/.test(rel) || /\.(?:test|spec)\.[cm]?js$/.test(rel);
}

function walk(root, { includeTests = false, maxFiles = 5000 } = {}) {
  const out = [];
  const stack = [root];
  while (stack.length && out.length < maxFiles) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;   // unreadable directory is not a scan failure
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      if (e.isSymbolicLink()) continue;         // never follow links out of the tree
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) stack.push(abs);
        continue;
      }
      if (!/\.[cm]?js$/.test(e.name)) continue;
      const rel = path.relative(root, abs);
      if (!includeTests && isSkippable(rel)) continue;
      out.push(abs);
      // The cap has to be enforced HERE, not only between directories — a single
      // large directory would otherwise push every entry before the outer loop
      // re-checked, and maxFiles would not actually cap anything.
      if (out.length >= maxFiles) return out.sort();
    }
  }
  return out.sort();
}

const SEVERITY_RANK = { high: 3, medium: 2, low: 1 };

function scanTree(root, opts = {}) {
  const absRoot = path.resolve(root);
  const files = walk(absRoot, opts);
  const findings = [];
  let scanned = 0;

  for (const abs of files) {
    let src;
    try {
      src = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    scanned++;
    for (const f of scanSource(src, path.relative(absRoot, abs))) findings.push(f);
  }

  findings.sort((a, b) =>
    (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0) ||
    a.file.localeCompare(b.file) || a.line - b.line);

  const byDetector = {};
  for (const f of findings) byDetector[f.detector] = (byDetector[f.detector] || 0) + 1;

  return {
    root: absRoot,
    scanned,
    detectors: DETECTORS.length,
    findings,
    byDetector,
    counts: {
      total: findings.length,
      high: findings.filter((f) => f.severity === 'high').length,
      medium: findings.filter((f) => f.severity === 'medium').length,
      low: findings.filter((f) => f.severity === 'low').length,
    },
  };
}

module.exports = { scanTree, walk, isSkippable, SKIP_DIRS };
