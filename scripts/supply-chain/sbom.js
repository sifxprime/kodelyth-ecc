// scripts/supply-chain/sbom.js
//
// CycloneDX 1.5 Software Bill of Materials generator for kodelyth-ecc.
//
// Pure functions — given { rootDir }, produces a CycloneDX-shaped JS object.
// No network, no external deps. Reads package.json + package-lock.json (v3).
//
// Consumers should JSON.stringify with deterministic key order
// (we already build keys in fixed order so default JSON.stringify is fine).
//
// Exports:
//   - SBOM_SPEC_VERSION
//   - generateSBOM({ rootDir, timestamp? }) → CycloneDX object
//   - readSBOMSources({ rootDir }) → { pkg, lock }   (mostly for tests)
//   - buildComponentFromLockEntry(name, entry) → CycloneDX component
//
'use strict';

const fs   = require('fs');
const path = require('path');

const SBOM_SPEC_VERSION = '1.5';
const SBOM_FORMAT = 'CycloneDX';

// ── helpers ──────────────────────────────────────────────────────────────────

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function safeReadJSON(p) {
  try { return readJSON(p); } catch { return null; }
}

function readSBOMSources({ rootDir }) {
  const pkgPath  = path.join(rootDir, 'package.json');
  const lockPath = path.join(rootDir, 'package-lock.json');
  const pkg  = readJSON(pkgPath);
  const lock = safeReadJSON(lockPath);
  return { pkg, lock };
}

// purl (package URL) per spec: pkg:npm/<name>@<version>
// Scoped packages keep the leading @ but the slash is encoded.
function npmPurl(name, version) {
  if (!name || !version) return null;
  // scoped: @scope/name → @scope/name (slash kept, leading @ kept)
  // CycloneDX uses raw form; npm purl spec keeps "@scope/name"
  return `pkg:npm/${name}@${version}`;
}

function bomRefFor(name, version) {
  return `${name}@${version}`;
}

function buildComponentFromLockEntry(installPath, entry) {
  // installPath is the lockfile key like "node_modules/foo" or "" (root)
  // entry has: { name?, version, dev?, optional?, devOptional?, license?, integrity?, resolved? }
  const name = entry.name || pkgNameFromPath(installPath);
  if (!name || !entry.version) return null;

  const component = {
    type:     'library',
    'bom-ref': bomRefFor(name, entry.version),
    name,
    version:  entry.version,
    purl:     npmPurl(name, entry.version),
    scope:    entry.dev ? 'optional' : 'required',
  };

  if (entry.license)   component.licenses = normalizeLicense(entry.license);
  if (entry.integrity) component.hashes   = parseIntegrity(entry.integrity);

  return component;
}

function pkgNameFromPath(installPath) {
  // "node_modules/foo" → "foo"
  // "node_modules/@scope/bar" → "@scope/bar"
  // "node_modules/foo/node_modules/@scope/bar" → "@scope/bar" (deepest)
  if (!installPath) return null;
  const parts = installPath.split('node_modules/').filter(Boolean);
  if (parts.length === 0) return null;
  return parts[parts.length - 1].replace(/\/$/, '');
}

function normalizeLicense(license) {
  // license may be a string ("MIT") or an array
  if (typeof license === 'string') {
    return [{ license: { id: license } }];
  }
  if (Array.isArray(license)) {
    return license.map(l => typeof l === 'string' ? { license: { id: l } } : { license: l });
  }
  if (license && typeof license === 'object') {
    return [{ license }];
  }
  return undefined;
}

function parseIntegrity(integrity) {
  // npm SRI strings look like "sha512-base64==" — possibly multiple, space-separated.
  return integrity.split(/\s+/).filter(Boolean).map(sri => {
    const idx = sri.indexOf('-');
    if (idx === -1) return null;
    const alg = sri.slice(0, idx).toLowerCase();
    const b64 = sri.slice(idx + 1);
    // CycloneDX uses hex; convert base64 to hex.
    let hex;
    try { hex = Buffer.from(b64, 'base64').toString('hex'); }
    catch { return null; }
    const algMap = { sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' };
    return algMap[alg] ? { alg: algMap[alg], content: hex } : null;
  }).filter(Boolean);
}

// ── main entry ────────────────────────────────────────────────────────────────

function generateSBOM({ rootDir, timestamp } = {}) {
  if (!rootDir) throw new Error('generateSBOM: rootDir is required');
  const { pkg, lock } = readSBOMSources({ rootDir });

  const ts = timestamp || new Date().toISOString();

  const rootComponent = {
    type:     'application',
    'bom-ref': bomRefFor(pkg.name, pkg.version),
    name:     pkg.name,
    version:  pkg.version,
    purl:     npmPurl(pkg.name, pkg.version),
    description: pkg.description || undefined,
  };
  if (pkg.license) rootComponent.licenses = normalizeLicense(pkg.license);

  const components = [];
  const dependencies = [];

  if (lock && lock.packages) {
    // Walk every entry except the root ("")
    for (const [installPath, entry] of Object.entries(lock.packages)) {
      if (!installPath) continue; // root handled as metadata.component
      const c = buildComponentFromLockEntry(installPath, entry);
      if (c) components.push(c);
    }

    // Dependency graph for the root only — direct dependencies + optionalDependencies.
    const rootEntry = lock.packages[''] || {};
    const directDeps = []
      .concat(Object.keys(rootEntry.dependencies        || {}))
      .concat(Object.keys(rootEntry.optionalDependencies || {}));
    if (directDeps.length) {
      const seen = new Map();
      for (const c of components) seen.set(c.name, c['bom-ref']);
      const dependsOn = directDeps
        .map(n => seen.get(n))
        .filter(Boolean);
      dependencies.push({
        ref: rootComponent['bom-ref'],
        dependsOn,
      });
    }
  }

  const bom = {
    bomFormat:   SBOM_FORMAT,
    specVersion: SBOM_SPEC_VERSION,
    serialNumber: `urn:uuid:${deriveSerial(pkg, ts)}`,
    version: 1,
    metadata: {
      timestamp: ts,
      tools: [{
        vendor:  'kodelyth-ecc',
        name:    'kodelyth-ecc-sbom',
        version: pkg.version,
      }],
      component: rootComponent,
    },
    components,
    dependencies,
  };

  return bom;
}

// Derive a stable, deterministic UUID-ish serial from package + timestamp.
// Not a cryptographic UUID; it's stable across re-runs at same time.
function deriveSerial(pkg, ts) {
  const crypto = require('crypto');
  const h = crypto.createHash('sha256').update(`${pkg.name}@${pkg.version}|${ts}`).digest('hex');
  // 8-4-4-4-12 layout
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

module.exports = {
  SBOM_SPEC_VERSION,
  SBOM_FORMAT,
  generateSBOM,
  readSBOMSources,
  buildComponentFromLockEntry,
  // exposed for testing only
  _internals: { npmPurl, parseIntegrity, normalizeLicense, pkgNameFromPath, deriveSerial },
};
