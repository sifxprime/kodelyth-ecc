// Tests for scripts/supply-chain/sbom.js
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const os     = require('node:os');
const path   = require('node:path');

const SBOM = require('../../scripts/supply-chain/sbom.js');
const { generateSBOM, buildComponentFromLockEntry, _internals } = SBOM;

// ── helpers: build a fake mini-package on disk ───────────────────────────────

function makeFakePkg(layout) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-sbom-'));
  for (const [rel, content] of Object.entries(layout)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
}

// ── SBOM_FORMAT / SBOM_SPEC_VERSION ──────────────────────────────────────────

test('SBOM constants exposed', () => {
  assert.equal(SBOM.SBOM_FORMAT, 'CycloneDX');
  assert.equal(SBOM.SBOM_SPEC_VERSION, '1.5');
});

// ── generateSBOM ─────────────────────────────────────────────────────────────

test('generateSBOM: rejects missing rootDir', () => {
  assert.throws(() => generateSBOM({}), /rootDir is required/);
});

test('generateSBOM: with no lockfile produces a valid root-only BOM', () => {
  const dir = makeFakePkg({
    'package.json': { name: 'fake-pkg', version: '0.1.0', license: 'MIT' },
  });
  try {
    const bom = generateSBOM({ rootDir: dir, timestamp: '2026-05-10T17:00:00Z' });
    assert.equal(bom.bomFormat, 'CycloneDX');
    assert.equal(bom.specVersion, '1.5');
    assert.equal(bom.metadata.component.name, 'fake-pkg');
    assert.equal(bom.metadata.component.version, '0.1.0');
    assert.equal(bom.metadata.component.purl, 'pkg:npm/fake-pkg@0.1.0');
    assert.deepEqual(bom.components, []);
    assert.deepEqual(bom.dependencies, []);
    assert.equal(bom.metadata.timestamp, '2026-05-10T17:00:00Z');
    assert.match(bom.serialNumber, /^urn:uuid:[0-9a-f-]+$/);
  } finally { cleanup(dir); }
});

test('generateSBOM: with lockfile emits library components for each package', () => {
  const dir = makeFakePkg({
    'package.json': { name: 'fake-pkg', version: '0.1.0', dependencies: { foo: '^1.0.0' } },
    'package-lock.json': {
      name: 'fake-pkg',
      version: '0.1.0',
      lockfileVersion: 3,
      packages: {
        '': {
          name: 'fake-pkg',
          version: '0.1.0',
          dependencies: { foo: '^1.0.0' },
        },
        'node_modules/foo': {
          version: '1.2.3',
          license: 'MIT',
          integrity: 'sha512-' + Buffer.from('a'.repeat(64), 'hex').toString('base64'),
        },
        'node_modules/foo/node_modules/@scope/bar': {
          version: '2.0.0',
          license: 'Apache-2.0',
        },
      },
    },
  });
  try {
    const bom = generateSBOM({ rootDir: dir });
    assert.equal(bom.components.length, 2);
    const foo = bom.components.find(c => c.name === 'foo');
    assert.ok(foo);
    assert.equal(foo.version, '1.2.3');
    assert.equal(foo.purl, 'pkg:npm/foo@1.2.3');
    assert.equal(foo.scope, 'required');
    assert.equal(foo.licenses[0].license.id, 'MIT');
    assert.equal(foo.hashes[0].alg, 'SHA-512');

    const scoped = bom.components.find(c => c.name === '@scope/bar');
    assert.ok(scoped);
    assert.equal(scoped.purl, 'pkg:npm/@scope/bar@2.0.0');

    // Direct deps wired in dependencies graph.
    assert.equal(bom.dependencies.length, 1);
    assert.equal(bom.dependencies[0].ref, 'fake-pkg@0.1.0');
    assert.deepEqual(bom.dependencies[0].dependsOn, ['foo@1.2.3']);
  } finally { cleanup(dir); }
});

test('generateSBOM: dev dependencies marked as scope=optional', () => {
  const dir = makeFakePkg({
    'package.json': { name: 'fake-pkg', version: '0.1.0' },
    'package-lock.json': {
      lockfileVersion: 3,
      packages: {
        '': { name: 'fake-pkg', version: '0.1.0' },
        'node_modules/dev-only': { version: '1.0.0', dev: true },
      },
    },
  });
  try {
    const bom = generateSBOM({ rootDir: dir });
    const c = bom.components.find(x => x.name === 'dev-only');
    assert.equal(c.scope, 'optional');
  } finally { cleanup(dir); }
});

test('generateSBOM: real repo lockfile produces parseable BOM', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const bom = generateSBOM({ rootDir: repoRoot });
  assert.equal(bom.metadata.component.name, 'kodelyth-ecc');
  assert.ok(bom.components.length > 0, 'should have at least one component from real lockfile');
  // Every component must have a purl.
  for (const c of bom.components.slice(0, 10)) {
    assert.match(c.purl, /^pkg:npm\//);
  }
});

// ── helpers ──────────────────────────────────────────────────────────────────

test('buildComponentFromLockEntry: skips entries without name+version', () => {
  assert.equal(buildComponentFromLockEntry('node_modules/x', {}), null);
});

test('_internals.npmPurl: scoped packages keep slash', () => {
  assert.equal(_internals.npmPurl('@scope/x', '1.0.0'), 'pkg:npm/@scope/x@1.0.0');
});

test('_internals.parseIntegrity: handles sha512 base64', () => {
  const sri = 'sha512-' + Buffer.from('a'.repeat(64), 'hex').toString('base64');
  const out = _internals.parseIntegrity(sri);
  assert.equal(out[0].alg, 'SHA-512');
  assert.match(out[0].content, /^[0-9a-f]+$/);
});

test('_internals.parseIntegrity: skips unknown algorithms', () => {
  const out = _internals.parseIntegrity('md5-AAAA');
  assert.deepEqual(out, []);
});

test('_internals.deriveSerial: stable for same inputs', () => {
  const a = _internals.deriveSerial({ name: 'x', version: '1.0.0' }, '2026-05-10T00:00:00Z');
  const b = _internals.deriveSerial({ name: 'x', version: '1.0.0' }, '2026-05-10T00:00:00Z');
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test('_internals.pkgNameFromPath: deepest scoped path wins', () => {
  assert.equal(
    _internals.pkgNameFromPath('node_modules/foo/node_modules/@scope/bar'),
    '@scope/bar'
  );
});
