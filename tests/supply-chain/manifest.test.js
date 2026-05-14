// Tests for scripts/supply-chain/manifest.js
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const os     = require('node:os');
const path   = require('node:path');
const crypto = require('node:crypto');

const M = require('../../scripts/supply-chain/manifest.js');

function makeFakeRepo(layout) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-manifest-'));
  for (const [rel, content] of Object.entries(layout)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const data = typeof content === 'string' ? content : JSON.stringify(content);
    fs.writeFileSync(abs, data);
  }
  return dir;
}
function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
}

test('schema constants exposed', () => {
  assert.equal(M.MANIFEST_SCHEMA, 'kodelyth.content-manifest/v1');
  assert.equal(M.MANIFEST_VERSION, 1);
});

test('hashFile: sha256 of known content', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-h-'));
  const f = path.join(dir, 'a.txt');
  fs.writeFileSync(f, 'hello');
  try {
    const expected = crypto.createHash('sha256').update('hello').digest('hex');
    assert.equal(M.hashFile(f), expected);
  } finally { cleanup(dir); }
});

test('walkFiles: includes shipped root files when present', () => {
  const dir = makeFakeRepo({
    'package.json':  { name: 'fake', version: '0.1.0' },
    'README.md':     '# fake',
    'CHANGELOG.md':  '## 0.1.0',
    'agents/a.md':   'agent a',
    'skills/s/SKILL.md': '# skill s',
  });
  try {
    const files = M.walkFiles(dir);
    const rels = files.map(f => path.relative(dir, f).split(path.sep).join('/'));
    assert.ok(rels.includes('package.json'));
    assert.ok(rels.includes('README.md'));
    assert.ok(rels.includes('CHANGELOG.md'));
    assert.ok(rels.includes('agents/a.md'));
    assert.ok(rels.includes('skills/s/SKILL.md'));
  } finally { cleanup(dir); }
});

test('walkFiles: skips node_modules and .git', () => {
  const dir = makeFakeRepo({
    'package.json':  { name: 'fake', version: '0.1.0' },
    'agents/a.md':   'a',
    'agents/node_modules/x.js': 'should-skip',
    'scripts/.git/HEAD': 'should-skip',
  });
  try {
    const files = M.walkFiles(dir);
    const rels = files.map(f => path.relative(dir, f).split(path.sep).join('/'));
    assert.ok(rels.includes('agents/a.md'));
    assert.ok(!rels.some(r => r.includes('node_modules')));
    assert.ok(!rels.some(r => r.includes('.git')));
  } finally { cleanup(dir); }
});

test('walkFiles: deterministic ordering', () => {
  const dir = makeFakeRepo({
    'package.json':  { name: 'fake', version: '0.1.0' },
    'agents/z.md':   'z',
    'agents/a.md':   'a',
    'agents/m.md':   'm',
  });
  try {
    const a = M.walkFiles(dir);
    const b = M.walkFiles(dir);
    assert.deepEqual(a, b);
    // Sorted alphabetically by absolute path → relative path.
    const rels = a.map(f => path.relative(dir, f));
    const sorted = [...rels].sort();
    assert.deepEqual(rels, sorted);
  } finally { cleanup(dir); }
});

test('generateManifest: rejects missing rootDir', () => {
  assert.throws(() => M.generateManifest({}), /rootDir is required/);
});

test('generateManifest: produces stable digest across runs', () => {
  const dir = makeFakeRepo({
    'package.json':  { name: 'fake', version: '0.1.0' },
    'agents/a.md':   'agent a',
  });
  try {
    const m1 = M.generateManifest({ rootDir: dir, timestamp: 'fixed' });
    const m2 = M.generateManifest({ rootDir: dir, timestamp: 'fixed' });
    assert.equal(m1.digest, m2.digest);
    assert.deepEqual(m1.files, m2.files);
  } finally { cleanup(dir); }
});

test('generateManifest: digest changes when content changes', () => {
  const dir = makeFakeRepo({
    'package.json':  { name: 'fake', version: '0.1.0' },
    'agents/a.md':   'v1',
  });
  try {
    const m1 = M.generateManifest({ rootDir: dir });
    fs.writeFileSync(path.join(dir, 'agents/a.md'), 'v2');
    const m2 = M.generateManifest({ rootDir: dir });
    assert.notEqual(m1.digest, m2.digest);
  } finally { cleanup(dir); }
});

test('generateManifest: every entry has path/size/sha256', () => {
  const dir = makeFakeRepo({
    'package.json':  { name: 'fake', version: '0.1.0' },
    'agents/a.md':   'hello world',
  });
  try {
    const m = M.generateManifest({ rootDir: dir });
    assert.ok(m.files.length >= 2);
    for (const f of m.files) {
      assert.ok(typeof f.path === 'string');
      assert.ok(typeof f.size === 'number');
      assert.match(f.sha256, /^[0-9a-f]{64}$/);
    }
  } finally { cleanup(dir); }
});

test('generateManifest: real repo produces large manifest', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const m = M.generateManifest({ rootDir: repoRoot });
  assert.equal(m.package, 'kodelyth-ecc');
  assert.ok(m.file_count > 100, `expected many files, got ${m.file_count}`);
  assert.match(m.digest, /^[0-9a-f]{64}$/);
});
