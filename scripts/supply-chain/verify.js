// scripts/supply-chain/verify.js
//
// Verify an installed copy of kodelyth-ecc against a shipped content manifest.
//
// Pure functions — given { rootDir, manifest }, returns a structured report
// with categorized differences. No process.exit calls; CLI layer decides.
//
// Categories:
//   ok        — file exists with matching size + sha256
//   modified  — file exists but sha256 differs
//   missing   — file in manifest but not on disk
//   extra     — file on disk under shipped dirs but not in manifest (advisory)
//
// Exports:
//   - verifyAgainstManifest({ rootDir, manifest }) → { ok, summary, details }
//   - VERIFY_RESULT_KEYS
//
'use strict';

const fs   = require('fs');
const path = require('path');
const { hashFile, walkFiles, MANIFEST_SCHEMA } = require('./manifest.js');

const VERIFY_RESULT_KEYS = ['ok', 'modified', 'missing', 'extra'];

function verifyAgainstManifest({ rootDir, manifest } = {}) {
  if (!rootDir)  throw new Error('verifyAgainstManifest: rootDir is required');
  if (!manifest) throw new Error('verifyAgainstManifest: manifest is required');
  if (manifest.schema !== MANIFEST_SCHEMA) {
    throw new Error(
      `verifyAgainstManifest: unsupported manifest schema "${manifest.schema}" (expected "${MANIFEST_SCHEMA}")`
    );
  }

  const okFiles       = [];
  const modifiedFiles = [];
  const missingFiles  = [];
  const extraFiles    = [];

  const expectedByPath = new Map();
  for (const entry of manifest.files || []) {
    expectedByPath.set(entry.path, entry);
  }

  // Pass 1: every manifest file → check disk.
  for (const entry of expectedByPath.values()) {
    const abs = path.join(rootDir, entry.path);
    if (!fs.existsSync(abs)) {
      missingFiles.push({ path: entry.path, expected_sha256: entry.sha256 });
      continue;
    }
    let actualSha;
    try { actualSha = hashFile(abs); }
    catch (err) {
      missingFiles.push({ path: entry.path, expected_sha256: entry.sha256, error: err.message });
      continue;
    }
    if (actualSha === entry.sha256) {
      okFiles.push(entry.path);
    } else {
      modifiedFiles.push({
        path:            entry.path,
        expected_sha256: entry.sha256,
        actual_sha256:   actualSha,
      });
    }
  }

  // Pass 2: walk disk → flag files NOT in manifest. Advisory only.
  const onDisk = walkFiles(rootDir);
  for (const abs of onDisk) {
    const rel = path.relative(rootDir, abs).split(path.sep).join('/');
    if (!expectedByPath.has(rel)) extraFiles.push(rel);
  }

  const summary = {
    total_in_manifest: expectedByPath.size,
    ok:       okFiles.length,
    modified: modifiedFiles.length,
    missing:  missingFiles.length,
    extra:    extraFiles.length,
  };

  // verify is "ok" if no missing and no modified files. Extras are non-fatal.
  const ok = summary.missing === 0 && summary.modified === 0;

  return {
    ok,
    summary,
    details: {
      ok:       okFiles,
      modified: modifiedFiles,
      missing:  missingFiles,
      extra:    extraFiles,
    },
  };
}

module.exports = {
  VERIFY_RESULT_KEYS,
  verifyAgainstManifest,
};
