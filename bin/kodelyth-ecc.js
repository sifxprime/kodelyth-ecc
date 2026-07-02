#!/usr/bin/env node
// Kodelyth ECC — npx entry point
// Usage (from npm — recommended):
//   npx kodelyth-ecc                            # Claude Code (default)
//   npx kodelyth-ecc --target windsurf-project  # Windsurf (project)
//   npx kodelyth-ecc --target windsurf-home     # Windsurf (global)
//   npx kodelyth-ecc --target antigravity       # Google Antigravity
//   npx kodelyth-ecc --target cursor-project    # Cursor IDE
//   npx kodelyth-ecc --target codex-home        # Codex CLI
//   npx kodelyth-ecc --target opencode          # OpenCode
//
// Usage (from GitHub — latest commit):
//   npx github:sifxprime/kodelyth-ecc

'use strict';

const { spawnSync } = require('child_process');
const path          = require('path');
const fs            = require('fs');
const os            = require('os');

const ROOT    = path.join(__dirname, '..');
// zsh (unlike bash) passes inline comments as literal args — strip them
const args    = process.argv.slice(2).filter((a, i, arr) => {
  if (a.startsWith('#')) return false;          // drop # and everything after
  const prev = arr.slice(0, i).findIndex(x => x.startsWith('#'));
  return prev === -1;
});
const isWin   = os.platform() === 'win32';

// ── Subcommand: mcp (start MCP server over stdio) ────────────────────────────
// Usage: npx kodelyth-ecc mcp
// Exposes 70 agents, 194 skills, 97 commands, the routing rule, and the local
// memory store to any MCP-compatible client (Claude Desktop, LangGraph, etc.).
if (args[0] === 'mcp') {
  // Hand off entirely to the MCP server — it owns stdio from here on.
  require(path.join(ROOT, 'scripts', 'mcp', 'server.js')).main()
    .catch(err => {
      process.stderr.write(`[kodelyth-mcp] fatal: ${err.stack || err.message}\n`);
      process.exit(1);
    });
  return;
}

// ── Subcommand: mcp-* (consume external MCP servers) ──────────────────────────
// Usage:
//   kodelyth-ecc mcp-add <name> -- <command> [args...]
//   kodelyth-ecc mcp-add github -- npx -y @modelcontextprotocol/server-github
//   kodelyth-ecc mcp-add postgres --env DB_URL=... -- npx -y @modelcontextprotocol/server-postgres
//   kodelyth-ecc mcp-list
//   kodelyth-ecc mcp-remove <name>
//   kodelyth-ecc mcp-tools <name>
//   kodelyth-ecc mcp-call <name> <tool> [--json '{"arg":"value"}']
if (args[0] && args[0].startsWith('mcp-')) {
  (async () => {
    const sub = args[0].slice(4);
    const client = require(path.join(ROOT, 'scripts', 'mcp', 'client.js'));
    const rest = args.slice(1);

    function findSeparator(arr) {
      const i = arr.indexOf('--');
      return i;
    }

    try {
      if (sub === 'list') {
        const servers = client.listServers();
        if (servers.length === 0) {
          console.log('No MCP servers registered. Use `kodelyth-ecc mcp-add <name> -- <command> [args...]` to add one.');
          return;
        }
        for (const s of servers) {
          const argList = s.args && s.args.length ? ' ' + s.args.join(' ') : '';
          const envKeys = Object.keys(s.env || {}).join(', ');
          console.log(`• ${s.name}`);
          console.log(`    cmd:  ${s.command}${argList}`);
          if (envKeys)        console.log(`    env:  ${envKeys}`);
          if (s.description)  console.log(`    desc: ${s.description}`);
          console.log(`    added: ${s.added_at}`);
        }
        return;
      }

      if (sub === 'add') {
        // Parse: <name> [--env KEY=VAL]* [--desc "..."] -- <command> [args...]
        const sepIdx = findSeparator(rest);
        if (sepIdx < 0) throw new Error('mcp-add requires `--` before the command. Example: kodelyth-ecc mcp-add github -- npx -y @modelcontextprotocol/server-github');
        const head = rest.slice(0, sepIdx);
        const tail = rest.slice(sepIdx + 1);
        if (head.length === 0) throw new Error('mcp-add: missing <name>');
        if (tail.length === 0) throw new Error('mcp-add: missing command after `--`');

        const name = head[0];
        const env = {};
        let description = '';
        for (let i = 1; i < head.length; i++) {
          const a = head[i];
          if (a === '--env')       { const kv = head[++i] || ''; const eq = kv.indexOf('='); if (eq > 0) env[kv.slice(0, eq)] = kv.slice(eq + 1); continue; }
          if (a === '--desc' || a === '--description') { description = head[++i] || ''; continue; }
        }
        const command = tail[0];
        const argv    = tail.slice(1);

        const spec = client.addServer({ name, command, args: argv, env, description });
        console.log(`✓ registered "${spec.name}" (cmd: ${spec.command} ${spec.args.join(' ')})`);
        console.log(`  Try: kodelyth-ecc mcp-tools ${spec.name}`);
        return;
      }

      if (sub === 'remove' || sub === 'rm') {
        if (rest.length === 0) throw new Error('mcp-remove: missing <name>');
        const ok = client.removeServer(rest[0]);
        console.log(ok ? `✓ removed "${rest[0]}"` : `✗ "${rest[0]}" was not registered`);
        process.exit(ok ? 0 : 1);
      }

      if (sub === 'tools') {
        if (rest.length === 0) throw new Error('mcp-tools: missing <name>');
        const out = await client.listTools(rest[0]);
        console.log(`tools on "${rest[0]}" (${out.tools.length}):`);
        for (const t of out.tools) {
          console.log(`  • ${t.name}${t.description ? ' — ' + String(t.description).split('\n')[0].slice(0, 100) : ''}`);
        }
        return;
      }

      if (sub === 'resources') {
        if (rest.length === 0) throw new Error('mcp-resources: missing <name>');
        const out = await client.listResources(rest[0]);
        console.log(`resources on "${rest[0]}" (${out.resources.length}):`);
        for (const r of out.resources.slice(0, 30)) {
          console.log(`  • ${r.uri}`);
        }
        if (out.resources.length > 30) console.log(`  …and ${out.resources.length - 30} more.`);
        return;
      }

      if (sub === 'prompts') {
        if (rest.length === 0) throw new Error('mcp-prompts: missing <name>');
        const out = await client.listPrompts(rest[0]);
        console.log(`prompts on "${rest[0]}" (${out.prompts.length}):`);
        for (const p of out.prompts) {
          console.log(`  • ${p.name}${p.description ? ' — ' + p.description.slice(0, 100) : ''}`);
        }
        return;
      }

      if (sub === 'call') {
        if (rest.length < 2) throw new Error('mcp-call: usage: mcp-call <name> <tool> [--json \'{"arg":"value"}\']');
        const [name, tool, ...flags] = rest;
        let toolArgs = {};
        for (let i = 0; i < flags.length; i++) {
          if (flags[i] === '--json') { toolArgs = JSON.parse(flags[++i] || '{}'); continue; }
        }
        const out = await client.callTool(name, tool, toolArgs);
        for (const c of out.content || []) {
          if (c.type === 'text') process.stdout.write(c.text + '\n');
          else process.stdout.write(JSON.stringify(c) + '\n');
        }
        if (out.isError) process.exit(2);
        return;
      }

      console.error(`unknown subcommand: mcp-${sub}`);
      console.error('Available: mcp-add, mcp-list, mcp-remove, mcp-tools, mcp-resources, mcp-prompts, mcp-call');
      process.exit(1);
    } catch (e) {
      process.stderr.write(`[kodelyth-mcp-client] ${e.message}\n`);
      process.exit(1);
    }
  })();
  return;
}

// ── Subcommand: index (codebase graph) ──────────────────────────────────────
// Usage:
//   npx kodelyth-ecc index                          # index current dir
//   npx kodelyth-ecc index /path/to/repo            # index a specific repo
//   npx kodelyth-ecc index --search <name>          # search graph symbols
//   npx kodelyth-ecc index --arch                   # show architecture summary
//   npx kodelyth-ecc index --callers <name>         # find callers
if (args[0] === 'index') {
  try {
    const indexer = require(path.join(ROOT, 'scripts', 'indexer', 'index.js'));
    const rest = args.slice(1);
    let projectRoot = process.cwd();
    let mode = 'index';
    let queryName = null;
    for (let i = 0; i < rest.length; i++) {
      const a = rest[i];
      if (a === '--search') { mode = 'search'; queryName = rest[++i]; continue; }
      if (a === '--callers') { mode = 'callers'; queryName = rest[++i]; continue; }
      if (a === '--arch' || a === '--architecture') { mode = 'arch'; continue; }
      if (a === '--json') { /* handled below */ continue; }
      if (!a.startsWith('--')) projectRoot = path.resolve(a);
    }
    if (mode === 'index') {
      const result = indexer.indexRepo(projectRoot);
      const s = result.stats;
      console.log(`Kodelyth ECC — indexed ${projectRoot}`);
      console.log(`  files:  ${s.files_indexed} indexed (${s.files_changed} re-parsed, ${s.files_unchanged} cached)`);
      console.log(`  graph:  ${s.nodes_total} nodes, ${s.edges_total} edges`);
      console.log(`  time:   ${s.duration_ms}ms`);
      console.log(`  wrote:  ${projectRoot}/.kodelythecc/graph.json`);
      return;
    }
    if (mode === 'search') {
      const results = indexer.searchGraph(projectRoot, { name: queryName });
      console.log(JSON.stringify(results.slice(0, 20), null, 2));
      return;
    }
    if (mode === 'callers') {
      const results = indexer.callersOf(projectRoot, queryName);
      console.log(JSON.stringify(results.slice(0, 20), null, 2));
      return;
    }
    if (mode === 'arch') {
      console.log(JSON.stringify(indexer.architecture(projectRoot), null, 2));
      return;
    }
  } catch (err) {
    process.stderr.write(`kodelyth-ecc index: ${err.stack || err.message}\n`);
    process.exit(1);
  }
  return;
}

// ── Subcommand: route (cost-aware model tier recommendation) ──────────────────
// Usage: npx kodelyth-ecc route "<task description>" [--files N] [--agent <name>] [--current <model-id>]
if (args[0] === 'route') {
  const router = require(path.join(ROOT, 'scripts', 'router', 'classify.js'));

  // Parse flags out of args[1..].
  const rest  = args.slice(1);
  const opts  = { project_root: process.cwd() };
  const taskParts = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--files' || a === '--file-count') { opts.file_count = Number(rest[++i]); continue; }
    if (a === '--agent')                          { opts.active_agent = rest[++i]; continue; }
    if (a === '--current' || a === '--model')     { opts.current_model = rest[++i]; continue; }
    if (a === '--budget')                         { opts.budget_tokens = Number(rest[++i]); continue; }
    if (a === '--used')                           { opts.session_tokens = Number(rest[++i]); continue; }
    if (a === '--json')                           { opts.json = true; continue; }
    taskParts.push(a);
  }
  const task = taskParts.join(' ').trim();
  if (!task) {
    console.error('usage: kodelyth-ecc route "<task description>" [--files N] [--agent <name>] [--current <model>] [--json]');
    process.exit(1);
  }

  const r = router.recommend(task, opts);
  if (opts.json) {
    console.log(JSON.stringify(r, null, 2));
    return;
  }
  if (r.disabled) {
    console.log('[model-router] disabled (KODELYTH_ROUTER=off).');
    return;
  }
  const status = r.mismatched ? `· current=${r.current_model} (mismatched)` : '';
  console.log(`[model-router] task=${r.tier} · suggested=${r.recommended_model} ${status}`.trim());
  console.log(`  why: ${r.reasons.slice(0, 3).join(' · ')}`);
  if (r.notes) console.log(`  notes: ${r.notes}`);
  console.log(`  next: configure your client to use "${r.recommended_model}" for this turn.`);
  return;
}

// ── Subcommand: swarm (parallel agent execution in tmux + git worktrees) ──────
// Usage:
//   kodelyth-ecc swarm --task "audit oauth flow" --agents 4
//   kodelyth-ecc swarm --task "..." --agents code-reviewer,security-reviewer,architect --execute
//   kodelyth-ecc swarm --plan plan.json --execute
//   kodelyth-ecc swarm --task "..." --agents 6 --harness codex --replace --execute
if (args[0] === 'swarm') {
  (async () => {
    const builder      = require(path.join(ROOT, 'scripts', 'swarm', 'build-plan.js'));
    const orchestrator = require(path.join(ROOT, 'scripts', 'lib', 'tmux-worktree-orchestrator.js'));
    const fs           = require('fs');

    const rest = args.slice(1);
    const opts = { repoRoot: process.cwd(), execute: false, dryRun: false, writeOnly: false };

    let task = '';
    let agentsSpec = null;
    let count = 4;

    for (let i = 0; i < rest.length; i++) {
      const a = rest[i];
      if (a === '--task')              { task = rest[++i] || ''; continue; }
      if (a === '--agents')            { agentsSpec = rest[++i] || ''; continue; }
      if (a === '--count')             { count = Number(rest[++i]); continue; }
      if (a === '--harness')           { opts.harness = rest[++i]; continue; }
      if (a === '--launcher-cmd')      { opts.launcherCmd = rest[++i]; continue; }
      if (a === '--session')           { opts.sessionName = rest[++i]; continue; }
      if (a === '--worktree-root')     { opts.worktreeRoot = rest[++i]; continue; }
      if (a === '--coordination-root') { opts.coordinationRoot = rest[++i]; continue; }
      if (a === '--base-ref')          { opts.baseRef = rest[++i]; continue; }
      if (a === '--seed')              { (opts.seedPaths ||= []).push(rest[++i]); continue; }
      if (a === '--replace')           { opts.replaceExisting = true; continue; }
      if (a === '--execute')           { opts.execute = true; continue; }
      if (a === '--write-only')        { opts.writeOnly = true; continue; }
      if (a === '--dry-run')           { opts.dryRun = true; continue; }
      if (a === '--plan')              { opts.planPath = rest[++i]; continue; }
      if (a === '--json')              { opts.json = true; continue; }
      if (a === '--help' || a === '-h') {
        console.log(`
  kodelyth-ecc swarm — parallel agent execution in tmux + git worktrees

  Auto-build a plan from flags (recommended):
    kodelyth-ecc swarm --task "<task>" [--agents N|name1,name2,...] [--harness claude|codex|opencode|windsurf|echo]
                       [--seed path] [--session NAME] [--base-ref REF] [--replace] [--execute|--write-only|--dry-run]

  Use a hand-written plan.json:
    kodelyth-ecc swarm --plan plan.json [--execute|--write-only]

  Examples:
    kodelyth-ecc swarm --task "audit oauth flow" --agents 4
    kodelyth-ecc swarm --task "ship v2.0" --agents release-captain,security-reviewer,e2e-runner --execute
    kodelyth-ecc swarm --task "scale API to 100k req/sec" --agents 6 --harness codex --replace --execute

  Default: prints the plan as JSON without spawning anything (safe to inspect).
  --execute creates worktrees + tmux session and launches agents.
  --write-only just writes coordination files (task.md / handoff.md / status.md).
        `);
        return;
      }
    }

    let planConfig;
    try {
      if (opts.planPath) {
        // Power-user: load a hand-written plan JSON.
        const raw = fs.readFileSync(path.resolve(opts.planPath), 'utf8');
        planConfig = JSON.parse(raw);
      } else {
        // Auto-build from flags.
        if (!task) {
          console.error('swarm: --task is required (or use --plan plan.json). See --help.');
          process.exit(1);
        }
        let agents = null;
        if (agentsSpec) {
          if (/^\d+$/.test(agentsSpec)) count = Number(agentsSpec);
          else agents = agentsSpec.split(',').map(s => s.trim()).filter(Boolean);
        }
        planConfig = builder.buildSwarmPlan({
          task,
          agents,
          count,
          harness:          opts.harness   || 'claude',
          launcherCmd:      opts.launcherCmd,
          sessionName:      opts.sessionName,
          repoRoot:         opts.repoRoot,
          worktreeRoot:     opts.worktreeRoot,
          coordinationRoot: opts.coordinationRoot,
          baseRef:          opts.baseRef,
          seedPaths:        opts.seedPaths,
          replaceExisting:  !!opts.replaceExisting,
        });
      }

      const plan = orchestrator.buildOrchestrationPlan(planConfig);

      if (opts.json) {
        console.log(JSON.stringify(plan, null, 2));
        return;
      }

      if (opts.writeOnly) {
        orchestrator.materializePlan(plan);
        console.log(`✓ wrote orchestration files to ${plan.coordinationDir}`);
        return;
      }

      if (!opts.execute) {
        // Dry-run summary.
        console.log(`[swarm] dry-run · session=${plan.sessionName} · workers=${plan.workerPlans.length}`);
        console.log(`  repo:   ${plan.repoRoot}`);
        console.log(`  coord:  ${plan.coordinationDir}`);
        console.log(`  base:   ${plan.baseRef}`);
        for (const w of plan.workerPlans) {
          console.log(`  • ${w.workerName.padEnd(24)} → ${w.worktreePath}`);
          console.log(`      branch:   ${w.branchName}`);
          console.log(`      launcher: ${String(w.launchCommand).slice(0, 100)}${w.launchCommand.length > 100 ? '…' : ''}`);
        }
        console.log('\nRe-run with --execute to spawn worktrees + tmux session.');
        console.log('Or --write-only to just create coordination files.');
        return;
      }

      const result = orchestrator.executePlan(plan);
      console.log(`✓ started tmux session "${result.sessionName}" with ${result.workerCount} worker panes`);
      console.log(`  attach: tmux attach -t ${result.sessionName}`);
      console.log(`  coord:  ${result.coordinationDir}`);
    } catch (e) {
      process.stderr.write(`[swarm] ${e.message}\n`);
      process.exit(1);
    }
  })();
  return;
}

// ── Subcommand: session-export / session-import / replay ─────────────────────
// Usage:
//   kodelyth-ecc session-export <session> [--out file.json] [--task "..."] [--agents a,b] [--harness h]
//   kodelyth-ecc session-import <bundle.json> [--target dir] [--overwrite]
//   kodelyth-ecc replay <bundle.json|session-name> [--harness h] [--agents a,b] [--base-ref ref]
//                                                  [--session NAME] [--execute|--write-only]
if (args[0] === 'session-export' || args[0] === 'session-import' || args[0] === 'replay') {
  (async () => {
    const fs   = require('fs');
    const sub  = args[0];
    const rest = args.slice(1);
    const bundleLib = require(path.join(ROOT, 'scripts', 'replay', 'bundle.js'));
    const replayLib = require(path.join(ROOT, 'scripts', 'replay', 'replay.js'));
    const orchestrator = require(path.join(ROOT, 'scripts', 'lib', 'tmux-worktree-orchestrator.js'));

    function flag(name) {
      const i = rest.indexOf(name);
      return i >= 0 ? rest[i + 1] : undefined;
    }
    function has(name) { return rest.includes(name); }

    try {
      // ── session-export ─────────────────────────────────────────────────────
      if (sub === 'session-export') {
        const session = rest.find(a => !a.startsWith('--') && rest.indexOf(a) === 0);
        if (!session) throw new Error('session-export: <session> is required (the directory name under .orchestration/)');

        const coordRoot = flag('--coord-root') || path.join(process.cwd(), '.orchestration');
        const sessionDir = path.isAbsolute(session) ? session : path.join(coordRoot, session);
        const out = flag('--out') || path.join(coordRoot, `${path.basename(sessionDir)}.bundle.json`);

        const meta = {};
        const taskFlag = flag('--task');     if (taskFlag)    meta.task = taskFlag;
        const agFlag   = flag('--agents');   if (agFlag)      meta.agents = agFlag.split(',').map(s => s.trim()).filter(Boolean);
        const hFlag    = flag('--harness');  if (hFlag)       meta.harness = hFlag;
        const refFlag  = flag('--base-ref'); if (refFlag)     meta.base_ref = refFlag;

        const bundle = bundleLib.exportBundle({
          sessionDir,
          sessionName: path.basename(sessionDir),
          meta,
        });
        bundleLib.writeBundle(bundle, out);
        console.log(`✓ exported bundle: ${out}`);
        console.log(`  session: ${bundle.session}`);
        console.log(`  workers: ${bundle.workers.length}`);
        if (Object.keys(bundle.meta).length > 0) console.log(`  meta:    ${JSON.stringify(bundle.meta)}`);
        return;
      }

      // ── session-import ─────────────────────────────────────────────────────
      if (sub === 'session-import') {
        const bundlePath = rest.find(a => !a.startsWith('--'));
        if (!bundlePath) throw new Error('session-import: <bundle.json> is required');

        const bundle = bundleLib.readBundle(bundlePath);
        const coordRoot = flag('--coord-root') || path.join(process.cwd(), '.orchestration');
        const targetDir = flag('--target') || path.join(coordRoot, bundle.session);
        const overwrite = has('--overwrite');

        const out = bundleLib.importBundle(bundle, { targetDir, overwrite });
        console.log(`✓ imported bundle into: ${out.targetDir}`);
        console.log(`  workers: ${out.workers.join(', ')}`);
        console.log(`  inspect: cat ${path.join(out.targetDir, out.workers[0], 'handoff.md')}`);
        return;
      }

      // ── replay ─────────────────────────────────────────────────────────────
      if (sub === 'replay') {
        const target = rest.find(a => !a.startsWith('--'));
        if (!target) throw new Error('replay: <bundle.json|session-name> is required');

        // Resolve target → bundle object.
        let bundle;
        if (target.endsWith('.json') && fs.existsSync(path.resolve(target))) {
          bundle = bundleLib.readBundle(path.resolve(target));
        } else {
          // Treat as session name under .orchestration/.
          const coordRoot = flag('--coord-root') || path.join(process.cwd(), '.orchestration');
          const sessionDir = path.join(coordRoot, target);
          if (!fs.existsSync(sessionDir)) {
            throw new Error(`replay: not a bundle file or known session: ${target}`);
          }
          bundle = bundleLib.exportBundle({ sessionDir, sessionName: target });
        }

        // Build the replay plan.
        const opts = {
          repoRoot:        process.cwd(),
          baseRef:         flag('--base-ref'),
          harness:         flag('--harness'),
          sessionName:     flag('--session'),
          agents:          (flag('--agents') || '').split(',').map(s => s.trim()).filter(Boolean),
          replaceExisting: has('--replace'),
        };
        if (opts.agents.length === 0) opts.agents = null;

        const planConfig = replayLib.buildReplayPlanConfig(bundle, opts);
        const plan = orchestrator.buildOrchestrationPlan(planConfig);

        if (has('--json')) {
          console.log(JSON.stringify({ planConfig, plan }, null, 2));
          return;
        }

        if (has('--write-only')) {
          orchestrator.materializePlan(plan);
          console.log(`✓ replay coordination files written to ${plan.coordinationDir}`);
          console.log(`  origin session: ${bundle.session}`);
          console.log(`  replay session: ${plan.sessionName}`);
          return;
        }

        if (!has('--execute')) {
          console.log(`[replay] dry-run · origin=${bundle.session} → replay=${plan.sessionName}`);
          console.log(`  workers: ${plan.workerPlans.length}`);
          console.log(`  base ref: ${plan.baseRef}`);
          for (const w of plan.workerPlans) {
            console.log(`  • ${w.workerName.padEnd(24)} → ${w.worktreePath}`);
          }
          console.log('\nRe-run with --execute to spawn worktrees + tmux session.');
          console.log('Or --write-only to just create coordination files.');
          return;
        }

        const result = orchestrator.executePlan(plan);
        console.log(`✓ replay started: tmux session "${result.sessionName}"`);
        console.log(`  origin: ${bundle.session}`);
        console.log(`  attach: tmux attach -t ${result.sessionName}`);
        console.log(`  coord:  ${result.coordinationDir}`);
        return;
      }
    } catch (e) {
      process.stderr.write(`[${sub}] ${e.message}\n`);
      process.exit(1);
    }
  })();
  return;
}

// ── Subcommand: sbom / manifest / verify ─────────────────────────────────────
// Usage:
//   kodelyth-ecc sbom        [--root DIR] [--out FILE] [--json]
//   kodelyth-ecc manifest    [--root DIR] [--out FILE] [--json]
//   kodelyth-ecc verify      [--root DIR] [--manifest FILE] [--json]
if (args[0] === 'sbom' || args[0] === 'manifest' || args[0] === 'verify') {
  (async () => {
    const fs   = require('fs');
    const sub  = args[0];
    const rest = args.slice(1);

    function flag(name, dflt) {
      const i = rest.indexOf(name);
      return i >= 0 && rest[i + 1] ? rest[i + 1] : dflt;
    }
    function has(name) { return rest.includes(name); }

    const rootDir = path.resolve(flag('--root', ROOT));

    try {
      if (sub === 'sbom') {
        const { generateSBOM } = require(path.join(ROOT, 'scripts', 'supply-chain', 'sbom.js'));
        const bom = generateSBOM({ rootDir });
        const json = JSON.stringify(bom, null, 2);
        const out = flag('--out');
        if (out) {
          fs.writeFileSync(out, json + '\n');
          console.log(`✓ SBOM written: ${out}`);
          console.log(`  format:     ${bom.bomFormat} ${bom.specVersion}`);
          console.log(`  package:    ${bom.metadata.component.name}@${bom.metadata.component.version}`);
          console.log(`  components: ${bom.components.length}`);
        } else if (has('--json')) {
          process.stdout.write(json + '\n');
        } else {
          console.log(`${bom.bomFormat} ${bom.specVersion}`);
          console.log(`package:    ${bom.metadata.component.name}@${bom.metadata.component.version}`);
          console.log(`components: ${bom.components.length}`);
          console.log(`(use --out FILE or --json to emit the full document)`);
        }
        return;
      }

      if (sub === 'manifest') {
        const { generateManifest } = require(path.join(ROOT, 'scripts', 'supply-chain', 'manifest.js'));
        const m = generateManifest({ rootDir });
        const json = JSON.stringify(m, null, 2);
        const out = flag('--out');
        if (out) {
          fs.writeFileSync(out, json + '\n');
          console.log(`✓ manifest written: ${out}`);
          console.log(`  package:    ${m.package}@${m.pkg_version}`);
          console.log(`  files:      ${m.file_count}`);
          console.log(`  digest:     ${m.digest.slice(0, 16)}…`);
        } else if (has('--json')) {
          process.stdout.write(json + '\n');
        } else {
          console.log(`package: ${m.package}@${m.pkg_version}`);
          console.log(`files:   ${m.file_count}`);
          console.log(`digest:  ${m.digest}`);
          console.log(`(use --out FILE or --json to emit the full document)`);
        }
        return;
      }

      if (sub === 'verify') {
        const { verifyAgainstManifest } = require(path.join(ROOT, 'scripts', 'supply-chain', 'verify.js'));
        const manifestPath = flag('--manifest', path.join(rootDir, 'manifest.json'));
        if (!fs.existsSync(manifestPath)) {
          throw new Error(`verify: manifest not found at ${manifestPath} (use --manifest FILE)`);
        }
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const report = verifyAgainstManifest({ rootDir, manifest });

        if (has('--json')) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
          process.exit(report.ok ? 0 : 1);
        }

        const s = report.summary;
        console.log(`Kodelyth ECC supply-chain verify`);
        console.log(`  package:           ${manifest.package}@${manifest.pkg_version}`);
        console.log(`  manifest digest:   ${manifest.digest}`);
        console.log(`  files in manifest: ${s.total_in_manifest}`);
        console.log(`    ✓ ok:       ${s.ok}`);
        console.log(`    ✗ modified: ${s.modified}`);
        console.log(`    ✗ missing:  ${s.missing}`);
        console.log(`    ⚠ extra:    ${s.extra} (advisory)`);

        if (report.details.modified.length) {
          console.log(`\nModified files:`);
          for (const m of report.details.modified.slice(0, 20)) {
            console.log(`  • ${m.path}`);
          }
          if (report.details.modified.length > 20) {
            console.log(`  …and ${report.details.modified.length - 20} more (use --json for full list)`);
          }
        }
        if (report.details.missing.length) {
          console.log(`\nMissing files:`);
          for (const m of report.details.missing.slice(0, 20)) {
            console.log(`  • ${m.path}`);
          }
          if (report.details.missing.length > 20) {
            console.log(`  …and ${report.details.missing.length - 20} more (use --json for full list)`);
          }
        }
        console.log(report.ok ? `\n✓ verify OK` : `\n✗ verify FAILED`);
        process.exit(report.ok ? 0 : 1);
      }
    } catch (e) {
      process.stderr.write(`[${sub}] ${e.message}\n`);
      process.exit(1);
    }
  })();
  return;
}

// ── Subcommand: dashboard (local observability) ───────────────────────────────
// Usage:
//   kodelyth-ecc dashboard [--port N] [--host 127.0.0.1] [--no-open]
if (args[0] === 'dashboard') {
  (async () => {
    const rest = args.slice(1);
    function flag(name, dflt) {
      const i = rest.indexOf(name);
      return i >= 0 && rest[i + 1] ? rest[i + 1] : dflt;
    }
    function has(name) { return rest.includes(name); }
    try {
      const { start } = require(path.join(ROOT, 'scripts', 'dashboard', 'server.js'));
      const port = Number(flag('--port', '5747'));
      const host = flag('--host', '127.0.0.1');
      const openBrowser = !has('--no-open');
      await start({ port, host, openBrowser });
      // Keep process alive — http server is already listening.
    } catch (e) {
      process.stderr.write(`[dashboard] ${e.message}\n`);
      process.exit(1);
    }
  })();
  return;
}

// ── Subcommand: evolve (Phase 3.4 — self-evolving memory) ────────────────────
// Usage:
//   kodelyth-ecc evolve analyze                 [--json] [--reuse-min N] [--miss-min N]
//   kodelyth-ecc evolve list   [--status STATUS] [--json]
//   kodelyth-ecc evolve show   <proposalId>     [--json]
//   kodelyth-ecc evolve accept <proposalId>     [--root DIR] [--overwrite]
//   kodelyth-ecc evolve reject <proposalId>     [--note "..."]
//   kodelyth-ecc evolve stats                   [--json]
if (args[0] === 'evolve') {
  (async () => {
    const fs   = require('fs');
    const sub  = args[1] || '';
    const rest = args.slice(2);

    function flag(name, dflt) {
      const i = rest.indexOf(name);
      return i >= 0 && rest[i + 1] ? rest[i + 1] : dflt;
    }
    function has(name) { return rest.includes(name); }
    function positional() { return rest.find(a => !a.startsWith('--')); }

    try {
      const statsLib     = require(path.join(ROOT, 'scripts', 'evolve', 'stats.js'));
      const analyzeLib   = require(path.join(ROOT, 'scripts', 'evolve', 'analyze.js'));
      const proposalsLib = require(path.join(ROOT, 'scripts', 'evolve', 'proposals.js'));
      const memoryStore  = require(path.join(ROOT, 'scripts', 'memory', 'store.js'));

      // ── stats ────────────────────────────────────────────────────────────
      if (sub === 'stats') {
        const reuse = statsLib.getReuseStats();
        const miss  = statsLib.getRoutingMissStats();
        if (has('--json')) {
          process.stdout.write(JSON.stringify({ reuse, miss }, null, 2) + '\n');
          return;
        }
        console.log('Kodelyth ECC — self-evolving memory stats');
        console.log(`  reuse:`);
        console.log(`    memories tracked: ${reuse.total_memories_tracked}`);
        console.log(`    total surfaces:   ${reuse.total_surfaces}`);
        console.log(`    last updated:     ${reuse.last_updated || '(none)'}`);
        if (reuse.entries.length) {
          console.log(`    top reused:`);
          for (const e of reuse.entries.slice(0, 5)) {
            console.log(`      • ${e.id}  count=${e.count}  sessions=${(e.sessions||[]).length}`);
          }
        }
        console.log(`  routing misses:`);
        console.log(`    total:            ${miss.total_misses}`);
        console.log(`    unique prompts:   ${miss.unique_prompts}`);
        if (miss.entries.length) {
          console.log(`    top clusters:`);
          for (const e of miss.entries.slice(0, 5)) {
            console.log(`      • count=${e.count}  tokens=[${(e.tokens||[]).slice(0,4).join(', ')}]`);
          }
        }
        return;
      }

      // ── analyze ──────────────────────────────────────────────────────────
      if (sub === 'analyze') {
        const reuseStats = statsLib.getReuseStats();
        const missStats  = statsLib.getRoutingMissStats();
        const memories   = memoryStore.listAll();
        const thresholds = {
          reuseMinCount:          Number(flag('--reuse-min')) || undefined,
          reuseMinSessions:       Number(flag('--reuse-min-sessions')) || undefined,
          missMinCount:           Number(flag('--miss-min'))  || undefined,
          missMinClusterDistinct: Number(flag('--miss-min-distinct')) || undefined,
        };
        const fresh = analyzeLib.analyzeAll({ reuseStats, missStats, memories, thresholds });

        let appended = 0;
        for (const p of fresh) {
          const before = proposalsLib.findById(p.id);
          proposalsLib.appendProposal(p);
          if (!before) appended += 1;
        }

        if (has('--json')) {
          process.stdout.write(JSON.stringify({
            scanned:    { reuse_entries: reuseStats.entries.length, miss_entries: missStats.entries.length },
            generated:  fresh.length,
            new:        appended,
            proposals:  fresh,
          }, null, 2) + '\n');
          return;
        }

        console.log(`✓ analyzed signals`);
        console.log(`  reuse entries scanned:  ${reuseStats.entries.length}`);
        console.log(`  miss entries scanned:   ${missStats.entries.length}`);
        console.log(`  proposals generated:    ${fresh.length}`);
        console.log(`  new proposals (added):  ${appended}`);
        if (fresh.length === 0) {
          console.log(`\n  No proposals yet. Either signals are below thresholds or there's nothing to propose.`);
          console.log(`  Defaults: reuse-min=${analyzeLib.DEFAULT_REUSE_MIN_COUNT} reuse-min-sessions=${analyzeLib.DEFAULT_REUSE_MIN_SESSIONS} miss-min=${analyzeLib.DEFAULT_MISS_MIN_COUNT}`);
        } else {
          console.log(`\n  Run 'kodelyth-ecc evolve list' to review.`);
        }
        return;
      }

      // ── list ─────────────────────────────────────────────────────────────
      if (sub === 'list') {
        const wantStatus = flag('--status');
        const proposals = proposalsLib.listByStatus(wantStatus || null);
        if (has('--json')) {
          process.stdout.write(JSON.stringify(proposals, null, 2) + '\n');
          return;
        }
        if (proposals.length === 0) {
          console.log(`No proposals${wantStatus ? ` with status="${wantStatus}"` : ''}. Try 'kodelyth-ecc evolve analyze' first.`);
          return;
        }
        console.log(`Kodelyth ECC — self-evolving memory proposals (${proposals.length})`);
        for (const p of proposals) {
          const tag = p.status === 'pending' ? '⏸' : p.status === 'accepted' ? '✓' : p.status === 'rejected' ? '✗' : p.status === 'applied' ? '★' : '?';
          console.log(`  ${tag} [${p.status}] ${p.id}  ${p.type}`);
          console.log(`     target: ${p.proposal?.target_path || '(none)'}`);
          console.log(`     why:    ${p.proposal?.rationale || '(none)'}`);
        }
        return;
      }

      // ── show ─────────────────────────────────────────────────────────────
      if (sub === 'show') {
        const id = positional();
        if (!id) throw new Error('show: <proposalId> is required');
        const p = proposalsLib.findById(id);
        if (!p) throw new Error(`show: proposal "${id}" not found`);
        if (has('--json')) {
          process.stdout.write(JSON.stringify(p, null, 2) + '\n');
          return;
        }
        console.log(`Proposal ${p.id}  (${p.type}, status=${p.status})`);
        console.log(`  target_path: ${p.proposal?.target_path}`);
        console.log(`  rationale:   ${p.proposal?.rationale}`);
        console.log(`\n--- proposed file content ---\n`);
        console.log(p.proposal?.diff || '(no diff)');
        console.log(`\n--- evidence ---\n`);
        console.log(JSON.stringify(p.evidence, null, 2));
        return;
      }

      // ── accept ───────────────────────────────────────────────────────────
      if (sub === 'accept') {
        const id = positional();
        if (!id) throw new Error('accept: <proposalId> is required');
        const p = proposalsLib.findById(id);
        if (!p) throw new Error(`accept: proposal "${id}" not found`);
        if (p.status === 'accepted' || p.status === 'applied') {
          console.log(`Proposal ${id} is already ${p.status}.`);
          if (p.applied_path) console.log(`  draft at: ${p.applied_path}`);
          return;
        }

        const repoRoot = path.resolve(flag('--root', ROOT));
        const overwrite = has('--overwrite');
        const result = proposalsLib.applyProposalToDisk(p, { repoRoot, overwrite });
        proposalsLib.setStatus(id, 'accepted', undefined, { applied_path: result.path });

        console.log(`✓ accepted ${id}`);
        console.log(`  draft written: ${result.path}`);
        console.log(`\n  Review the draft. When you're happy with it, commit it.`);
        console.log(`  Then mark it applied: kodelyth-ecc evolve list --status applied`);
        console.log(`  (Evolve NEVER auto-commits proposals.)`);
        return;
      }

      // ── reject ───────────────────────────────────────────────────────────
      if (sub === 'reject') {
        const id = positional();
        if (!id) throw new Error('reject: <proposalId> is required');
        const p = proposalsLib.findById(id);
        if (!p) throw new Error(`reject: proposal "${id}" not found`);
        const note = flag('--note');
        proposalsLib.setStatus(id, 'rejected', undefined, note ? { note } : {});
        console.log(`✗ rejected ${id}${note ? ` (note: ${note})` : ''}`);
        return;
      }

      throw new Error(
        `unknown evolve subcommand "${sub}". ` +
        `Valid: analyze, list, show, accept, reject, stats.`
      );
    } catch (e) {
      process.stderr.write(`[evolve] ${e.message}\n`);
      process.exit(1);
    }
  })();
  return;
}

// ── Help shortcut ─────────────────────────────────────────────────────────────
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  Kodelyth ECC — AI Coding Toolkit installer

  Usage:
    npx kodelyth-ecc [--target TARGET] [--bundle BUNDLE] [--profile PROFILE] [languages...]
    npx kodelyth-ecc mcp                          Start the Kodelyth MCP server over stdio
    npx kodelyth-ecc mcp-add <name> -- <cmd>      Register an external MCP server
    npx kodelyth-ecc mcp-list                     List registered MCP servers
    npx kodelyth-ecc mcp-tools <name>             List tools on a registered server
    npx kodelyth-ecc mcp-call <name> <tool>       Call a tool on a registered server
    npx kodelyth-ecc route "<task>"               Cost-aware model-tier recommendation for a task
    npx kodelyth-ecc swarm --task "<task>"        Parallel agent execution in tmux + git worktrees
    npx kodelyth-ecc session-export <session>     Export a coordination dir as a portable bundle
    npx kodelyth-ecc replay <bundle|session>      Re-run a session with optional variations
    npx kodelyth-ecc sbom [--out file.json]       Emit a CycloneDX 1.5 SBOM for the package
    npx kodelyth-ecc manifest [--out file.json]   Emit a sha256 content manifest of all assets
    npx kodelyth-ecc verify [--manifest file]     Verify installed copy against a content manifest
    npx kodelyth-ecc evolve analyze               Generate skill / routing proposals from memory + miss signals
    npx kodelyth-ecc dashboard                    Boot localhost-only observability dashboard (zero telemetry)

  Subcommands:
    mcp                  Start the Kodelyth MCP server over stdio (universal adapter for
                         Claude Desktop, LangGraph, AutoGen, CrewAI, OpenAI Agents SDK, etc.).
                         See docs/mcp.md for client config snippets.
    mcp-add <name>       Register an external MCP server (Stripe, GitHub, Postgres, Redis…).
                         Usage: kodelyth-ecc mcp-add github -- npx -y @modelcontextprotocol/server-github
                         Or with env vars: kodelyth-ecc mcp-add postgres --env DB_URL=postgres://...
                                          -- npx -y @modelcontextprotocol/server-postgres
    mcp-list             List all registered external MCP servers.
    mcp-remove <name>    Unregister an external MCP server.
    mcp-tools <name>     List tools exposed by a registered server.
    mcp-resources <name> List resources exposed by a registered server.
    mcp-prompts <name>   List prompts exposed by a registered server.
    mcp-call <name> <tool> [--json '{"arg":"value"}']
                         Call a tool on a registered server. See docs/mcp-clients.md.
    route                Recommend trivial/standard/hard model tier for a task. Reads
                         .kodelyth/router.json and KODELYTH_ROUTER_* env vars. Disable with
                         KODELYTH_ROUTER=off. Use --json for machine-readable output.
    swarm                Run N specialist agents in parallel inside isolated git worktrees +
                         a tmux session. Auto-picks agents from --task signals or accepts
                         --agents name1,name2,... Smart defaults for 4/6/8-agent rotations.
                         Default is dry-run; pass --execute to actually spawn. See docs/swarm.md.
    session-export       Export a coordination dir as a portable bundle JSON (task + handoffs
                         + status). Optional --task / --agents / --harness / --base-ref to
                         enrich the bundle's meta for cleaner replay. See docs/replay.md.
    session-import       Restore a bundle into a coordination dir (--target dir, --overwrite).
    replay               Re-run a session or bundle. Accepts --harness / --agents / --base-ref
                         / --session for A/B variations. Default dry-run; --execute to spawn.
    sbom                 Generate a CycloneDX 1.5 SBOM from package.json + package-lock.json.
                         Use --out FILE to write, --json to stream. See docs/supply-chain.md.
    manifest             Generate a sha256 content manifest of every shipped asset (agents,
                         skills, commands, rules, hooks, scripts, bin, bundles, root files).
                         Output is deterministic and diff-friendly.
    verify               Verify an installed copy against a manifest. Reports ok/modified/
                         missing/extra. Exits non-zero on any modified or missing file.
    dashboard            Local observability dashboard. Boots a localhost-only HTTP
                         server (default 127.0.0.1:5747) showing memory, evolve signals,
                         catalog, sessions, token-budget snapshot. Auto-opens browser unless
                         --no-open. Refuses to bind non-localhost without
                         KODELYTH_DASHBOARD_ALLOW_REMOTE=1. Zero telemetry. See docs/dashboard.md.
    evolve               Self-evolving memory. Subactions:
                           analyze   Convert reuse + routing-miss signals into proposals
                           list      Show pending / accepted / rejected proposals
                           show ID   Print full proposed file content + evidence
                           accept ID Write the draft to disk (NEVER auto-commits)
                           reject ID Mark a proposal rejected
                           stats     Snapshot of recorded signals
                         See docs/evolve.md.

  Targets:
    claude-home          Claude Code — global install (default)
    windsurf-project     Windsurf — project install (.windsurf/ + .windsurfrules)
    windsurf-home        Windsurf — global install (~/.codeium/windsurf/)
    antigravity          Google Antigravity — project install (.agent/)
    cursor-project       Cursor IDE — project install (.cursor/)
    codex-home           Codex CLI — global install (~/.codex/)
    opencode             OpenCode — project install (.opencode/)
    cline                Cline (VS Code) — project install (.clinerules/)
    roocode              Roo Code (VS Code) — project install (.roo/)
    aider                Aider terminal agent — project install (.aider-ecc/ + CONVENTIONS.md)
    kimi                 Kimi Code — project install (.kimi/)
    gemini-project       Gemini CLI — project install (.gemini/)
    gemini-home          Gemini CLI — global install (~/.gemini/)

  Bundles (audience-tailored — installs everything + curated cheat sheet):
    --bundle indie-hacker  Solo founders / SaaS — ship fast, validate, harden
    --bundle red-team      Security engineers — devil-mode crew + adversarial workflows
    --bundle enterprise    Compliance / audit teams — SBOM, license, supply chain

  Examples:
    npx kodelyth-ecc
    npx kodelyth-ecc --target windsurf-project
    npx kodelyth-ecc --bundle indie-hacker
    npx kodelyth-ecc --bundle red-team --target windsurf-project
    npx kodelyth-ecc --bundle enterprise
    npx kodelyth-ecc --target antigravity --profile nextjs
    npx kodelyth-ecc --target claude-home typescript python

    # Always-latest unreleased commit:
    npx github:sifxprime/kodelyth-ecc

  Flags:
    --help, -h       Show this help
    --version, -v    Print installed version

  Node >= 18 required.
`);
  process.exit(0);
}

// ── Version shortcut ──────────────────────────────────────────────────────────
if (args.includes('--version') || args.includes('-v')) {
  const versionFile = path.join(ROOT, 'VERSION');
  const version     = fs.existsSync(versionFile)
    ? fs.readFileSync(versionFile, 'utf8').trim()
    : require(path.join(ROOT, 'package.json')).version;
  console.log(`kodelyth-ecc v${version}`);
  process.exit(0);
}

// ── Run installer ─────────────────────────────────────────────────────────────
if (isWin) {
  const ps1 = path.join(ROOT, 'install.ps1');
  if (!fs.existsSync(ps1)) {
    console.error('Error: install.ps1 not found. Please clone the repo and run install.ps1 manually.');
    process.exit(1);
  }

  // Map CLI args (--target X, --bundle X, --profile X) → PowerShell named params (-Target X, -Bundle X)
  // Positional language args (e.g. "typescript python") → collected for -Languages
  const psArgs = [];
  const languages = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === '--target' || a === '-target') && args[i + 1]) {
      psArgs.push('-Target', args[++i]); continue;
    }
    if ((a === '--bundle' || a === '-bundle') && args[i + 1]) {
      psArgs.push('-Bundle', args[++i]); continue;
    }
    if ((a === '--profile' || a === '-profile') && args[i + 1]) {
      // profile maps to languages in ps1
      languages.push(args[++i]); continue;
    }
    if (!a.startsWith('-')) {
      // positional = language module
      languages.push(a); continue;
    }
    // pass through any other flags unmapped
    psArgs.push(a);
  }
  if (languages.length > 0) {
    psArgs.push('-Languages', languages.join(','));
  }

  // Try pwsh (PowerShell 7+) first, then fall back to powershell (5.1)
  function trySpawn(bin) {
    return spawnSync(bin, ['-NoLogo', '-ExecutionPolicy', 'Bypass', '-File', ps1, ...psArgs], {
      stdio: 'inherit',
      shell: false,
      env: { ...process.env, KODELYTH_NONINTERACTIVE: '1' },
    });
  }

  let result = trySpawn('pwsh');
  if (result.error && result.error.code === 'ENOENT') {
    // pwsh not found — try legacy powershell.exe
    result = trySpawn('powershell');
  }

  if (result.error) {
    console.error(
      '\nError: Could not launch PowerShell to run the installer.\n' +
      'Make sure PowerShell is installed and accessible in your PATH.\n' +
      '  • Try:   pwsh --version\n' +
      '  • Or:    powershell -Version\n' +
      '\nAlternatively, run the installer manually:\n' +
      `  powershell -ExecutionPolicy Bypass -File "${ps1}"\n`
    );
    process.exit(1);
  }
  process.exit(result.status ?? 1);
} else {
  const sh = path.join(ROOT, 'install.sh');
  if (!fs.existsSync(sh)) {
    console.error('Error: install.sh not found in package root:', ROOT);
    process.exit(1);
  }
  fs.chmodSync(sh, 0o755);
  const result = spawnSync('bash', [sh, ...args], { stdio: 'inherit', shell: false });
  process.exit(result.status ?? 1);
}
