// scripts/arena/evil.js
// EVIL mode — the adversarial half of the arena.
//
// The 8 devil-mode agents already hunt well (real ripgrep/jq detection commands).
// What they lacked was judgment: everything came back as an undifferentiated pile
// with no way to tell a confirmed exploit from a hunch.
//
// This module adds the three missing pieces:
//   1. SCORING        — severity x confidence x exploitability, so noise sinks
//   2. VERIFICATION   — each finding gets challenged: prove it, or it is refuted
//   3. LOOP-UNTIL-DRY — keep sweeping until two rounds turn up nothing new
//
// It does not call an LLM itself. It builds the agent briefs the orchestrator
// dispatches, and it grades what comes back. That keeps this file testable.

'use strict';

const { makeFinding, dedupe, VERDICT, effectiveRisk } = require('./contract');

// ── The crew ─────────────────────────────────────────────────────────────────
// `core` fires on every sweep. The rest are opt-in via flags, because each one
// costs a full agent invocation and not every task needs a license audit.

const CREW = {
  'prompt-injection-hunter': { core: true,  hunts: 'jailbreaks, indirect injection, system-prompt leaks, tool-call hijacking' },
  'supply-chain-auditor':    { core: true,  hunts: 'typosquats, malicious install scripts, lockfile drift, unsigned packages' },
  'secret-hunter':           { core: true,  hunts: 'live credentials, git-history leaks, encoded keys, client-bundled env vars' },
  'backdoor-hunter':         { core: true,  hunts: 'obfuscated payloads, network beacons, time bombs, eval/exec abuse' },
  'license-violation-finder':{ core: false, flag: '--license',   hunts: 'GPL contamination, missing attribution, copyleft risk' },
  'code-stealer-detector':   { core: false, flag: '--theft',     hunts: 'copy-paste provenance, leaked private code, AI-gen origin' },
  'jailbreak-tester':        { core: false, flag: '--jailbreak', hunts: 'live AI-feature red-team, refusal bypass, overrefusal' },
  'chaos-engineer':          { core: false, flag: '--chaos',     hunts: 'fault injection, resource exhaustion, hidden assumptions' },
};

const PRESETS = {
  default:       ['--core'],
  '--all':       Object.keys(CREW),
  '--pre-public':['--core', '--license', '--theft'],
  '--pre-launch':['--core', '--jailbreak', '--chaos'],
};

function selectCrew(flags = []) {
  const set = new Set(Object.entries(CREW).filter(([, m]) => m.core).map(([n]) => n));
  if (flags.includes('--all')) return Object.keys(CREW);
  for (const [name, meta] of Object.entries(CREW)) {
    if (meta.flag && flags.includes(meta.flag)) set.add(name);
  }
  for (const preset of ['--pre-public', '--pre-launch']) {
    if (flags.includes(preset)) {
      for (const f of PRESETS[preset]) {
        if (f === '--core') continue;
        const hit = Object.entries(CREW).find(([, m]) => m.flag === f);
        if (hit) set.add(hit[0]);
      }
    }
  }
  return [...set];
}

// ── Stage 1: hunt briefs ─────────────────────────────────────────────────────
// Each agent is told to report in the Finding contract, and — critically — that
// a finding without a reproduction is worth less than no finding at all.

function huntBrief({ agent, scope, round, knownFindingIds = [], priorKnowledge = '' }) {
  const meta = CREW[agent] || { hunts: 'issues' };
  return [
    `You are ${agent}. Hunt: ${meta.hunts}.`,
    `Scope: ${scope || 'the whole repository'}.`,
    `Round ${round}.`,
    knownFindingIds.length
      ? `Already-reported findings (${knownFindingIds.length}) are known — do NOT re-report them. Hunt for what a previous sweep MISSED. Go deeper: different files, different attack classes, indirect paths.`
      : `First sweep — cover your full detection surface.`,
    '',
    'Report every finding as JSON matching this shape:',
    '{ "title", "severity": critical|high|medium|low|info, "confidence": confirmed|likely|suspected|speculative,',
    '  "exploitability": trivial|moderate|hard|theoretical, "file", "line", "evidence", "repro", "fix" }',
    '',
    'Rules that decide whether your finding survives review:',
    '- `evidence` must quote the actual offending code, not describe it.',
    '- `repro` must be concrete steps or a command. A finding you cannot reproduce is `speculative` at best.',
    '- Do not pad. Five confirmed findings beat forty guesses — unverifiable findings get refuted and count against you.',
    '- Only claim `confirmed` when you have actually reproduced it.',
    // Prior knowledge lands last so it reads as context for the rules above,
    // not as a competing instruction set.
    priorKnowledge || null,
  ].filter(line => line !== null).join('\n');
}

// ── Stage 2: verification briefs ─────────────────────────────────────────────
// The adversarial-verification trick: the verifier is told to REFUTE, not to
// confirm. Default-to-refuted kills the false positives that otherwise waste
// GOD mode's entire next round.

function verifyBrief(finding) {
  return [
    `Adversarially verify this finding. Your job is to REFUTE it.`,
    '',
    `Title: ${finding.title}`,
    `Claimed severity: ${finding.severity} (${finding.confidence}, ${finding.exploitability})`,
    `Location: ${finding.file || 'unknown'}:${finding.line ?? '?'}`,
    `Evidence: ${finding.evidence || '(none given)'}`,
    `Claimed repro: ${finding.repro || '(none given)'}`,
    '',
    'Do this:',
    '1. Read the actual code at that location. Does the quoted evidence match reality?',
    '2. Check whether guards, framework behaviour, or callers already neutralise it.',
    '3. Try to reproduce it. If you cannot, say so plainly.',
    '',
    'Return JSON: { "verdict": "confirmed"|"refuted"|"needs_context", "why": "...", "repro": "..."|null }',
    '',
    'Default to "refuted" when uncertain. A finding that cannot be demonstrated is not a finding.',
    'Use "needs_context" only when verification genuinely requires runtime access or secrets you do not have.',
  ].join('\n');
}

// ── Stage 3: grade the returns ───────────────────────────────────────────────

function normalizeFindings(rawList = [], { agent, round }) {
  const out = [];
  for (const raw of rawList) {
    if (!raw || !raw.title) continue;
    out.push(makeFinding({ ...raw, agent, round }));
  }
  return out;
}

// Apply verification verdicts back onto the findings. A refuted finding stays in
// the record (so the same false positive is not re-litigated next round) but its
// effective risk drops to zero.
// A verdict may be given as a bare string ('confirmed') or as an object
// ({ verdict, why, repro }). Both are accepted because both are natural to
// write; anything else is a caller mistake and must not be swallowed — silently
// keeping 'unverified' would report "0 confirmed" on a run that confirmed ten
// findings, which reads as a clean result instead of a broken one.
function normalizeVerdict(v, id) {
  const raw = typeof v === 'string' ? { verdict: v } : v;
  if (!raw || typeof raw !== 'object') {
    throw new TypeError(`verdict for ${id} must be a string or an object, got ${typeof v}`);
  }
  const known = Object.values(VERDICT);
  if (raw.verdict !== undefined && !known.includes(raw.verdict)) {
    throw new TypeError(`unknown verdict "${raw.verdict}" for ${id} — expected one of ${known.join(', ')}`);
  }
  return raw;
}

function applyVerdicts(findings = [], verdicts = {}) {
  return findings.map(f => {
    const given = verdicts[f.id];
    if (given === undefined || given === null) return f;
    const v = normalizeVerdict(given, f.id);
    const next = { ...f, verdict: v.verdict || f.verdict };
    if (v.repro && !next.repro) next.repro = String(v.repro).slice(0, 2000);
    if (v.why) next.evidence = `${next.evidence}\n[verification] ${v.why}`.slice(0, 2000);
    // Confirming a finding raises certainty; refuting zeroes it out via effectiveRisk.
    if (next.verdict === VERDICT.CONFIRMED) next.confidence = 'confirmed';
    return makeFinding(next);
  });
}

// Which findings are worth spending a verification pass on. Verifying an
// already-confirmed or clearly-trivial item is wasted tokens.
function selectForVerification(findings = [], { max = 12, minRisk = 1.0 } = {}) {
  return dedupe(findings)
    .filter(f => f.verdict === VERDICT.UNVERIFIED && f.risk >= minRisk)
    .slice(0, max);
}

// What GOD mode actually has to fix: open, verified-or-plausible, worst first.
function actionable(findings = [], { minRisk = 2.0 } = {}) {
  return dedupe(findings)
    .filter(f => f.verdict !== VERDICT.REFUTED)
    .filter(f => effectiveRisk(f) >= minRisk)
    .sort((a, b) => effectiveRisk(b) - effectiveRisk(a));
}

// ── Sweep plan ───────────────────────────────────────────────────────────────
// The orchestrator asks for a plan, dispatches the agents, and feeds results back.

function planSweep({ scope, flags = [], round = 1, knownFindingIds = [], priorKnowledge = '' } = {}) {
  const crew = selectCrew(flags);
  return {
    round,
    crew,
    briefs: crew.map(agent => ({ agent, brief: huntBrief({ agent, scope, round, knownFindingIds, priorKnowledge }) })),
    estimatedTokens: crew.length * 12000, // rough: one agent sweep ≈ 12k
  };
}

module.exports = {
  CREW, PRESETS,
  selectCrew, planSweep,
  huntBrief, verifyBrief,
  normalizeFindings, applyVerdicts,
  selectForVerification, actionable,
};
