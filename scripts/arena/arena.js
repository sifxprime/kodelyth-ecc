// scripts/arena/arena.js
// The Arena — GOD builds, EVIL attacks, repeat until the attacker gives up.
//
// This is a STATE MACHINE, not an agent dispatcher. It decides what should
// happen next and grades what comes back; the actual agent invocations are made
// by the AI driving `/arena`. Keeping dispatch out of here is what makes the
// loop testable without spending a single token.
//
//   round N:  god_build  ->  evil_hunt  ->  evil_verify  ->  round_close
//                                                              |
//                            converged / out of budget? --------+
//                                   |                    no -> round N+1
//                                  yes
//                                   v
//                                 report

'use strict';

const god = require('./god');
const evil = require('./evil');
const state = require('./state');
const { dedupe, effectiveRisk, VERDICT } = require('./contract');

// ── Phases within a round ────────────────────────────────────────────────────

const PHASE = {
  GOD_BUILD: 'god_build',
  EVIL_HUNT: 'evil_hunt',
  EVIL_VERIFY: 'evil_verify',
  ROUND_CLOSE: 'round_close',
  REPORT: 'report',
};

// ── Starting a run ───────────────────────────────────────────────────────────

function startArena({ task, scope = '.', flags = [], limits = {} } = {}) {
  const run = state.createRun({ task, limits });
  run.scope = scope;
  run.flags = flags;
  run.phase = PHASE.GOD_BUILD;
  run.pending = { artifacts: [], findings: [], addressedIds: [] };
  state.save(run);
  return run;
}

// ── The state machine ────────────────────────────────────────────────────────
// Given a run, what happens next? Returns an actionable step with the brief the
// AI should execute, plus a cost estimate the budget can veto.

function nextAction(run) {
  if (!run) throw new Error('arena: no run');

  // A finished run has nothing left but its report.
  if (run.status !== 'running') {
    return { action: PHASE.REPORT, reason: run.stopReason, run: state.summarize(run) };
  }

  const round = run.rounds.length + 1;
  const carried = carriedFindings(run);

  switch (run.phase) {
    case PHASE.GOD_BUILD: {
      const plan = god.planBuild({ task: run.task, findings: carried, round });
      return {
        action: PHASE.GOD_BUILD,
        round,
        stages: plan.stages,
        // Round 1 builds; later rounds are fixing what EVIL proved.
        intent: round === 1 ? 'build' : 'fix',
        carriedFindings: carried.length,
        estimatedTokens: plan.estimatedTokens,
      };
    }

    case PHASE.EVIL_HUNT: {
      const plan = evil.planSweep({
        scope: run.scope,
        flags: run.flags,
        round,
        knownFindingIds: run.seenFindingIds,
      });
      return {
        action: PHASE.EVIL_HUNT,
        round,
        crew: plan.crew,
        briefs: plan.briefs,
        estimatedTokens: plan.estimatedTokens,
      };
    }

    case PHASE.EVIL_VERIFY: {
      const targets = evil.selectForVerification(run.pending.findings);
      return {
        action: PHASE.EVIL_VERIFY,
        round,
        targets: targets.map(f => ({ id: f.id, title: f.title, brief: evil.verifyBrief(f) })),
        // Verification is cheap per finding but must stay bounded.
        estimatedTokens: targets.length * 3000,
      };
    }

    case PHASE.ROUND_CLOSE:
    default:
      return { action: PHASE.ROUND_CLOSE, round };
  }
}

// Findings GOD still has to answer for: open, real, high-signal, worst first.
function carriedFindings(run) {
  const last = run.rounds[run.rounds.length - 1];
  if (!last) return [];
  return evil.actionable(last.findings).slice(0, 10);
}

// ── Recording each phase ─────────────────────────────────────────────────────

function submitGodWork(run, { artifacts = [], addressedIds = [], tokensSpent = 0, elapsedMs = 0 } = {}) {
  requirePhase(run, PHASE.GOD_BUILD);
  run.pending.artifacts = artifacts;
  run.pending.addressedIds = addressedIds;
  run.spent.tokens += Math.max(0, Number(tokensSpent) || 0);
  run.spent.ms += Math.max(0, Number(elapsedMs) || 0);
  run.phase = PHASE.EVIL_HUNT;
  state.save(run);
  return run;
}

function submitEvilHunt(run, { findings = [], tokensSpent = 0, elapsedMs = 0 } = {}) {
  requirePhase(run, PHASE.EVIL_HUNT);
  run.pending.findings = dedupe(findings);
  run.spent.tokens += Math.max(0, Number(tokensSpent) || 0);
  run.spent.ms += Math.max(0, Number(elapsedMs) || 0);
  run.phase = PHASE.EVIL_VERIFY;
  state.save(run);
  return run;
}

function submitVerdicts(run, { verdicts = {}, tokensSpent = 0, elapsedMs = 0 } = {}) {
  requirePhase(run, PHASE.EVIL_VERIFY);
  run.pending.findings = evil.applyVerdicts(run.pending.findings, verdicts);
  run.spent.tokens += Math.max(0, Number(tokensSpent) || 0);
  run.spent.ms += Math.max(0, Number(elapsedMs) || 0);
  run.phase = PHASE.ROUND_CLOSE;
  state.save(run);
  return run;
}

// Close the round: grade GOD's work, record the verdict, decide whether to
// run another round. state.recordRound() owns convergence + hard stops.
function closeRound(run) {
  requirePhase(run, PHASE.ROUND_CLOSE);

  const completion = god.roundComplete({
    artifacts: run.pending.artifacts,
    findings: run.pending.findings,
    addressedIds: run.pending.addressedIds,
  });

  const verdict = state.recordRound(run, {
    findings: run.pending.findings,
    artifacts: run.pending.artifacts,
    tokensSpent: 0,   // already accrued per-phase; do not double count
    elapsedMs: 0,
  });

  // Attach whether GOD actually finished its side of the round.
  verdict.godComplete = completion.complete;
  verdict.unverifiedArtifacts = completion.unverifiedArtifacts;
  verdict.outstandingFindings = completion.outstandingFindings;
  run.rounds[run.rounds.length - 1] = verdict;

  run.pending = { artifacts: [], findings: [], addressedIds: [] };
  run.phase = run.status === 'running' ? PHASE.GOD_BUILD : PHASE.REPORT;
  state.save(run);
  return verdict;
}

function requirePhase(run, expected) {
  if (run.phase !== expected) {
    throw new Error(`arena: expected phase "${expected}" but run is in "${run.phase}"`);
  }
}

// ── Budget guard ─────────────────────────────────────────────────────────────
// Called before dispatching an action. The arena aborts cleanly rather than
// overspending — a partial result you can read beats a surprise bill.

function affordOrAbort(run, action) {
  const est = action.estimatedTokens || 0;
  const check = state.canAffordRound(run, est);
  if (check.ok) return { ok: true, ...check };
  run.status = 'aborted';
  run.stopReason = `budget guard: next step needs ~${est.toLocaleString()} tokens, only ${check.remaining.toLocaleString()} left`;
  run.phase = PHASE.REPORT;
  state.save(run);
  return { ok: false, ...check };
}

// ── Report ───────────────────────────────────────────────────────────────────

function buildReport(run) {
  const s = state.summarize(run);
  const lines = [];

  lines.push(`# Arena report — ${s.task}`, '');
  lines.push(`- **Run:** \`${s.runId}\``);
  lines.push(`- **Status:** ${s.status}${s.stopReason ? ` — ${s.stopReason}` : ''}`);
  lines.push(`- **Rounds:** ${s.rounds}`);
  lines.push(`- **Tokens:** ${s.tokensSpent.toLocaleString()}`);
  lines.push('');

  // The curve that matters: new findings per round should fall to zero.
  lines.push('## Did the attacker give up?', '');
  if (s.trend.length) {
    const max = Math.max(...s.trend, 1);
    for (let i = 0; i < s.trend.length; i++) {
      const n = s.trend[i];
      const bar = '█'.repeat(Math.round((n / max) * 24)) || '·';
      lines.push(`round ${i + 1}  ${String(n).padStart(3)} new  ${bar}`);
    }
    lines.push('');
    lines.push(s.status === 'converged'
      ? '**Converged** — two consecutive rounds surfaced nothing new.'
      : `**Not converged** (${s.stopReason || 'still running'}). Remaining risk is unproven, not absent.`);
  } else {
    lines.push('_No rounds completed._');
  }
  lines.push('');

  // Per-round detail
  lines.push('## Rounds', '');
  for (const r of run.rounds) {
    const verified = (r.artifacts || []).filter(a => a.verified).length;
    lines.push(`### Round ${r.round}`);
    lines.push(`- GOD: ${(r.artifacts || []).length} artifact(s), ${verified} verified` +
      (r.godComplete === false ? ' — **round incomplete**' : ''));
    if (r.unverifiedArtifacts?.length) {
      lines.push(`  - unverified: ${r.unverifiedArtifacts.join(', ')}`);
    }
    if (r.outstandingFindings?.length) {
      lines.push(`  - not addressed: ${r.outstandingFindings.join(', ')}`);
    }
    lines.push(`- EVIL: ${r.counts.total} finding(s) — ${r.counts.new} new, ${r.counts.confirmed} confirmed, ${r.counts.refuted} refuted`);
    lines.push(`- Open risk after round: ${r.openRisk}`);
    lines.push('');
  }

  // What is still standing
  const last = run.rounds[run.rounds.length - 1];
  const open = last ? evil.actionable(last.findings, { minRisk: 0 }) : [];
  lines.push('## Still open', '');
  if (!open.length) {
    lines.push('_Nothing open. Every finding was either fixed or refuted._');
  } else {
    for (const f of open) {
      lines.push(`- **[${effectiveRisk(f)}] ${f.title}** — ${f.severity}/${f.confidence}` +
        (f.file ? ` · \`${f.file}:${f.line ?? '?'}\`` : ''));
      if (f.repro) lines.push(`  - repro: ${String(f.repro).split('\n')[0].slice(0, 160)}`);
      if (f.fix) lines.push(`  - fix: ${String(f.fix).split('\n')[0].slice(0, 160)}`);
    }
  }
  lines.push('');

  // Refuted — kept visible so the same false positive isn't re-litigated.
  const refuted = last ? last.findings.filter(f => f.verdict === VERDICT.REFUTED) : [];
  if (refuted.length) {
    lines.push('## Refuted (checked, not real)', '');
    for (const f of refuted) lines.push(`- ~~${f.title}~~`);
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = {
  PHASE,
  startArena, nextAction, carriedFindings,
  submitGodWork, submitEvilHunt, submitVerdicts, closeRound,
  affordOrAbort, buildReport,
};
