// scripts/arena/contract.js
// The shared data contract between GOD mode (builds) and EVIL mode (attacks).
//
// Without one schema both crews agree on, they cannot exchange results:
// EVIL produces Findings, GOD consumes them and produces Artifacts, and the
// Arena scores both to decide whether to run another round.
//
// Pure data + validation. Zero dependencies, no I/O.

'use strict';

// ── Severity / confidence scales ─────────────────────────────────────────────
// Severity is what it costs if real. Confidence is how sure we are it IS real.
// Exploitability is how hard it is to actually trigger. Risk multiplies all three
// so a "critical but almost certainly a false positive" ranks below a
// "high, confirmed, trivially exploitable".

const SEVERITY = { critical: 10, high: 7, medium: 4, low: 2, info: 1 };
const CONFIDENCE = { confirmed: 1.0, likely: 0.7, suspected: 0.4, speculative: 0.15 };
const EXPLOITABILITY = { trivial: 1.0, moderate: 0.7, hard: 0.4, theoretical: 0.2 };

const VERDICT = {
  CONFIRMED: 'confirmed',       // verification reproduced it
  REFUTED: 'refuted',           // verification proved it is a false positive
  UNVERIFIED: 'unverified',     // not yet challenged
  NEEDS_CONTEXT: 'needs_context', // can't tell without runtime/secrets we don't have
};

// ── Finding ──────────────────────────────────────────────────────────────────
// One thing EVIL mode believes is wrong. `repro` is what makes a finding
// actionable rather than an opinion — GOD mode cannot fix what it cannot reproduce.

function makeFinding(input = {}) {
  const f = {
    id: input.id || null,          // stable hash, assigned by dedupe
    agent: input.agent || 'unknown',
    title: String(input.title || '').slice(0, 200),
    severity: SEVERITY[input.severity] ? input.severity : 'medium',
    confidence: CONFIDENCE[input.confidence] ? input.confidence : 'suspected',
    exploitability: EXPLOITABILITY[input.exploitability] ? input.exploitability : 'moderate',
    file: input.file || null,
    line: Number.isInteger(input.line) ? input.line : null,
    evidence: String(input.evidence || '').slice(0, 2000),
    repro: input.repro ? String(input.repro).slice(0, 2000) : null,
    fix: input.fix ? String(input.fix).slice(0, 2000) : null,
    verdict: VERDICT[String(input.verdict || '').toUpperCase()] || input.verdict || VERDICT.UNVERIFIED,
    round: Number.isInteger(input.round) ? input.round : 0,
  };
  f.id = f.id || fingerprint(f);
  f.risk = riskScore(f);
  return f;
}

// Stable identity: same issue in the same place is the same finding across
// rounds, even if the wording of the title drifts between agents.
function fingerprint(f) {
  const basis = [
    (f.file || 'nofile').toLowerCase(),
    f.line == null ? 'noline' : String(f.line),
    normalizeTitle(f.title),
  ].join('::');
  // FNV-1a — deterministic, dependency-free, good enough for dedupe keys.
  let h = 0x811c9dc5;
  for (let i = 0; i < basis.length; i++) {
    h ^= basis.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(a|an|the|is|are|in|on|of|to|for|with|at|by)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

// risk = severity × confidence × exploitability  → 0..10
function riskScore(f) {
  const s = SEVERITY[f.severity] || SEVERITY.medium;
  const c = CONFIDENCE[f.confidence] || CONFIDENCE.suspected;
  const e = EXPLOITABILITY[f.exploitability] || EXPLOITABILITY.moderate;
  return Math.round(s * c * e * 100) / 100;
}

// Refuted findings carry no risk — that is the whole point of verification.
function effectiveRisk(f) {
  return f.verdict === VERDICT.REFUTED ? 0 : riskScore(f);
}

// ── Dedupe / diff across rounds ──────────────────────────────────────────────

function dedupe(findings = []) {
  const byId = new Map();
  for (const raw of findings) {
    const f = raw && raw.id && raw.risk != null ? raw : makeFinding(raw || {});
    const prev = byId.get(f.id);
    // Keep the strongest claim when two agents report the same thing.
    if (!prev || effectiveRisk(f) > effectiveRisk(prev)) byId.set(f.id, f);
  }
  return [...byId.values()].sort((a, b) => effectiveRisk(b) - effectiveRisk(a));
}

// What EVIL found this round that it had never found before.
function newFindings(current = [], seenIds = []) {
  const seen = new Set(seenIds);
  return dedupe(current).filter(f => !seen.has(f.id));
}

// ── Artifact (what GOD produces) ─────────────────────────────────────────────
// GOD must emit something checkable. `verified` is only true when a command
// actually ran and passed — claims alone never count.

function makeArtifact(input = {}) {
  return {
    kind: ['code', 'test', 'doc', 'config', 'benchmark'].includes(input.kind) ? input.kind : 'code',
    files: Array.isArray(input.files) ? input.files.slice(0, 50) : [],
    summary: String(input.summary || '').slice(0, 1000),
    verifyCommand: input.verifyCommand ? String(input.verifyCommand).slice(0, 300) : null,
    verified: input.verified === true,
    round: Number.isInteger(input.round) ? input.round : 0,
  };
}

// ── Round verdict ────────────────────────────────────────────────────────────

function makeRoundVerdict(input = {}) {
  const findings = dedupe(input.findings || []);
  const fresh = Array.isArray(input.newFindingIds) ? input.newFindingIds : [];
  const open = findings.filter(f => f.verdict !== VERDICT.REFUTED);
  const confirmed = findings.filter(f => f.verdict === VERDICT.CONFIRMED);
  return {
    round: Number.isInteger(input.round) ? input.round : 0,
    findings,
    newFindingIds: fresh,
    counts: {
      total: findings.length,
      open: open.length,
      confirmed: confirmed.length,
      refuted: findings.length - open.length,
      new: fresh.length,
    },
    // Total unmitigated risk still standing after verification.
    openRisk: Math.round(open.reduce((sum, f) => sum + effectiveRisk(f), 0) * 100) / 100,
    artifacts: (input.artifacts || []).map(makeArtifact),
  };
}

// ── Convergence ──────────────────────────────────────────────────────────────
// The arena stops when the attacker gives up: N consecutive rounds where EVIL
// found nothing genuinely new. Not "zero findings" — findings may remain open
// and accepted; what matters is that attacking harder stops yielding anything.

function hasConverged(roundVerdicts = [], quietRoundsRequired = 2) {
  if (roundVerdicts.length < quietRoundsRequired) return false;
  return roundVerdicts
    .slice(-quietRoundsRequired)
    .every(r => (r.counts?.new || 0) === 0);
}

module.exports = {
  SEVERITY, CONFIDENCE, EXPLOITABILITY, VERDICT,
  makeFinding, fingerprint, riskScore, effectiveRisk,
  dedupe, newFindings,
  makeArtifact, makeRoundVerdict, hasConverged,
};
