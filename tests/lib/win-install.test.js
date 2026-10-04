'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const win = require('../../scripts/lib/win-install.js');

/**
 * Why this file exists.
 *
 * The first version of win-install.js downloaded a release zip over HTTPS and
 * extracted it straight into the user's PATH directory with no integrity check
 * at all — in a repo that ships a supply-chain-auditor agent whose entire job is
 * catching exactly that. Both upstream projects publish checksums.txt; nothing
 * was reading it.
 *
 * Verified live before these tests were written: the genuine RTK Windows asset
 * hashes to the published sha256, and flipping a single byte produces a
 * mismatch.
 */

function fixture(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'win-install-test-'));
  const file = path.join(dir, 'asset.zip');
  fs.writeFileSync(file, contents);
  const sha = crypto.createHash('sha256').update(contents).digest('hex');
  return { dir, file, sha };
}

test('a matching checksum passes', () => {
  const { dir, file, sha } = fixture('hello world');
  const r = win.verifyChecksum({
    repo: 'x/y', asset: 'asset.zip', file,
    checksumText: `${sha}  asset.zip\n`,
  });
  assert.strictEqual(r.status, 'ok');
  assert.strictEqual(r.expected, sha);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a single changed byte is caught', () => {
  const { dir, file, sha } = fixture('hello world');
  fs.writeFileSync(file, 'hello worlD');          // one bit different
  const r = win.verifyChecksum({
    repo: 'x/y', asset: 'asset.zip', file,
    checksumText: `${sha}  asset.zip\n`,
  });
  assert.strictEqual(r.status, 'mismatch');
  assert.notStrictEqual(r.actual, r.expected);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('an asset absent from checksums.txt is unavailable, not a pass', () => {
  const { dir, file, sha } = fixture('data');
  const r = win.verifyChecksum({
    repo: 'x/y', asset: 'asset.zip', file,
    checksumText: `${sha}  something-else.zip\n`,
  });
  assert.strictEqual(r.status, 'unavailable');
  assert.match(r.reason, /not listed/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a malformed checksum entry is unavailable, not a pass', () => {
  const { dir, file } = fixture('data');
  const r = win.verifyChecksum({
    repo: 'x/y', asset: 'asset.zip', file,
    checksumText: 'not-a-hash  asset.zip\n',
  });
  assert.strictEqual(r.status, 'unavailable');
  assert.match(r.reason, /malformed/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the right line is picked out of a full checksums.txt', () => {
  const { dir, file, sha } = fixture('payload');
  const text = [
    'aaaa  rtk-aarch64-apple-darwin.tar.gz',
    `${sha}  asset.zip`,
    'bbbb  rtk-x86_64-apple-darwin.tar.gz',
  ].join('\n');
  const r = win.verifyChecksum({ repo: 'x/y', asset: 'asset.zip', file, checksumText: text });
  assert.strictEqual(r.status, 'ok');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a filename that merely ends with the asset name does not match it', () => {
  // "evil-asset.zip" must not satisfy a lookup for "asset.zip".
  const { dir, file, sha } = fixture('payload');
  const r = win.verifyChecksum({
    repo: 'x/y', asset: 'asset.zip', file,
    checksumText: `${sha}  evil-asset.zip\n`,
  });
  assert.strictEqual(r.status, 'unavailable', 'a suffix match must not be accepted');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('uppercase hex in checksums.txt still matches', () => {
  const { dir, file, sha } = fixture('payload');
  const r = win.verifyChecksum({
    repo: 'x/y', asset: 'asset.zip', file,
    checksumText: `${sha.toUpperCase()}  asset.zip\n`,
  });
  assert.strictEqual(r.status, 'ok');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('installFromRelease refuses to run off Windows', () => {
  if (process.platform === 'win32') return;
  const r = win.installFromRelease({ repo: 'x/y', asset: 'a.zip', binName: 'a.exe' });
  assert.strictEqual(r.installed, false);
  assert.match(r.reason, /Windows-only/);
});

test('setxHint names the directory it was given', () => {
  assert.match(win.setxHint('C:\\Users\\x\\AppData\\Local\\Kodelyth\\bin'), /setx PATH/);
  assert.ok(win.setxHint('C:\\tmp\\bin').includes('C:\\tmp\\bin'));
});
