// scripts/lib/safe-fs.js
//
// Path containment and safe file replacement, in one place.
//
// This module exists because the same bug was confirmed four times across three
// unrelated files — `scripts/terse/compress.js`, `scripts/dashboard/data.js`,
// and `scripts/dashboard/server.js`. Every instance was the same mistake:
//
//     const abs = path.join(root, userInput);
//     if (!abs.startsWith(root + path.sep)) return null;   // lexical only
//     fs.readFileSync(abs);                                // follows symlinks
//
// `path.join` and `path.resolve` normalise `..`, so a *textual* escape is
// caught. Neither resolves symlinks. A link sitting lexically inside the root
// passes the check while its target is anywhere on disk, and the read follows
// it. Four spot fixes would have been a fifth bug waiting; this is the guard.
//
// Everything here fails closed: on any doubt, return null or throw.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Containment ─────────────────────────────────────────────────────────────

/**
 * Resolve `candidate` and confirm it really lives inside `root`.
 *
 * Both sides are canonicalised, so a symlink is judged by where it POINTS, not
 * where it sits. Returns the resolved absolute path, or null if it escapes, is
 * missing, or cannot be read.
 *
 * `allowExact` names a path that may equal the root itself (some callers serve
 * an index file at the boundary).
 */
function resolveContained(candidate, root, { allowExact = null } = {}) {
  if (!candidate || !root) return null;

  const absRoot = path.resolve(root);
  const abs = path.isAbsolute(candidate) ? path.resolve(candidate) : path.resolve(absRoot, candidate);

  // Cheap lexical rejection first — catches `..` without touching the disk.
  const lexicallyInside = abs === absRoot || abs.startsWith(absRoot + path.sep);
  if (!lexicallyInside && abs !== allowExact) return null;

  // The check that actually matters. realpath resolves every symlink in the
  // path, including intermediate directories.
  let real;
  try {
    real = fs.realpathSync(abs);
  } catch {
    return null;   // missing, dangling link, or unreadable
  }

  let realRoot;
  try {
    realRoot = fs.realpathSync(absRoot);
  } catch {
    realRoot = absRoot;   // the root itself may legitimately not exist yet
  }

  const reallyInside = real === realRoot || real.startsWith(realRoot + path.sep);
  if (!reallyInside && real !== allowExact) return null;

  // Callers get the pre-realpath path so user-facing output keeps the name the
  // caller asked for; containment has already been proven against the target.
  return abs;
}

/**
 * Stat a path that must be a regular file, refusing symlinks outright.
 *
 * Used where the caller is about to REWRITE the file: following a link there
 * means writing through it to a target the user never named, and copying its
 * contents into a backup beside the link.
 */
function statRegularFile(absPath) {
  let st;
  try {
    st = fs.lstatSync(absPath);
  } catch {
    throw new Error(`file not found: ${absPath}`);
  }
  if (st.isSymbolicLink()) throw new Error(`refusing to operate on a symlink: ${absPath}`);
  if (!st.isFile()) throw new Error(`not a regular file: ${absPath}`);
  return st;
}

/**
 * A directory path taken from configuration (an env var, usually).
 *
 * This is a trusted-config surface — anyone who can set your environment
 * already has leverage — but an unnormalised value silently creates trees
 * wherever `..` points, so normalise and reject the obvious escapes.
 */
function safeConfigDir(value, fallback) {
  if (!value) return fallback;
  const raw = String(value);

  // Inspect the RAW value, not the resolved one. path.resolve collapses `..`
  // before any check could see it — resolving first and then looking for `..`
  // is dead code that always passes.
  if (raw.split(/[\\/]/).includes('..')) return fallback;

  return path.resolve(raw);
}

// ── Writing ─────────────────────────────────────────────────────────────────

/**
 * Create a NEW file, refusing to follow a link or overwrite anything.
 *
 * `wx` is O_CREAT|O_EXCL|O_WRONLY: if `dest` exists — including as a *dangling*
 * symlink, which `fs.existsSync` reports as absent — the open fails instead of
 * writing through the link to a path someone else chose.
 *
 * The mode is applied twice on purpose. `open` filters its mode argument
 * through the process umask, so a 0644 original would come back 0600 under
 * `umask 077`; `fchmod` ignores the umask and restores it exactly. Passing it
 * to `open` as well means the file is never briefly world-readable.
 */
function writeNewFile(dest, data, mode) {
  const fd = fs.openSync(dest, 'wx', mode);
  try {
    fs.writeFileSync(fd, data);
    fs.fchmodSync(fd, mode);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Replace a file's contents atomically, preserving its permissions.
 *
 * Writes to a randomly-named sibling and renames over the target, so a crash
 * cannot leave the user with a truncated file. The name is random rather than
 * pid-based because a predictable one lets another process pre-plant a symlink
 * there and capture the write. A failed rename unlinks the temp rather than
 * leaving the document's contents in a stray world-readable file.
 */
function replaceFileAtomic(absPath, contents, mode) {
  const tmp = `${absPath}.tmp-${crypto.randomBytes(8).toString('hex')}`;
  let renamed = false;
  try {
    writeNewFile(tmp, contents, mode);
    fs.renameSync(tmp, absPath);
    renamed = true;
  } finally {
    if (!renamed) { try { fs.unlinkSync(tmp); } catch { /* nothing to clean */ } }
  }
  return absPath;
}

module.exports = {
  resolveContained,
  statRegularFile,
  safeConfigDir,
  writeNewFile,
  replaceFileAtomic,
};
