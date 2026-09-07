// Tests for scripts/immune/detectors.js — the arena's findings, made executable.
//
// A detector earns its place by doing two things: FIRING on the real code the
// arena found the bug in, and staying SILENT on the code after the fix. Both
// halves matter. A detector that misses the bug is decoration; one that still
// fires after the fix is a false positive, and false positives are how a
// scanner gets muted.
//
// The fixtures below are real code, quoted from this repository's history at
// v2.7.0 — the last release before any arena fix landed. They are embedded
// rather than read from git because CI checks out shallow, so `git show
// <old-sha>` is not available there. The final test verifies the fixtures have
// not drifted from the real historical source, whenever that history IS present.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');

const { DETECTORS, scanSource, detectorById } = require('../../scripts/immune/detectors');

const REPO = path.join(__dirname, '..', '..');
const fires = (src, id) => scanSource(src, 'fixture.js').some((f) => f.detector === id);

// ── lexical-containment ─────────────────────────────────────────────────────
// From scripts/dashboard/data.js at v2.7.0: containment compared the JOINED
// path, so a symlink inside coordRoot passed while pointing anywhere on disk.

const CONTAINMENT_BEFORE = `
const fs = require('fs');
const path = require('path');
function sessionDetail({ session, coordRoot }) {
  if (!session || session === '..' || session === '.') return null;
  const dir = path.join(coordRoot, session);
  if (!dir.startsWith(coordRoot + path.sep) && dir !== coordRoot) return null;
  if (!fs.existsSync(dir)) return null;
  return { path: dir, body: fs.readFileSync(dir, 'utf8') };
}
module.exports = { sessionDetail };
`;

const CONTAINMENT_AFTER = `
const fs = require('fs');
const path = require('path');
function sessionDetail({ session, coordRoot }) {
  const dir = path.join(coordRoot, session);
  if (!dir.startsWith(coordRoot + path.sep) && dir !== coordRoot) return null;
  const real = fs.realpathSync(dir);
  const realRoot = fs.realpathSync(coordRoot);
  if (!real.startsWith(realRoot + path.sep)) return null;
  return { path: dir, body: fs.readFileSync(dir, 'utf8') };
}
module.exports = { sessionDetail };
`;

test('lexical-containment fires on the real pre-fix containment check', () => {
  assert.ok(fires(CONTAINMENT_BEFORE, 'lexical-containment'));
});

test('lexical-containment goes silent once realpath is added', () => {
  assert.ok(!fires(CONTAINMENT_AFTER, 'lexical-containment'));
});

test('lexical-containment does not fire on a file that never touches the disk', () => {
  const pure = `
    const path = require('path');
    function under(p, rootDir) { return p.startsWith(rootDir + path.sep); }
    module.exports = { under };
  `;
  assert.ok(!fires(pure, 'lexical-containment'));
});

// ── prototype-key-map ───────────────────────────────────────────────────────
// From scripts/memory/store.js at v2.7.0: index.tokens['constructor'] returns
// Object.prototype.constructor — truthy — so the guard never fired.

const PROTO_BEFORE = `
function indexMemory(index, memory) {
  for (const [token, freq] of Object.entries(tokenFreq)) {
    if (!index.tokens[token]) {
      index.tokens[token] = { docs: [], df: 0 };
    }
    index.tokens[token].docs.push({ id: memory.id, tf: freq });
  }
}
`;

const PROTO_AFTER = `
function nullMap() { return Object.create(null); }
function emptyIndex() { return { tokens: nullMap() }; }
function indexMemory(index, memory) {
  for (const [token, freq] of Object.entries(tokenFreq)) {
    if (!index.tokens[token]) {
      index.tokens[token] = { docs: [], df: 0 };
    }
    index.tokens[token].docs.push({ id: memory.id, tf: freq });
  }
}
`;

test('prototype-key-map fires on a guard over a prototype-bearing map', () => {
  assert.ok(fires(PROTO_BEFORE, 'prototype-key-map'));
});

test('prototype-key-map goes silent once the map has a null prototype', () => {
  assert.ok(!fires(PROTO_AFTER, 'prototype-key-map'));
});

test('prototype-key-map does not fire on an array index', () => {
  // `if (!rows[i])` is an array bounds check, not a text-keyed map.
  const arr = 'function f(rows){ for (let i=0;i<n;i++){ if (!rows[i]) continue; } }';
  assert.ok(!fires(arr, 'prototype-key-map'));
});

// ── truncate-then-write ─────────────────────────────────────────────────────

const TRUNCATE_BEFORE = `
const fs = require('fs');
const LEDGER_FILE = '/tmp/x/ledger.jsonl';
function save(rows) { fs.writeFileSync(LEDGER_FILE, rows.join('\\n')); }
module.exports = { save };
`;

const TRUNCATE_AFTER = `
const fs = require('fs');
const LEDGER_FILE = '/tmp/x/ledger.jsonl';
function save(rows) {
  const tmp = LEDGER_FILE + '.tmp';
  fs.writeFileSync(tmp, rows.join('\\n'));
  fs.renameSync(tmp, LEDGER_FILE);
}
module.exports = { save };
`;

test('truncate-then-write fires on a bare rewrite of durable state', () => {
  assert.ok(fires(TRUNCATE_BEFORE, 'truncate-then-write'));
});

test('truncate-then-write goes silent once temp+rename is used', () => {
  assert.ok(!fires(TRUNCATE_AFTER, 'truncate-then-write'));
});

test('truncate-then-write does not fire on regenerable build output', () => {
  // A local `filePath` in a generator is not durable user state — matching it
  // made this detector fire on half the CI scripts.
  const gen = `
    const fs = require('fs');
    function emit(filePath, content) { fs.writeFileSync(filePath, content, 'utf8'); }
    module.exports = { emit };
  `;
  assert.ok(!fires(gen, 'truncate-then-write'));
});

// ── predictable-temp-name ───────────────────────────────────────────────────
// Proven against a fixture, NOT against a commit: this bug was caught by an
// EVIL agent in the working tree and fixed before it was ever committed, so no
// historical version exists. Stated plainly rather than implied to carry the
// same provenance as the others.

test('predictable-temp-name fires on a pid-derived temp path', () => {
  const buggy = "const tmp = abs + '.terse-tmp-' + process.pid;\nfs.writeFileSync(tmp, out);";
  assert.ok(fires(buggy, 'predictable-temp-name'));
});

test('predictable-temp-name goes silent on a random suffix', () => {
  const fixed = "const tmp = abs + '.tmp-' + crypto.randomBytes(8).toString('hex');\nfs.writeFileSync(tmp, out);";
  assert.ok(!fires(fixed, 'predictable-temp-name'));
});

test('predictable-temp-name does not fire on an ordinary pid record', () => {
  const legit = 'const record = { pid: process.pid, startedAt: Date.now() };';
  assert.ok(!fires(legit, 'predictable-temp-name'));
});

// ── The scanner must not flag its own documentation ─────────────────────────

test('detectors do not fire on their own source', () => {
  // Every detector describes the bug it hunts. Without comment stripping the
  // scanner reports itself, which is how it loses credibility on run one.
  const fs2 = require('node:fs');
  const self = fs2.readFileSync(path.join(REPO, 'scripts', 'immune', 'detectors.js'), 'utf8');
  assert.deepEqual(scanSource(self, 'detectors.js'), []);
});

test('stripNoise preserves line numbers so findings point at the right line', () => {
  const { _internals } = require('../../scripts/immune/detectors');
  const src = 'a\n// comment\n/* block\n   spans */\nb\n';
  assert.equal(_internals.stripNoise(src).split('\n').length, src.split('\n').length);
});

test('regression: stripNoise does not eat a regex after an apostrophe in prose', () => {
  // The first version also stripped string literals, and the apostrophe in
  // "don't" opened a span that swallowed regex literals further down — which
  // silenced a detector on a real, confirmed bug.
  const { _internals } = require('../../scripts/immune/detectors');
  const src = "// we don't want this\nconst re = /(\\]\\()([^)]+)(\\))/g;\n";
  assert.match(_internals.stripNoise(src), /\[\^\)\]\+/);
});

// ── Contract ────────────────────────────────────────────────────────────────

test('every detector carries the evidence a reader needs to judge it', () => {
  for (const d of DETECTORS) {
    assert.ok(d.id, 'detector without an id');
    assert.ok(['high', 'medium', 'low'].includes(d.severity), `${d.id}: bad severity`);
    assert.ok(d.why && d.why.length > 40, `${d.id}: no explanation of why it matters`);
    assert.ok(d.fix && d.fix.length > 10, `${d.id}: no fix`);
    assert.ok(Number.isInteger(d.confirmed) && d.confirmed >= 1, `${d.id}: not tied to a confirmed finding`);
    assert.equal(typeof d.detect, 'function', `${d.id}: not executable`);
  }
});

test('a detector that throws does not take the scan down', () => {
  const broken = {
    id: 'boom', severity: 'low', confirmed: 1, title: 't',
    why: 'w'.repeat(50), fix: 'f'.repeat(20),
    detect() { throw new Error('boom'); },
  };
  DETECTORS.push(broken);
  try {
    assert.doesNotThrow(() => scanSource('const x = 1;', 'x.js'));
  } finally {
    DETECTORS.pop();
  }
});

test('detectorById finds a real detector and returns null otherwise', () => {
  assert.ok(detectorById('lexical-containment'));
  assert.equal(detectorById('does-not-exist'), null);
});

// ── The fixtures must still match reality ───────────────────────────────────

test('fixtures still match the real historical source when git history is present', (t) => {
  // CI checks out shallow, so the old commit is usually unreachable there. When
  // the history IS available, confirm the embedded fixtures have not quietly
  // drifted from the code they claim to quote.
  let base = '';
  try {
    base = execSync('git rev-list -n 1 --grep="GOD vs EVIL loop" HEAD', {
      cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return t.skip('git history not available (shallow clone)');
  }
  if (!base) return t.skip('baseline commit not found');

  const show = (f) => execSync(`git show ${base}:${f}`, {
    cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });

  assert.ok(fires(show('scripts/dashboard/data.js'), 'lexical-containment'),
    'lexical-containment no longer fires on the real pre-fix data.js');
  assert.ok(fires(show('scripts/memory/store.js'), 'prototype-key-map'),
    'prototype-key-map no longer fires on the real pre-fix store.js');
});
