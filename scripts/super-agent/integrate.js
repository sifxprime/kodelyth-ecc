// scripts/super-agent/integrate.js
//
// Branch integration for the super-agent — the piece Agent B flagged as missing:
// "the swarm fans out but never merges worker branches." Two parts:
//
//   mergeOrder(steps)  — PURE. The order to merge worker branches in, respecting
//                        step dependencies (a dependency's branch merges first).
//   detectConflicts()  — uses `git merge-tree --write-tree` to find, WITHOUT
//                        touching the working tree, which branches would conflict
//                        if merged together.
//
// The orchestrator's integrate phase uses this to decide whether to proceed
// (clean) or stop for a human (conflicts) — see submitIntegration.
'use strict';

const { spawnSync } = require('child_process');

// Topologically order the done-with-branch steps so a dependency is merged
// before anything built on top of it. Pure; only reorders what is given.
function mergeOrder(steps) {
  const withBranch = (steps || []).filter((s) => s.status === 'done' && s.branch);
  const ids = new Set(withBranch.map((s) => s.id));
  const byId = new Map(withBranch.map((s) => [s.id, s]));
  const indeg = new Map(withBranch.map((s) => [s.id, 0]));
  for (const s of withBranch) {
    for (const d of s.deps || []) if (ids.has(String(d))) indeg.set(s.id, indeg.get(s.id) + 1);
  }
  // Stable: break ties by original order.
  const order = [];
  const queue = withBranch.filter((s) => indeg.get(s.id) === 0).map((s) => s.id);
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const s of withBranch) {
      if ((s.deps || []).map(String).includes(id) && indeg.has(s.id)) {
        indeg.set(s.id, indeg.get(s.id) - 1);
        if (indeg.get(s.id) === 0) queue.push(s.id);
      }
    }
  }
  // Any leftover (shouldn't happen for a validated plan) appended in input order.
  for (const s of withBranch) if (!order.includes(s.id)) order.push(s.id);
  return order.map((id) => ({ step: id, branch: byId.get(id).branch }));
}

function branchNames(branches) {
  return (branches || [])
    .map((b) => (typeof b === 'string' ? b : b && b.branch))
    .filter(Boolean);
}

// Does merging branchB into branchA conflict? No working-tree side effects.
function pairConflicts(repoRoot, branchA, branchB) {
  const r = spawnSync('git', ['merge-tree', '--write-tree', branchA, branchB], {
    cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status === 0) return { conflict: false };
  if (r.status === 1) return { conflict: true, files: parseConflictFiles(r.stdout) };
  return { conflict: false, error: (r.stderr || '').trim() || `git merge-tree exited ${r.status}` };
}

// Best-effort: pull file paths out of merge-tree's conflict section. The first
// line is the tree oid; conflict detail follows. Version-tolerant — we just keep
// anything that looks like a path, deduped.
function parseConflictFiles(stdout) {
  const files = new Set();
  for (const line of String(stdout || '').split('\n').slice(1)) {
    const m = line.match(/(?:^|\s)([\w.\-/]+\.[\w]+)(?:\s|$)/);
    if (m) files.add(m[1]);
  }
  return [...files];
}

// Pairwise conflict scan across all worker branches. Catches the common case —
// two workers editing the same file — before any real merge happens. Returns
// { clean, conflicts: [{ branches:[a,b], files:[] }], errors: [] }.
function detectConflicts(repoRoot, branches) {
  const names = branchNames(branches);
  const conflicts = [];
  const errors = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const c = pairConflicts(repoRoot, names[i], names[j]);
      if (c.error) errors.push({ branches: [names[i], names[j]], error: c.error });
      else if (c.conflict) conflicts.push({ branches: [names[i], names[j]], files: c.files || [] });
    }
  }
  return { clean: conflicts.length === 0, conflicts, errors };
}

module.exports = { mergeOrder, detectConflicts, pairConflicts, parseConflictFiles, branchNames };
