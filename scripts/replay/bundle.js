// =============================================================================
// Kodelyth ECC — Session Bundle (Phase 2.8)
//
// Pure read/write of portable session bundles. A bundle is a single JSON file
// that captures everything in a coordination directory:
//
//   .orchestration/<session>/                  ← input
//     <worker-slug>/
//       task.md
//       handoff.md
//       status.md
//
// Bundle format (v1):
// {
//   "schema":  "kodelyth.session-bundle/v1",
//   "session": "swarm-2026-05-10-4a",
//   "exported_at": "2026-05-10T17:30:00Z",
//   "exported_by": "kodelyth-ecc@1.7.0",
//   "meta": {                                  ← optional, for replay variations
//     "task":          "audit oauth flow",
//     "agents":        ["security-reviewer", "code-reviewer", ...],
//     "harness":       "claude",
//     "base_ref":      "HEAD",
//     "repo_root":     "/path/to/repo"
//   },
//   "workers": [
//     { "slug": "security-reviewer", "task": "...", "handoff": "...", "status": "..." }
//   ]
// }
//
// Pure functions, zero deps. Tested without spawning anything.
// =============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');
const { resolveContainedForWrite } = require('../lib/safe-fs');

const BUNDLE_SCHEMA = 'kodelyth.session-bundle/v1';
const BUNDLE_VERSION = '1.7.0';

// ── Read a coordination dir into a bundle ────────────────────────────────────
function exportBundle({ sessionDir, sessionName, meta = {} }) {
  if (!sessionDir || typeof sessionDir !== 'string') {
    throw new Error('exportBundle: sessionDir is required');
  }
  if (!fs.existsSync(sessionDir)) {
    throw new Error(`exportBundle: session directory not found: ${sessionDir}`);
  }
  const session = sessionName || path.basename(sessionDir);

  const entries = fs.readdirSync(sessionDir, { withFileTypes: true });
  const workers = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const dir  = path.join(sessionDir, slug);
    workers.push({
      slug,
      task:    safeRead(path.join(dir, 'task.md')),
      handoff: safeRead(path.join(dir, 'handoff.md')),
      status:  safeRead(path.join(dir, 'status.md')),
    });
  }

  workers.sort((a, b) => a.slug.localeCompare(b.slug));

  return {
    schema:      BUNDLE_SCHEMA,
    session,
    exported_at: new Date().toISOString(),
    exported_by: `kodelyth-ecc@${BUNDLE_VERSION}`,
    meta:        { ...meta },
    workers,
  };
}

// ── Write a bundle JSON to disk ──────────────────────────────────────────────
function writeBundle(bundle, outPath) {
  if (!bundle || bundle.schema !== BUNDLE_SCHEMA) {
    throw new Error(`writeBundle: invalid schema (${bundle && bundle.schema})`);
  }
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
  return outPath;
}

// ── Read + validate a bundle file ────────────────────────────────────────────
function readBundle(bundlePath) {
  if (!fs.existsSync(bundlePath)) {
    throw new Error(`readBundle: file not found: ${bundlePath}`);
  }
  const raw = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  return validateBundle(raw);
}

// One path segment: no separator, no traversal, no leading dot. This matches what
// exportBundle actually emits — slugify yields [a-z0-9-]+ and session is a
// basename — so it rejects nothing a genuine bundle contains.
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_SEGMENT = 128;

function assertSafeSegment(value, label) {
  if (typeof value !== 'string' || value.length > MAX_SEGMENT || !SAFE_SEGMENT.test(value)) {
    throw new Error(
      `bundle: ${label} must be a single path segment matching ${SAFE_SEGMENT} ` +
      `(got ${JSON.stringify(String(value).slice(0, 60))})`
    );
  }
}

function validateBundle(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('bundle: not an object');
  if (raw.schema !== BUNDLE_SCHEMA) {
    throw new Error(`bundle: unsupported schema "${raw.schema}" (expected "${BUNDLE_SCHEMA}")`);
  }
  if (typeof raw.session !== 'string' || !raw.session) {
    throw new Error('bundle: missing "session"');
  }
  // A bundle exists to be SHARED — that is the whole point of the format — so every
  // string in it is untrusted input. exportBundle only ever emits single path
  // segments here: `session` is a path.basename and each `slug` is a readdirSync
  // entry name. Nothing legitimate contains a separator, so anything that does is
  // an attempt to escape the directory the importer chose.
  //
  // Unchecked, `session` became the import target via path.join(coordRoot, session),
  // and with --overwrite that target is handed to fs.rmSync(recursive, force):
  // "../important-work" recursively deleted an unrelated project while the CLI
  // printed success. Each `slug` became path.join(targetDir, slug) for a
  // mkdirSync(recursive) plus three writeFileSync calls, so
  // "../../.claude/rules/common/x" planted an always-on rule file whose contents
  // the bundle author chose.
  assertSafeSegment(raw.session, 'session');
  if (!Array.isArray(raw.workers) || raw.workers.length === 0) {
    throw new Error('bundle: "workers" must be a non-empty array');
  }
  for (const w of raw.workers) {
    if (!w || typeof w.slug !== 'string') throw new Error('bundle: each worker needs a string "slug"');
    assertSafeSegment(w.slug, 'worker slug');
  }
  return raw;
}

// ── Restore a bundle into a coordination dir ─────────────────────────────────
function importBundle(bundle, { targetDir, overwrite = false } = {}) {
  validateBundle(bundle);
  if (!targetDir) throw new Error('importBundle: targetDir is required');
  const dir = path.resolve(targetDir);
  if (fs.existsSync(dir)) {
    if (!overwrite) throw new Error(`importBundle: targetDir already exists: ${dir} (pass overwrite=true to replace)`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
  for (const w of bundle.workers) {
    // Backstop, not the primary guard: validateBundle already rejected every slug
    // containing a separator, and `dir` was just created by this function (an
    // existing targetDir is either refused or rmSync'd above), so no attacker-planted
    // symlink can survive into this loop today. The check costs nothing and keeps the
    // invariant true for any future caller that hands importBundle a directory it
    // did not create — which is the only way the symlink case becomes reachable.
    const wdir = resolveContainedForWrite(path.join(dir, w.slug), dir);
    if (!wdir) throw new Error(`importBundle: worker slug escapes targetDir: ${w.slug}`);
    fs.mkdirSync(wdir, { recursive: true });
    if (typeof w.task    === 'string') fs.writeFileSync(path.join(wdir, 'task.md'),    w.task,    'utf8');
    if (typeof w.handoff === 'string') fs.writeFileSync(path.join(wdir, 'handoff.md'), w.handoff, 'utf8');
    if (typeof w.status  === 'string') fs.writeFileSync(path.join(wdir, 'status.md'),  w.status,  'utf8');
  }
  return { targetDir: dir, workers: bundle.workers.map(w => w.slug) };
}

// ── Diff: compare two bundles' handoffs (for A/B replay analysis) ────────────
function diffBundles(a, b) {
  validateBundle(a);
  validateBundle(b);

  const aBySlug = new Map(a.workers.map(w => [w.slug, w]));
  const bBySlug = new Map(b.workers.map(w => [w.slug, w]));
  const allSlugs = new Set([...aBySlug.keys(), ...bBySlug.keys()]);

  const out = [];
  for (const slug of [...allSlugs].sort()) {
    const A = aBySlug.get(slug);
    const B = bBySlug.get(slug);
    out.push({
      slug,
      in_a: !!A,
      in_b: !!B,
      task_changed:    !!A && !!B && (A.task    || '') !== (B.task    || ''),
      handoff_changed: !!A && !!B && (A.handoff || '') !== (B.handoff || ''),
      status_changed:  !!A && !!B && (A.status  || '') !== (B.status  || ''),
      a_handoff_len: A ? (A.handoff || '').length : 0,
      b_handoff_len: B ? (B.handoff || '').length : 0,
    });
  }
  return out;
}

// ── Helper ───────────────────────────────────────────────────────────────────
function safeRead(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { return ''; }
}

// ── Compute the next replay session name ─────────────────────────────────────
function nextReplayName(originalSession, takenSet = new Set()) {
  if (typeof originalSession !== 'string' || !originalSession) {
    throw new Error('nextReplayName: originalSession is required');
  }
  // Strip any existing -replay-N suffix to get the canonical base.
  const base = originalSession.replace(/-replay-\d+$/, '');
  for (let n = 1; n < 1000; n++) {
    const candidate = `${base}-replay-${n}`;
    if (!takenSet.has(candidate)) return candidate;
  }
  throw new Error('nextReplayName: exhausted replay numbers');
}

module.exports = {
  BUNDLE_SCHEMA,
  BUNDLE_VERSION,
  exportBundle,
  writeBundle,
  readBundle,
  validateBundle,
  importBundle,
  diffBundles,
  nextReplayName,
};
