// Tests for scripts/evolve/proposals.js
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const os     = require('node:os');
const path   = require('node:path');

const P = require('../../scripts/evolve/proposals.js');

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-evolve-prop-')); }
function cleanup(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* */ } }

const FAKE_PROPOSAL = {
  id: 'skill-abc123',
  type: 'skill-upgrade',
  evidence: { memoryId: 'm1', reuseCount: 5 },
  proposal: {
    kind: 'create-skill',
    target_path: 'skills/test-skill/SKILL.md',
    diff: '# test skill\n\nbody\n',
    rationale: 'because reuse',
  },
};

// ── appendProposal ──────────────────────────────────────────────────────────

test('appendProposal: rejects malformed input', () => {
  const d = tmpDir();
  try {
    assert.throws(() => P.appendProposal({}, d), /must include id, type/);
    assert.throws(() => P.appendProposal({ id: 'x' }, d), /must include id, type/);
  } finally { cleanup(d); }
});

test('appendProposal: writes pending entry on first call', () => {
  const d = tmpDir();
  try {
    const r = P.appendProposal(FAKE_PROPOSAL, d);
    assert.equal(r.status, 'pending');
    assert.ok(r.created_at);
    const all = P.readLatest(d);
    assert.equal(all.length, 1);
    assert.equal(all[0].id, 'skill-abc123');
  } finally { cleanup(d); }
});

test('appendProposal: idempotent on same id', () => {
  const d = tmpDir();
  try {
    P.appendProposal(FAKE_PROPOSAL, d);
    P.appendProposal(FAKE_PROPOSAL, d);
    P.appendProposal(FAKE_PROPOSAL, d);
    const all = P.readLatest(d);
    assert.equal(all.length, 1, 'no duplicates');
    const events = P.readAll(d);
    assert.equal(events.length, 1, 'only one event written');
  } finally { cleanup(d); }
});

// ── setStatus ───────────────────────────────────────────────────────────────

test('setStatus: rejects invalid status', () => {
  const d = tmpDir();
  try {
    P.appendProposal(FAKE_PROPOSAL, d);
    assert.throws(() => P.setStatus('skill-abc123', 'banana', d), /invalid status/);
  } finally { cleanup(d); }
});

test('setStatus: returns null for unknown id', () => {
  const d = tmpDir();
  try {
    assert.equal(P.setStatus('does-not-exist', 'accepted', d), null);
  } finally { cleanup(d); }
});

test('setStatus: transitions pending → accepted, preserves diff/evidence', () => {
  const d = tmpDir();
  try {
    P.appendProposal(FAKE_PROPOSAL, d);
    const r = P.setStatus('skill-abc123', 'accepted', d, { applied_path: '/tmp/foo.md' });
    assert.equal(r.status, 'accepted');
    assert.equal(r.applied_path, '/tmp/foo.md');

    const cur = P.findById('skill-abc123', d);
    assert.equal(cur.status, 'accepted');
    assert.equal(cur.applied_path, '/tmp/foo.md');
    // Original proposal data preserved.
    assert.equal(cur.proposal.target_path, 'skills/test-skill/SKILL.md');
    assert.equal(cur.evidence.reuseCount, 5);
  } finally { cleanup(d); }
});

test('setStatus: pending → rejected → accepted preserves audit trail', () => {
  const d = tmpDir();
  try {
    P.appendProposal(FAKE_PROPOSAL, d);
    P.setStatus('skill-abc123', 'rejected', d, { note: 'no thanks' });
    P.setStatus('skill-abc123', 'accepted', d, { applied_path: '/x' });
    const events = P.readAll(d);
    assert.equal(events.length, 3, '3 events: append, reject, accept');
    assert.equal(P.findById('skill-abc123', d).status, 'accepted');
  } finally { cleanup(d); }
});

// ── listByStatus / findById ─────────────────────────────────────────────────

test('listByStatus: filters latest state', () => {
  const d = tmpDir();
  try {
    P.appendProposal(FAKE_PROPOSAL, d);
    P.appendProposal({ ...FAKE_PROPOSAL, id: 'skill-second' }, d);
    P.setStatus('skill-second', 'accepted', d);
    assert.equal(P.listByStatus('pending', d).length, 1);
    assert.equal(P.listByStatus('accepted', d).length, 1);
    assert.equal(P.listByStatus(null, d).length, 2);
  } finally { cleanup(d); }
});

test('findById: returns null when absent', () => {
  const d = tmpDir();
  try {
    assert.equal(P.findById('nope', d), null);
  } finally { cleanup(d); }
});

// ── applyProposalToDisk ─────────────────────────────────────────────────────

test('applyProposalToDisk: writes diff to target_path under repoRoot', () => {
  const d = tmpDir();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-apply-'));
  try {
    P.appendProposal(FAKE_PROPOSAL, d);
    const proposal = P.findById('skill-abc123', d);
    const r = P.applyProposalToDisk(proposal, { repoRoot: root });
    assert.equal(r.written, true);
    assert.ok(fs.existsSync(r.path));
    assert.equal(fs.readFileSync(r.path, 'utf8'), '# test skill\n\nbody\n');
  } finally { cleanup(d); cleanup(root); }
});

test('applyProposalToDisk: refuses to overwrite without --overwrite', () => {
  const d = tmpDir();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-apply-'));
  try {
    P.appendProposal(FAKE_PROPOSAL, d);
    const proposal = P.findById('skill-abc123', d);
    P.applyProposalToDisk(proposal, { repoRoot: root });
    assert.throws(
      () => P.applyProposalToDisk(proposal, { repoRoot: root }),
      /refusing to overwrite/
    );
    // overwrite=true succeeds
    const r = P.applyProposalToDisk({
      ...proposal,
      proposal: { ...proposal.proposal, diff: 'new content' },
    }, { repoRoot: root, overwrite: true });
    assert.equal(fs.readFileSync(r.path, 'utf8'), 'new content');
  } finally { cleanup(d); cleanup(root); }
});

test('applyProposalToDisk: requires repoRoot', () => {
  assert.throws(() => P.applyProposalToDisk(FAKE_PROPOSAL, {}), /repoRoot is required/);
});

test('applyProposalToDisk: rejects proposal without diff/target_path', () => {
  assert.throws(
    () => P.applyProposalToDisk({ id: 'x', proposal: {} }, { repoRoot: '/tmp' }),
    /lacks diff or target_path/
  );
});
