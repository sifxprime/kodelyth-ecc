// Tests for scripts/supply-chain/verify.js
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const os     = require('node:os');
const path   = require('node:path');

const M = require('../../scripts/supply-chain/manifest.js');
const V = require('../../scripts/supply-chain/verify.js');

function makeFakeRepo(layout) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-verify-'));
  for (const [rel, content] of Object.entries(layout)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
}
function cleanup(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* */ } }

const FAKE_LAYOUT = {
  'package.json': { name: 'fake', version: '0.1.0' },
  'agents/a.md':  'agent a v1',
  'skills/s/SKILL.md': '# s',
};

// ── argument validation ──────────────────────────────────────────────────────

test('verifyAgainstManifest: rejects missing rootDir', () => {
  assert.throws(() => V.verifyAgainstManifest({ manifest: { schema: M.MANIFEST_SCHEMA, files: [] } }),
    /rootDir is required/);
});

test('verifyAgainstManifest: rejects missing manifest', () => {
  assert.throws(() => V.verifyAgainstManifest({ rootDir: '/tmp' }), /manifest is required/);
});

test('verifyAgainstManifest: rejects unsupported manifest schema', () => {
  assert.throws(
    () => V.verifyAgainstManifest({ rootDir: '/tmp', manifest: { schema: 'wrong', files: [] } }),
    /unsupported manifest schema/
  );
});

// ── happy path ───────────────────────────────────────────────────────────────

test('verifyAgainstManifest: clean repo returns ok=true with all files', () => {
  const dir = makeFakeRepo(FAKE_LAYOUT);
  try {
    const manifest = M.generateManifest({ rootDir: dir });
    const r = V.verifyAgainstManifest({ rootDir: dir, manifest });
    assert.equal(r.ok, true);
    assert.equal(r.summary.modified, 0);
    assert.equal(r.summary.missing, 0);
    assert.equal(r.summary.extra, 0);
    assert.equal(r.summary.ok, manifest.file_count);
  } finally { cleanup(dir); }
});

// ── modified file ────────────────────────────────────────────────────────────

test('verifyAgainstManifest: detects modified file with sha mismatch', () => {
  const dir = makeFakeRepo(FAKE_LAYOUT);
  try {
    const manifest = M.generateManifest({ rootDir: dir });
    fs.writeFileSync(path.join(dir, 'agents/a.md'), 'agent a v2');
    const r = V.verifyAgainstManifest({ rootDir: dir, manifest });
    assert.equal(r.ok, false);
    assert.equal(r.summary.modified, 1);
    assert.equal(r.details.modified[0].path, 'agents/a.md');
    assert.match(r.details.modified[0].expected_sha256, /^[0-9a-f]{64}$/);
    assert.match(r.details.modified[0].actual_sha256, /^[0-9a-f]{64}$/);
    assert.notEqual(
      r.details.modified[0].expected_sha256,
      r.details.modified[0].actual_sha256
    );
  } finally { cleanup(dir); }
});

// ── missing file ─────────────────────────────────────────────────────────────

test('verifyAgainstManifest: detects missing file', () => {
  const dir = makeFakeRepo(FAKE_LAYOUT);
  try {
    const manifest = M.generateManifest({ rootDir: dir });
    fs.unlinkSync(path.join(dir, 'agents/a.md'));
    const r = V.verifyAgainstManifest({ rootDir: dir, manifest });
    assert.equal(r.ok, false);
    assert.equal(r.summary.missing, 1);
    assert.equal(r.details.missing[0].path, 'agents/a.md');
  } finally { cleanup(dir); }
});

// ── extra file ───────────────────────────────────────────────────────────────

test('verifyAgainstManifest: extra files reported but do not fail verify', () => {
  const dir = makeFakeRepo(FAKE_LAYOUT);
  try {
    const manifest = M.generateManifest({ rootDir: dir });
    fs.writeFileSync(path.join(dir, 'agents/extra.md'), 'unexpected');
    const r = V.verifyAgainstManifest({ rootDir: dir, manifest });
    assert.equal(r.ok, true, 'extras alone should not fail verify');
    assert.equal(r.summary.extra, 1);
    assert.ok(r.details.extra.includes('agents/extra.md'));
  } finally { cleanup(dir); }
});

// ── combined ─────────────────────────────────────────────────────────────────

test('verifyAgainstManifest: counts modified, missing, extra independently', () => {
  const dir = makeFakeRepo(FAKE_LAYOUT);
  try {
    const manifest = M.generateManifest({ rootDir: dir });
    fs.writeFileSync(path.join(dir, 'agents/a.md'), 'tampered');
    fs.unlinkSync(path.join(dir, 'skills/s/SKILL.md'));
    fs.writeFileSync(path.join(dir, 'agents/new.md'), 'fresh');
    const r = V.verifyAgainstManifest({ rootDir: dir, manifest });
    assert.equal(r.ok, false);
    assert.equal(r.summary.modified, 1);
    assert.equal(r.summary.missing, 1);
    assert.equal(r.summary.extra, 1);
  } finally { cleanup(dir); }
});

// ── round-trip integration ───────────────────────────────────────────────────

test('verifyAgainstManifest: round-trips clean across copy', () => {
  const dir1 = makeFakeRepo(FAKE_LAYOUT);
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-verify-2-'));
  try {
    // Copy files to dir2.
    for (const f of M.walkFiles(dir1)) {
      const rel = path.relative(dir1, f);
      const dest = path.join(dir2, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(f, dest);
    }
    const manifest = M.generateManifest({ rootDir: dir1 });
    const r = V.verifyAgainstManifest({ rootDir: dir2, manifest });
    assert.equal(r.ok, true);
    assert.equal(r.summary.ok, manifest.file_count);
  } finally { cleanup(dir1); cleanup(dir2); }
});
