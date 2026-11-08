// scripts/memory/project-id.js
//
// One project-identity resolver for the memory subsystem. Memory used to key a
// project by sha256(absolute path), while the observer keyed it by git remote —
// so the moment you cloned, moved, or renamed a repo, its absolute path changed
// and all of its memories orphaned (they were filed under the old path hash).
//
// This resolver is git-remote-first with a path fallback, and NORMALIZES the
// remote so the same repo always hashes the same way regardless of protocol,
// host form, .git suffix, embedded credentials, or trailing slash:
//
//   git@github.com:owner/repo.git     ─┐
//   https://github.com/owner/repo/     ├─→  remote:github.com/owner/repo  → one id
//   ssh://git@github.com/owner/repo    ─┘
//
// Backward compatibility is handled by read-both: new memories are written under
// the git-remote id, but recall also matches the LEGACY path id, so memories
// captured before this change are never lost. Zero deps, local only.
'use strict';

const crypto = require('crypto');
const { spawnSync } = require('child_process');

function sha12(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 12);
}

function runGit(args, cwd) {
  try {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (r.status !== 0) return '';
    return (r.stdout || '').trim();
  } catch {
    return '';
  }
}

// Strip `://user:pass@` so a credential-bearing remote and a clean one map to the
// same project (and so a secret never ends up in a hash input we might log).
function stripRemoteCredentials(url) {
  if (!url) return '';
  return String(url).replace(/:\/\/[^@]+@/, '://');
}

// Canonical form of a git remote URL — see the header for the shapes this folds
// together. Returns '' for empty input.
function normalizeRemote(url) {
  let u = stripRemoteCredentials(url).trim();
  if (!u) return '';
  u = u.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');   // strip scheme://
  u = u.replace(/^git@/i, '');                      // strip scp-style user
  u = u.replace(/^([^/:]+):(?!\d)/, '$1/');         // host:owner/repo → host/owner/repo (scp form, not host:port)
  u = u.replace(/\.git$/i, '');                     // drop a trailing .git
  u = u.replace(/\/+$/, '');                        // drop trailing slashes
  return u.toLowerCase();
}

// The legacy, path-only id the memory store used before this change. Kept so
// memories captured under the old scheme are still found (read-both).
function legacyPathId(projectRoot) {
  return sha12(projectRoot);
}

// The canonical id for a project: git-remote-first (stable across clone/move),
// path fallback (local-only repos, non-git directories).
function resolveProjectId(projectRoot, { cwd } = {}) {
  if (!projectRoot) return 'global';
  const dir = cwd || projectRoot;
  const remote = normalizeRemote(runGit(['remote', 'get-url', 'origin'], dir));
  if (remote) return sha12('remote:' + remote);
  return legacyPathId(projectRoot);
}

// Every id that should match this project when recalling: the canonical id AND
// the legacy path id, de-duped. New memories are written under the first; old
// ones are still found via the second. (When the repo has no remote the two are
// identical and this collapses to one.)
function matchingProjectIds(projectRoot, opts = {}) {
  if (!projectRoot) return [];
  const ids = new Set();
  ids.add(resolveProjectId(projectRoot, opts));
  ids.add(legacyPathId(projectRoot));
  return [...ids];
}

module.exports = {
  sha12,
  stripRemoteCredentials,
  normalizeRemote,
  legacyPathId,
  resolveProjectId,
  matchingProjectIds,
};
