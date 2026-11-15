// scripts/doctor-health.js
// Live subsystem health check — the "is it real or dummy" diagnostic.
// Each check actually EXERCISES a subsystem (not just "does the file exist"),
// so it catches the class of bug where a feature is installed + registered but
// silently broken (recall crash on stale index, prompt-injection guard off,
// MCP server never registered, etc.).
//
// Returns { checks: [{ id, status, detail, fix }], summary }. Zero deps.

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HOME = os.homedir();

const PASS = 'pass', WARN = 'warn', FAIL = 'fail';

function check(id, fn) {
  try { return { id, ...fn() }; }
  catch (e) { return { id, status: FAIL, detail: e.message, fix: 'unexpected error — file an issue' }; }
}

function onPath(bin) {
  try { execFileSync(bin, ['--version'], { stdio: 'ignore' }); return true; }
  catch { return false; }
}

// ── Individual checks ────────────────────────────────────────────────────────

function checkBinaries() {
  const a = onPath('kodelyth-ecc'), b = onPath('kodelythecc');
  if (a && b) return { status: PASS, detail: 'kodelyth-ecc and kodelythecc both on PATH' };
  if (a || b) return { status: WARN, detail: `only ${a ? 'kodelyth-ecc' : 'kodelythecc'} on PATH`, fix: 'reinstall: npm i -g kodelyth-ecc' };
  return { status: WARN, detail: 'neither binary on PATH (running via npx?)', fix: 'npm i -g kodelyth-ecc for the global CLI' };
}

function checkInstallTarget() {
  const dir = path.join(HOME, '.claude');
  if (!fs.existsSync(dir)) return { status: WARN, detail: 'no ~/.claude — ECC not installed for Claude Code', fix: 'kodelythecc --target claude-code' };
  const counts = {};
  for (const k of ['agents', 'skills', 'commands', 'hooks', 'rules']) {
    try { counts[k] = fs.readdirSync(path.join(dir, k)).length; } catch { counts[k] = 0; }
  }
  const empty = Object.entries(counts).filter(([, n]) => n === 0).map(([k]) => k);
  if (empty.length) return { status: WARN, detail: `empty: ${empty.join(', ')} (have ${JSON.stringify(counts)})`, fix: 'kodelythecc --target claude-code' };
  return { status: PASS, detail: `agents:${counts.agents} skills:${counts.skills} commands:${counts.commands} hooks:${counts.hooks} rules:${counts.rules}` };
}

function checkHooksRegistered() {
  const settings = path.join(HOME, '.claude', 'settings.json');
  if (!fs.existsSync(settings)) return { status: WARN, detail: 'no ~/.claude/settings.json', fix: 'kodelythecc --target claude-code' };
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(settings, 'utf8')); } catch { return { status: FAIL, detail: 'settings.json is not valid JSON', fix: 'repair or reinstall' }; }
  const events = Object.keys(cfg.hooks || {});
  const need = ['UserPromptSubmit', 'Stop', 'SessionStart'];
  const missing = need.filter(e => !events.includes(e));
  if (missing.length) return { status: WARN, detail: `hook events missing: ${missing.join(', ')}`, fix: 'kodelythecc --target claude-code' };
  return { status: PASS, detail: `${events.length} hook events wired: ${events.join(', ')}` };
}

function checkMemoryRecall() {
  // The real test: recall must NOT throw on whatever index is on disk.
  // This is the exact bug fixed in 2.4.3 (stale/foreign index schema).
  const store = require(path.join(ROOT, 'scripts', 'memory', 'store.js'));
  const stats = store.stats();
  let recalled;
  try { recalled = store.recall('stripe webhook auth database', { limit: 3, minScore: 0.1 }); }
  catch (e) { return { status: FAIL, detail: `recall threw: ${e.message}`, fix: 'delete ~/.kodelythecc/memory/index.json (self-heals on next run)' }; }
  return { status: PASS, detail: `${stats.total} memories, recall returned ${recalled.length} without error` };
}

function checkMemoryIndex() {
  const idx = process.env.KODELYTH_MEMORY_DIR
    ? path.join(process.env.KODELYTH_MEMORY_DIR, 'index.json')
    : path.join(HOME, '.kodelythecc', 'memory', 'index.json');
  if (!fs.existsSync(idx)) return { status: PASS, detail: 'no index yet (builds on first capture)' };
  let data;
  try { data = JSON.parse(fs.readFileSync(idx, 'utf8')); } catch { return { status: WARN, detail: 'index.json unreadable — will rebuild', fix: 'harmless; rebuilds on next recall' }; }
  const ok = data && data.tokens && typeof data.tokens === 'object' && typeof data.docCount === 'number';
  if (!ok) return { status: WARN, detail: 'index uses an old schema — will self-heal on next recall', fix: 'harmless; auto-rebuilds' };
  return { status: PASS, detail: `valid BM25 index (${data.docCount} docs)` };
}

function checkMcpRegistered() {
  try {
    const reg = require(path.join(ROOT, 'scripts', 'mcp', 'register-self.js'));
    const rows = reg.statusAll();
    const present = rows.filter(r => r.present).length;
    const total = rows.length;
    if (present === 0) return { status: WARN, detail: 'ECC MCP server not registered in any client', fix: 'kodelythecc mcp-register' };
    if (present < total) return { status: WARN, detail: `registered in ${present}/${total} clients`, fix: 'kodelythecc mcp-register' };
    return { status: PASS, detail: `registered in ${present}/${total} clients (Claude Code + Desktop)` };
  } catch (e) { return { status: WARN, detail: 'could not read MCP configs: ' + e.message }; }
}

function checkMcpBoots() {
  const server = path.join(ROOT, 'scripts', 'mcp', 'server.js');
  if (!fs.existsSync(server)) return { status: FAIL, detail: 'mcp/server.js missing', fix: 'reinstall the package' };
  const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) + '\n';
  const r = spawnSync(process.execPath, [server], { input: req, encoding: 'utf8', timeout: 8000 });
  const out = (r.stdout || '');
  const m = out.split('\n').map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).find(o => o.result && o.result.tools);
  if (!m) return { status: FAIL, detail: 'MCP server did not return a tools list', fix: 'check node version >=18' };
  return { status: PASS, detail: `MCP server boots, exposes ${m.result.tools.length} tools` };
}

function checkPromptInjectionGuard() {
  // The 2.4.4 bug: guard defaulted to off = silent no-op. Verify it's active.
  const mode = String(process.env.KODELYTH_PI_GUARD || 'warn').toLowerCase();
  if (mode === 'off') return { status: WARN, detail: 'prompt-injection guard is OFF (silent)', fix: 'unset KODELYTH_PI_GUARD or set =warn' };
  return { status: PASS, detail: `prompt-injection guard active (mode=${mode})` };
}

// Both tools DO publish Windows builds, and since 2.23.0 ECC downloads them, so
// the install command is now the right advice on every platform. What differs is
// what happens afterwards: on Windows the binary lands in
// %LOCALAPPDATA%\Kodelyth\bin, which is not on PATH by default, so the hint
// mentions that rather than implying the command alone finishes the job.
const IS_WIN = process.platform === 'win32';

function checkRtk() {
  if (!onPath('rtk')) return {
    status: WARN,
    detail: 'RTK not installed (input savings inactive)',
    fix: IS_WIN
      ? 'kodelythecc rtk install  (installs to %LOCALAPPDATA%\\Kodelyth\\bin — add it to PATH)'
      : 'kodelythecc rtk install',
  };
  try {
    const v = execFileSync('rtk', ['--version'], { encoding: 'utf8' }).trim();
    return { status: PASS, detail: `${v} installed`, };
  } catch { return { status: WARN, detail: 'rtk present but --version failed' }; }
}

function checkTerse() {
  const skill = path.join(HOME, '.claude', 'skills', 'terse-mode', 'SKILL.md');
  if (!fs.existsSync(skill)) return { status: WARN, detail: 'terse-mode skill not installed', fix: 'kodelythecc terse enable' };
  return { status: PASS, detail: 'terse-mode skill installed (activate with /terse)' };
}

function checkCodebaseGraph() {
  if (!onPath('codebase-memory-mcp')) return {
    status: WARN,
    detail: 'codebase graph not installed (optional)',
    fix: IS_WIN
      ? 'kodelythecc codebase install  (installs to %LOCALAPPDATA%\\Kodelyth\\bin — add it to PATH)'
      : 'kodelythecc codebase install',
  };
  return { status: PASS, detail: 'codebase-memory-mcp installed' };
}

// ── Config drift ─────────────────────────────────────────────────────────────
//
// The update check answers "is the npm PACKAGE behind the registry?". It says
// nothing about whether the config in ~/.claude (hooks, agents, skills, rules)
// is behind the package. Those drift apart the moment someone runs
// `npm i -g kodelyth-ecc` without re-running the installer: the package jumps
// forward, ~/.claude stays frozen at whatever version last wrote it. That is
// exactly how a hooks.json from v2.30.0 kept running a superseded hook while the
// package was six patch versions ahead — invisible to every existing check.
//
// install.sh and install.ps1 both already stamp the installing version into
// <target>/kodelyth-ecc-install-state.json, but until now nothing read it back.
// This check closes that loop. No network: the comparison is the installed
// config's version against this package's version, both read from disk.

// Self-contained major.minor.patch compare. doctor must run even when sibling
// modules fail to load, so this is local rather than imported from update-check.
function cmpSemver(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

/**
 * Pure drift decision, separated from file I/O so it can be unit-tested without
 * a home directory. Given the version that last wrote ~/.claude config and the
 * current package version, decide whether the installed config has drifted.
 */
function configDriftStatus({ installedVersion, packageVersion, installedAt } = {}) {
  if (!installedVersion) {
    return {
      status: WARN,
      detail: 'install-state has no version — ~/.claude config predates version tracking',
      fix: 'kodelythecc --target claude-code    installs config and starts tracking its version',
    };
  }
  if (!packageVersion) {
    return { status: WARN, detail: `config installed from v${installedVersion}; current package version unknown` };
  }
  const delta = cmpSemver(installedVersion, packageVersion);
  if (delta < 0) {
    const when = installedAt ? ` on ${installedAt}` : '';
    return {
      status: WARN,
      detail: `~/.claude config was installed from v${installedVersion}${when}; package is now v${packageVersion} — installed hooks, agents, skills and rules may be stale`,
      fix: `kodelythecc --target claude-code    refreshes ~/.claude to v${packageVersion}`,
    };
  }
  if (delta > 0) {
    return {
      status: WARN,
      detail: `~/.claude config is from v${installedVersion}, newer than the running package v${packageVersion}`,
      fix: 'npm i -g kodelyth-ecc    to bring the package up to the config it was installed from',
    };
  }
  return { status: PASS, detail: `~/.claude config in sync with package (v${packageVersion})` };
}

function checkConfigDrift() {
  const stateFile = path.join(HOME, '.claude', 'kodelyth-ecc-install-state.json');
  if (!fs.existsSync(stateFile)) {
    return {
      status: WARN,
      detail: 'no install-state in ~/.claude — config never installed, or predates version tracking',
      fix: 'kodelythecc --target claude-code    installs config and records its version',
    };
  }
  let state;
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); }
  catch { return { status: WARN, detail: 'install-state file is not valid JSON', fix: 'kodelythecc --target claude-code    to rewrite it' }; }

  let packageVersion = null;
  try { packageVersion = require(path.join(ROOT, 'package.json')).version; }
  catch {
    try { packageVersion = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim(); } catch { /* unknown */ }
  }

  return configDriftStatus({
    installedVersion: state && typeof state.version === 'string' ? state.version.trim() : null,
    packageVersion,
    installedAt: state && typeof state.installed_at === 'string' ? state.installed_at : null,
  });
}

// ── Runner ───────────────────────────────────────────────────────────────────

/**
 * Whether the installed version is current.
 *
 * Takes a pre-fetched result rather than doing its own network call, so run()
 * stays synchronous and testable, and doctor never blocks on the registry. When
 * nothing was fetched — offline, timed out, caller did not bother — this is
 * silently absent rather than a warning. "Could not reach npm" is not a health
 * problem with the user's install, and reporting it as one trains people to
 * ignore the output.
 */
function checkVersion(update) {
  if (!update || !update.latest) return null;
  if (!update.updateAvailable) {
    return { status: PASS, detail: `v${update.current} is the latest` };
  }
  return {
    status: WARN,
    detail: `v${update.current} installed, v${update.latest} available`,
    fix: `npm i -g kodelyth-ecc    what changed: ${update.releaseNotes || 'github.com/sifxprime/kodelyth-ecc/releases'}`,
  };
}

function run({ update } = {}) {
  const checks = [
    check('binaries',            checkBinaries),
    check('install-target',      checkInstallTarget),
    check('hooks-registered',    checkHooksRegistered),
    check('config-drift',        checkConfigDrift),
    check('memory-recall',       checkMemoryRecall),
    check('memory-index',        checkMemoryIndex),
    check('mcp-registered',      checkMcpRegistered),
    check('mcp-server-boots',    checkMcpBoots),
    check('prompt-injection',    checkPromptInjectionGuard),
    check('rtk',                 checkRtk),
    check('terse',               checkTerse),
    check('codebase-graph',      checkCodebaseGraph),
  ];

  // Appended rather than inlined: it is the only check that depends on the
  // network, and it drops out entirely when no result was supplied.
  const version = checkVersion(update);
  if (version) checks.push({ id: 'version', ...version });
  const summary = {
    total: checks.length,
    pass: checks.filter(c => c.status === PASS).length,
    warn: checks.filter(c => c.status === WARN).length,
    fail: checks.filter(c => c.status === FAIL).length,
  };
  return { checks, summary };
}

module.exports = { run, checkVersion, configDriftStatus, cmpSemver, PASS, WARN, FAIL };
