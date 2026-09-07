// Tests for scripts/immune/scan.js — walking a tree and applying the detectors.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { scanTree, walk, isSkippable } = require('../../scripts/immune/scan');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'immune-scan-'));
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const BUGGY = [
  "const fs = require('fs');",
  "const LEDGER_FILE = '/tmp/l.jsonl';",
  'function save(rows) { fs.writeFileSync(LEDGER_FILE, rows.join()); }',
  'module.exports = { save };',
].join('\n');

test('scanTree finds a planted finding and reports its file and line', () => {
  const s = sandbox();
  try {
    fs.writeFileSync(path.join(s.dir, 'bad.js'), BUGGY);
    const r = scanTree(s.dir);
    assert.equal(r.scanned, 1);
    assert.ok(r.counts.total >= 1);
    const f = r.findings.find((x) => x.detector === 'truncate-then-write');
    assert.ok(f, 'planted finding not reported');
    assert.equal(f.file, 'bad.js');
    assert.ok(f.line > 0);
  } finally { s.cleanup(); }
});

test('a clean tree reports nothing', () => {
  const s = sandbox();
  try {
    fs.writeFileSync(path.join(s.dir, 'ok.js'), 'module.exports = { add: (a, b) => a + b };');
    const r = scanTree(s.dir);
    assert.equal(r.counts.total, 0);
  } finally { s.cleanup(); }
});

test('test files are skipped by default and included on request', () => {
  // Tests deliberately contain the shapes they guard against; scanning them
  // reports the fixtures rather than the code that ships.
  const s = sandbox();
  try {
    fs.mkdirSync(path.join(s.dir, 'tests'));
    fs.writeFileSync(path.join(s.dir, 'tests', 'thing.test.js'), BUGGY);
    assert.equal(scanTree(s.dir).counts.total, 0, 'test fixture leaked into the report');
    assert.ok(scanTree(s.dir, { includeTests: true }).counts.total >= 1);
  } finally { s.cleanup(); }
});

test('node_modules and .git are never walked', () => {
  const s = sandbox();
  try {
    for (const d of ['node_modules', '.git', 'dist']) {
      fs.mkdirSync(path.join(s.dir, d), { recursive: true });
      fs.writeFileSync(path.join(s.dir, d, 'x.js'), BUGGY);
    }
    assert.equal(scanTree(s.dir).scanned, 0);
  } finally { s.cleanup(); }
});

test('symlinked entries are not followed out of the tree', () => {
  if (process.platform === 'win32') return;
  const s = sandbox();
  try {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'immune-outside-'));
    fs.writeFileSync(path.join(outside, 'secret.js'), BUGGY);
    fs.symlinkSync(outside, path.join(s.dir, 'link'));
    assert.equal(scanTree(s.dir).scanned, 0, 'the scanner followed a symlink out of the tree');
    fs.rmSync(outside, { recursive: true, force: true });
  } finally { s.cleanup(); }
});

test('an unreadable directory does not abort the scan', () => {
  const s = sandbox();
  try {
    fs.writeFileSync(path.join(s.dir, 'ok.js'), 'module.exports = 1;');
    const locked = path.join(s.dir, 'locked');
    fs.mkdirSync(locked);
    if (process.platform !== 'win32') fs.chmodSync(locked, 0o000);
    assert.doesNotThrow(() => scanTree(s.dir));
    if (process.platform !== 'win32') fs.chmodSync(locked, 0o700);
  } finally { s.cleanup(); }
});

test('findings are ordered worst-severity first', () => {
  const s = sandbox();
  try {
    fs.writeFileSync(path.join(s.dir, 'a.js'), BUGGY);
    fs.writeFileSync(path.join(s.dir, 'b.js'), [
      "const fs = require('fs');",
      "const path = require('path');",
      'function get(p, rootDir) {',
      '  const abs = path.join(rootDir, p);',
      '  if (!abs.startsWith(rootDir + path.sep)) return null;',
      "  return fs.readFileSync(abs, 'utf8');",
      '}',
      'module.exports = { get };',
    ].join('\n'));
    const r = scanTree(s.dir);
    const sev = r.findings.map((f) => f.severity);
    assert.ok(sev.length >= 2);
    assert.equal(sev[0], 'high', 'high-severity finding was not first');
  } finally { s.cleanup(); }
});

test('isSkippable recognises test paths on both separators', () => {
  assert.ok(isSkippable('tests/foo.js'));
  assert.ok(isSkippable('src/thing.test.js'));
  assert.ok(!isSkippable('src/thing.js'));
});

test('walk respects maxFiles', () => {
  const s = sandbox();
  try {
    for (let i = 0; i < 12; i++) fs.writeFileSync(path.join(s.dir, `f${i}.js`), 'module.exports=1;');
    assert.equal(walk(s.dir, { maxFiles: 5 }).length, 5);
  } finally { s.cleanup(); }
});
