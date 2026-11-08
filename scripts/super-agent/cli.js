// scripts/super-agent/cli.js
//
// The driver surface for the super-agent orchestrator. Like the Arena CLI, this
// does NOT run agents itself — it advances a tokenless state machine and tells
// the driving LLM what to do next. The loop is:
//
//   super-agent start --goal "..."        → create a run, print the next action
//   super-agent next <id>                 → print the next action (JSON)
//   super-agent plan <id> --file p.json   → install the decomposed step DAG
//   super-agent step <id> <step> --status done|failed [--branch b] [--tokens n]
//   super-agent integrate <id> [--conflicts a,b] [--tokens n]
//   super-agent verify <id> --passed|--failed [--detail "..."]
//   super-agent status <id> | list
//
// The LLM performs each action with the existing primitives (blueprint to
// decompose, the swarm to dispatch, the GAN loop to evaluate, git to integrate)
// and reports back through the submit commands.
'use strict';

const fs = require('fs');
const state = require('./state.js');
const orch = require('./orchestrator.js');

function parse(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { flags[key] = next; i++; }
      else flags[key] = true;
    } else positional.push(a);
  }
  return { positional, flags };
}

const out = (o) => process.stdout.write(JSON.stringify(o, null, 2) + '\n');
const err = (m) => { process.stderr.write(`super-agent: ${m}\n`); process.exit(2); };

function loadOr(id) {
  if (!id) err('a run id is required');
  if (!state.exists(id)) err(`no run ${id}`);
  return state.load(id);
}

function main(argv) {
  const { positional, flags } = parse(argv);
  const cmd = positional[0];

  switch (cmd) {
    case 'start': {
      const goal = flags.goal || positional.slice(1).join(' ');
      if (!goal) err('usage: super-agent start --goal "<objective>" [--token-cap N] [--step-cap N] [--scope .]');
      const run = state.createRun({
        goal,
        scope: flags.scope || '.',
        limits: { tokenCap: Number(flags['token-cap']) || 0, stepCap: Number(flags['step-cap']) || 0 },
      });
      state.save(run);
      out({ runId: run.id, next: orch.nextAction(run) });
      return;
    }
    case 'next': {
      out(orch.nextAction(loadOr(positional[1])));
      return;
    }
    case 'plan': {
      const run = loadOr(positional[1]);
      if (!flags.file) err('usage: super-agent plan <id> --file <plan.json>  (JSON array of { id, description, deps, exitCriteria })');
      let steps;
      try { steps = JSON.parse(fs.readFileSync(flags.file, 'utf8')); }
      catch (e) { err(`cannot read plan: ${e.message}`); }
      orch.submitPlan(run, steps);
      out({ ok: true, next: orch.nextAction(run) });
      return;
    }
    case 'dispatch': {
      // Mark the given steps in-progress (optional bookkeeping before running them).
      const run = loadOr(positional[1]);
      const ids = (flags.steps ? String(flags.steps).split(',') : positional.slice(2)).filter(Boolean);
      orch.markDispatched(run, ids);
      out({ ok: true, inProgress: ids });
      return;
    }
    case 'step': {
      const run = loadOr(positional[1]);
      const stepId = positional[2];
      if (!stepId) err('usage: super-agent step <id> <stepId> --status done|failed [--branch b] [--tokens n]');
      orch.submitStepResult(run, stepId, {
        status: flags.status === 'failed' ? 'failed' : 'done',
        branch: flags.branch || null,
        result: flags.result || null,
        tokensSpent: Number(flags.tokens) || 0,
      });
      out({ ok: true, next: orch.nextAction(run) });
      return;
    }
    case 'integrate': {
      const run = loadOr(positional[1]);
      const conflicts = flags.conflicts ? String(flags.conflicts).split(',').filter(Boolean) : [];
      orch.submitIntegration(run, {
        merged: conflicts.length === 0 && flags.merged !== false,
        conflicts,
        tokensSpent: Number(flags.tokens) || 0,
      });
      out({ ok: true, next: orch.nextAction(run) });
      return;
    }
    case 'verify': {
      const run = loadOr(positional[1]);
      if (!flags.passed && !flags.failed) err('usage: super-agent verify <id> --passed | --failed [--detail "..."]');
      orch.submitVerification(run, {
        passed: !!flags.passed && !flags.failed,
        detail: typeof flags.detail === 'string' ? flags.detail : '',
        tokensSpent: Number(flags.tokens) || 0,
      });
      out({ ok: true, next: orch.nextAction(run) });
      return;
    }
    case 'status': {
      out(state.summarize(loadOr(positional[1])));
      return;
    }
    case 'list': {
      out(state.list().map(state.summarize));
      return;
    }
    default:
      err('commands: start | next | plan | dispatch | step | integrate | verify | status | list');
  }
}

module.exports = { main, parse };
