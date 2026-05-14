// =============================================================================
// Kodelyth ECC — Swarm Plan Builder (Phase 2.7)
//
// Promotes the existing `tmux-worktree-orchestrator` infrastructure to a first-
// class CLI surface. Takes simple flags (--task, --agents N, --harness <h>, ...)
// and produces a full plan compatible with scripts/lib/tmux-worktree-orchestrator.js.
//
// Pure-function builder. Zero side effects. Tested without spawning tmux/git.
//
// Two modes:
//   1. Generic swarm: N agents work in parallel on the SAME task in isolated
//      worktrees, then their handoff files are merged for review.
//   2. Specialist swarm: a list of named ECC agents (architect, code-reviewer,
//      security-reviewer, …) each run with an agent-shaped prompt over the
//      same task. The swarm IS a generalized /devil-mode.
// =============================================================================

'use strict';

const path = require('path');

// ── Smart-default specialist rotations (4 / 6 / 8 agents) ────────────────────
// Picked for breadth — code, security, architecture, test, perf, UX, API, docs.
const DEFAULT_ROTATIONS = {
  4: ['code-reviewer', 'security-reviewer', 'pair-programmer', 'tdd-guide'],
  6: ['code-reviewer', 'security-reviewer', 'pair-programmer', 'tdd-guide', 'performance-optimizer', 'api-guardian'],
  8: ['code-reviewer', 'security-reviewer', 'pair-programmer', 'tdd-guide', 'performance-optimizer', 'api-guardian', 'ux-reviewer', 'doc-updater'],
};

// ── Task-keyword signal weights for smart agent rotation ─────────────────────
const SIGNAL_AGENTS = [
  { regex: /\b(security|auth|vuln|cve|secrets?|injection|owasp)\b/i, agent: 'security-reviewer' },
  { regex: /\b(perf(?:ormance)?|slow|p99|latency|throughput|bottleneck)\b/i, agent: 'performance-optimizer' },
  { regex: /\b(load[\s-]?test|stress[\s-]?test|capacity|k6|locust|artillery)\b/i, agent: 'load-tester' },
  { regex: /\b(architect|design|adr|rfc|trade[\s-]?off|system\s+design)\b/i, agent: 'architect' },
  { regex: /\b(api|endpoint|contract|breaking\s+change|rest|graphql)\b/i, agent: 'api-guardian' },
  { regex: /\b(test|tdd|coverage|spec|unit\s+test)\b/i, agent: 'tdd-guide' },
  { regex: /\b(refactor|cleanup|tech\s+debt|code\s+smell|simplify)\b/i, agent: 'refactor-cleaner' },
  { regex: /\b(ux|accessibility|wcag|a11y|usability|ui)\b/i, agent: 'ux-reviewer' },
  { regex: /\b(doc(?:s|umentation)?|readme|guide|tutorial|comment)\b/i, agent: 'doc-updater' },
  { regex: /\b(release|ship|tag|semver|rollback)\b/i, agent: 'release-captain' },
  { regex: /\b(incident|outage|down|p[01]|sev[12]|on[\s-]?call)\b/i, agent: 'incident-commander' },
  { regex: /\b(debug|why\s+is|stack\s+trace|silent\s+fail)\b/i, agent: 'debug-detective' },
  { regex: /\b(database|sql|postgres|mysql|index|n\+1)\b/i, agent: 'database-reviewer' },
  { regex: /\b(devil[\s-]?mode|adversarial|red[\s-]?team)\b/i, agent: 'prompt-injection-hunter' },
];

// Always-included anchors when count >= N.
const BASELINE_ANCHORS = ['code-reviewer', 'pair-programmer'];

// ── Harness launcher templates ───────────────────────────────────────────────
// Placeholders: {worker_name} {worker_slug} {repo_root} {worktree_path}
//               {branch_name} {task_file} {handoff_file} {status_file}
//               {session_name}
const HARNESS_LAUNCHERS = {
  claude:   'claude --print --dangerously-skip-permissions "$(cat {task_file_sh})" 2>&1 | tee -a {handoff_file_sh}; printf "\\nstate: completed\\n" >> {status_file_sh}',
  codex:    `bash {repo_root_sh}/scripts/orchestrate-codex-worker.sh {task_file_sh} {handoff_file_sh} {status_file_sh}`,
  opencode: 'opencode run --task-file {task_file_sh} --output {handoff_file_sh} --status {status_file_sh}',
  windsurf: 'windsurf-cli run --task-file {task_file_sh} --output {handoff_file_sh}',
  echo:     `printf 'demo worker {worker_slug}\\n' >> {handoff_file_sh}; printf 'state: completed\\n' >> {status_file_sh}`,
};

// ── Core: pick agents for a swarm of size N ──────────────────────────────────
function pickAgents({ count, task, explicit }) {
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit.map(String);
  }
  const n = Math.max(1, Math.min(Number(count) || 4, 12));
  const text = String(task || '');
  const picked = new Set();

  // 1. Signal-driven picks first (highest priority).
  for (const { regex, agent } of SIGNAL_AGENTS) {
    if (regex.test(text)) picked.add(agent);
    if (picked.size >= n) break;
  }

  // 2. Baseline anchors next.
  for (const anchor of BASELINE_ANCHORS) {
    if (picked.size >= n) break;
    picked.add(anchor);
  }

  // 3. Fill from rotation if we still need more.
  const rotationKey = n <= 4 ? 4 : (n <= 6 ? 6 : 8);
  for (const a of DEFAULT_ROTATIONS[rotationKey]) {
    if (picked.size >= n) break;
    picked.add(a);
  }

  // 4. Fallback fill (shouldn't normally hit).
  const fallback = DEFAULT_ROTATIONS[8];
  for (const a of fallback) {
    if (picked.size >= n) break;
    picked.add(a);
  }

  return [...picked].slice(0, n);
}

// ── Core: build a worker plan-config for a single agent ──────────────────────
function buildWorker({ agent, task, harness, launcherCommand }) {
  const launcher = launcherCommand || HARNESS_LAUNCHERS[harness];
  if (!launcher) {
    throw new Error(`No launcher template for harness "${harness}". Pass --launcher-cmd or use one of: ${Object.keys(HARNESS_LAUNCHERS).join(', ')}.`);
  }
  return {
    name: agent,
    task: shapeTaskForAgent(agent, task),
    launcherCommand: launcher,
  };
}

function shapeTaskForAgent(agent, task) {
  return [
    `# ${agent} — swarm task`,
    '',
    `You are running as the ECC \`${agent}\` specialist in a parallel swarm. ` +
    'Other agents are running the same shared task in sibling worktrees. ' +
    'Stay strictly inside your specialty — do not duplicate what other agents will cover. ' +
    'Produce a focused handoff that names exactly which findings are yours and yours alone.',
    '',
    '## Shared Task',
    '',
    String(task || '').trim() || '(no task description provided)',
    '',
    '## Required handoff sections',
    '1. Summary',
    '2. Files Changed',
    '3. Validation',
    '4. Remaining Risks',
  ].join('\n');
}

// ── Public API: full plan ────────────────────────────────────────────────────
function buildSwarmPlan({
  task,
  agents,
  count       = 4,
  harness     = 'claude',
  launcherCmd,
  sessionName,
  repoRoot    = process.cwd(),
  worktreeRoot,
  coordinationRoot,
  baseRef     = 'HEAD',
  seedPaths   = [],
  replaceExisting = false,
} = {}) {
  if (!task || typeof task !== 'string' || task.trim().length === 0) {
    throw new Error('buildSwarmPlan: --task is required');
  }
  const explicit = Array.isArray(agents) ? agents : null;
  const picked = pickAgents({ count, task, explicit });

  const session = sessionName || `swarm-${new Date().toISOString().slice(0,10)}-${picked.length}a`;

  const workers = picked.map(agent => buildWorker({
    agent,
    task,
    harness,
    launcherCommand: launcherCmd,
  }));

  return {
    sessionName: session,
    repoRoot,
    worktreeRoot,
    coordinationRoot,
    baseRef,
    replaceExisting: !!replaceExisting,
    seedPaths,
    workers,
    // For debugging / dashboards:
    _meta: {
      task,
      harness,
      pickedAgents: picked,
      count: picked.length,
    },
  };
}

module.exports = {
  HARNESS_LAUNCHERS,
  DEFAULT_ROTATIONS,
  BASELINE_ANCHORS,
  SIGNAL_AGENTS,
  pickAgents,
  shapeTaskForAgent,
  buildWorker,
  buildSwarmPlan,
};
