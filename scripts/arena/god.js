// scripts/arena/god.js
// GOD mode — the constructive half of the arena.
//
// This is deliberately NOT "fire nine agents at once" — /project-launch already
// does that. GOD mode is a pipeline with three properties the parallel commands
// do not have:
//
//   1. It RECALLS before it builds       — past solutions inform the design
//   2. It must emit VERIFIABLE artifacts — a claim is not a result; a passing
//                                          command is
//   3. It SELF-CRITIQUES before shipping — it attacks its own work before EVIL
//                                          gets the chance
//
// In arena mode it additionally consumes EVIL's verified findings and must
// address them before the round can close.

'use strict';

const { makeArtifact } = require('./contract');

// ── The pipeline ─────────────────────────────────────────────────────────────
// Stages run in order. Each names the specialists it draws on; the orchestrator
// dispatches them (in parallel where the stage allows it).

const STAGES = [
  {
    id: 'recall',
    label: 'Recall',
    parallel: false,
    agents: [],                       // no agent — this is a memory lookup
    goal: 'Find what we already know about this problem before designing anything new.',
  },
  {
    id: 'design',
    label: 'Design',
    parallel: true,
    agents: ['architect', 'code-architect'],
    goal: 'Produce a concrete blueprint: files, interfaces, data flow, build order.',
  },
  {
    id: 'build',
    label: 'Build',
    parallel: false,
    agents: ['pair-programmer', 'tdd-guide'],
    goal: 'Implement the blueprint test-first. Tests must actually run and pass.',
  },
  {
    id: 'critique',
    label: 'Self-critique',
    parallel: true,
    agents: ['type-design-analyzer', 'api-guardian', 'ux-reviewer'],
    goal: 'Attack our own work: weak types, breaking contracts, unusable flows.',
  },
  {
    id: 'harden',
    label: 'Harden',
    parallel: true,
    agents: ['performance-optimizer', 'refactor-cleaner'],
    goal: 'Remove hot spots and dead weight without changing behaviour.',
  },
  {
    id: 'prove',
    label: 'Prove',
    parallel: false,
    agents: [],                       // no agent — this runs commands
    goal: 'Run the verification commands. Nothing ships unproven.',
  },
];

function stage(id) {
  return STAGES.find(s => s.id === id) || null;
}

// ── Briefs ───────────────────────────────────────────────────────────────────

function recallBrief({ task }) {
  return [
    `Before building anything, search local memory for prior work related to:`,
    `"${task}"`,
    '',
    'Use the memory store (BM25 recall). For each relevant hit, report:',
    '- what the past problem was',
    '- what approach actually worked',
    '- whether it applies here, or why this case differs',
    '',
    'If nothing relevant exists, say so plainly and move on. Do not invent a memory.',
  ].join('\n');
}

function stageBrief({ stageId, task, blueprint = null, findings = [], round = 1 }) {
  const s = stage(stageId);
  if (!s) throw new Error(`god: unknown stage "${stageId}"`);

  const lines = [
    `GOD mode — stage: ${s.label} (round ${round}).`,
    `Task: ${task}`,
    `Goal of this stage: ${s.goal}`,
  ];

  if (blueprint) {
    lines.push('', 'Blueprint from the design stage:', blueprint);
  }

  // Arena mode: EVIL's verified findings are non-negotiable work items.
  if (findings.length) {
    lines.push(
      '',
      `EVIL mode found ${findings.length} verified issue(s) in the last round. These are NOT suggestions — each must be fixed or explicitly justified as accepted risk:`,
      ...findings.map((f, i) =>
        `  ${i + 1}. [${f.severity}/${f.confidence}] ${f.title}` +
        `${f.file ? ` (${f.file}:${f.line ?? '?'})` : ''}` +
        `${f.repro ? `\n     repro: ${String(f.repro).split('\n')[0].slice(0, 160)}` : ''}`),
    );
  }

  lines.push(
    '',
    'Output contract:',
    '- State exactly which files you changed or created.',
    '- Give a `verifyCommand` that PROVES the work (a test run, a build, a benchmark).',
    '- Do not claim success you have not observed. "Should work" is a failure of this stage.',
  );

  if (stageId === 'critique') {
    lines.push(
      '',
      'Be genuinely adversarial about our own output. It is cheaper to find it here than to let EVIL find it next round.',
    );
  }

  return lines.join('\n');
}

// ── Verification ─────────────────────────────────────────────────────────────
// The heart of GOD mode: an artifact only counts as verified when a command
// actually ran and exited clean. `runner` is injected so this stays testable
// and so callers control what is allowed to execute.

function verifyArtifacts(artifacts = [], runner) {
  if (typeof runner !== 'function') {
    throw new Error('god: verifyArtifacts requires a runner(command) -> {ok, output}');
  }
  return artifacts.map(a => {
    const art = makeArtifact(a);
    if (!art.verifyCommand) {
      return { ...art, verified: false, verifyResult: 'no verify command supplied' };
    }
    let result;
    try {
      result = runner(art.verifyCommand);
    } catch (err) {
      return { ...art, verified: false, verifyResult: `runner threw: ${err.message}` };
    }
    const ok = !!(result && result.ok);
    return {
      ...art,
      verified: ok,
      verifyResult: ok
        ? 'passed'
        : `failed: ${String((result && result.output) || 'no output').slice(0, 300)}`,
    };
  });
}

// A round only closes when every artifact proved itself AND every high-risk
// finding was addressed. This is what stops "I fixed it" from being enough.
function roundComplete({ artifacts = [], findings = [], addressedIds = [] } = {}) {
  const unverified = artifacts.filter(a => !a.verified);
  const addressed = new Set(addressedIds);
  const mustFix = findings.filter(f =>
    f.verdict !== 'refuted' && (f.severity === 'critical' || f.severity === 'high'));
  const outstanding = mustFix.filter(f => !addressed.has(f.id));

  return {
    complete: unverified.length === 0 && outstanding.length === 0,
    unverifiedArtifacts: unverified.map(a => a.summary || a.kind),
    outstandingFindings: outstanding.map(f => f.title),
  };
}

// ── Plan ─────────────────────────────────────────────────────────────────────

function planBuild({ task, findings = [], round = 1, skipStages = [] } = {}) {
  if (!task || !String(task).trim()) throw new Error('god: task is required');
  const active = STAGES.filter(s => !skipStages.includes(s.id));
  return {
    round,
    task,
    stages: active.map(s => ({
      id: s.id,
      label: s.label,
      parallel: s.parallel,
      agents: s.agents,
      brief: s.id === 'recall'
        ? recallBrief({ task })
        : stageBrief({ stageId: s.id, task, findings, round }),
    })),
    // Only agent stages cost tokens; recall and prove are local operations.
    estimatedTokens: active.reduce((n, s) => n + s.agents.length * 10000, 0),
  };
}

module.exports = {
  STAGES, stage,
  recallBrief, stageBrief,
  verifyArtifacts, roundComplete,
  planBuild,
};
