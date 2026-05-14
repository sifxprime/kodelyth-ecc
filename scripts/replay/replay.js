// =============================================================================
// Kodelyth ECC — Session Replay Engine (Phase 2.8)
//
// Takes a bundle (or a live coordination dir) and reconstructs a swarm plan-
// config that re-runs the same task. Supports replay variations:
//
//   - Different harness  (--harness codex)         — model A/B test
//   - Different agents   (--agents new1,new2)      — agent A/B test
//   - Different baseRef  (--base-ref main)         — re-test against new code
//   - Different model via cost router env vars     — model A/B test
//
// Pure planning. The actual execution is delegated to the existing
// orchestrator (scripts/lib/tmux-worktree-orchestrator.js).
// =============================================================================

'use strict';

const path = require('path');

const { buildSwarmPlan } = require('../swarm/build-plan.js');
const { nextReplayName } = require('./bundle.js');

// ── Extract a replay-able task from a bundle ─────────────────────────────────
function extractTaskFromBundle(bundle) {
  // Prefer explicit meta.task (set when exporting from a swarm).
  if (bundle.meta && typeof bundle.meta.task === 'string' && bundle.meta.task.trim()) {
    return bundle.meta.task.trim();
  }
  // Fallback: read the FIRST worker's task.md and strip the agent-shaped header
  // we added in scripts/swarm/build-plan.js (shapeTaskForAgent).
  const first = bundle.workers && bundle.workers[0];
  if (first && typeof first.task === 'string') {
    return extractSharedTaskFromShapedPrompt(first.task);
  }
  throw new Error('replay: cannot extract task — bundle has no meta.task and no worker tasks');
}

function extractSharedTaskFromShapedPrompt(prompt) {
  // The shaped format is:
  //   # <agent> — swarm task
  //   ...
  //   ## Shared Task
  //
  //   <THE TASK>
  //
  //   ## Required handoff sections
  //   ...
  const m = prompt.match(/##\s*Shared Task\s*\n([\s\S]*?)\n##\s*Required handoff sections/);
  if (m) return m[1].trim();
  // Tmux orchestrator's own task.md has "## Objective\n<task>\n## Completion".
  const m2 = prompt.match(/##\s*Objective\s*\n([\s\S]*?)\n##\s*Completion/);
  if (m2) return m2[1].trim();
  // Last-resort: return the whole prompt.
  return prompt.trim();
}

// ── Build a replay plan-config ───────────────────────────────────────────────
function buildReplayPlanConfig(bundle, opts = {}) {
  const {
    repoRoot         = process.cwd(),
    coordinationRoot,
    worktreeRoot,
    baseRef,
    harness,
    agents,                 // array | null — overrides bundle's agent list
    sessionName,            // explicit override; otherwise auto next-replay-N
    takenSessions = new Set(),
    replaceExisting = false,
    seedPaths = [],
    launcherCmd,
  } = opts;

  const task = extractTaskFromBundle(bundle);

  // Resolve which agents to run.
  let agentList;
  if (Array.isArray(agents) && agents.length > 0) {
    agentList = agents.slice();
  } else if (bundle.meta && Array.isArray(bundle.meta.agents) && bundle.meta.agents.length > 0) {
    agentList = bundle.meta.agents.slice();
  } else {
    agentList = bundle.workers.map(w => w.slug);
  }

  // Resolve session name.
  const session = sessionName || nextReplayName(bundle.session, takenSessions);

  return buildSwarmPlan({
    task,
    agents:           agentList,
    harness:          harness          || (bundle.meta && bundle.meta.harness)  || 'claude',
    launcherCmd,
    sessionName:      session,
    repoRoot,
    worktreeRoot,
    coordinationRoot,
    baseRef:          baseRef          || (bundle.meta && bundle.meta.base_ref) || 'HEAD',
    seedPaths,
    replaceExisting,
  });
}

module.exports = {
  extractTaskFromBundle,
  extractSharedTaskFromShapedPrompt,
  buildReplayPlanConfig,
};
