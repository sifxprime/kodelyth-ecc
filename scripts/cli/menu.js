// scripts/cli/menu.js
// Interactive arrow-key CLI menu. Zero deps. Uses raw stdin + ANSI escapes.
// Triggered when `kodelythecc` is run with no args in a TTY.

'use strict';

const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

// ── ANSI helpers (no chalk dep) ─────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  dim:    '\x1b[2m',
  bold:   '\x1b[1m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  magenta:'\x1b[35m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
  invert: '\x1b[7m',
};

function clear()       { process.stdout.write('\x1b[2J\x1b[H'); }
function hideCursor()  { process.stdout.write('\x1b[?25l'); }
function showCursor()  { process.stdout.write('\x1b[?25h'); }
function moveTo(row)   { process.stdout.write(`\x1b[${row};1H`); }

// ── Build the menu options dynamically ──────────────────────────────────────
async function buildOptions({ ROOT }) {
  const pkg = require(path.join(ROOT, 'package.json'));
  const current = pkg.version;

  // Update check — fires async, doesn't block the menu.
  const { check } = require('./update-check.js');
  const updateP = check({ current }).catch(() => ({ updateAvailable: false, latest: null }));

  // Wait max 1s for the update check to return (so first render isn't a full 2.5s wait)
  const update = await Promise.race([
    updateP,
    new Promise(r => setTimeout(() => r({ updateAvailable: false, latest: null, pending: true }), 1000)),
  ]);

  const opts = [];
  if (update.updateAvailable) {
    opts.push({
      label: `Update to v${update.latest}`,
      hint:  'npm i -g kodelyth-ecc  (installs new version)',
      run:   () => runUpdate(),
      badge: 'NEW',
    });
  }
  opts.push({
    label: 'Open Dashboard',
    hint:  'localhost observability — RTK, Terse, Codebase, Memory (all real data)',
    run:   () => runDashboard(),
  });
  opts.push({
    label: 'Install ECC for another IDE',
    hint:  'claude-code, cursor, windsurf, antigravity, codex, opencode, gemini, cline, roocode, kimi',
    run:   () => pickIdeAndInstall(ROOT),
  });
  opts.push({
    label: 'RTK status (input token savings)',
    hint:  'Show RTK version + wired IDEs + savings',
    run:   () => runSub(['rtk', 'status']),
  });
  opts.push({
    label: 'Terse status (output compression)',
    hint:  'Skill install state, ledger totals',
    run:   () => runSub(['terse', 'status']),
  });
  opts.push({
    label: 'Codebase graph status',
    hint:  'codebase-memory-mcp (DeusData) — 158 languages, structural queries',
    run:   () => runSub(['codebase', 'status']),
  });
  opts.push({
    label: 'Health check (doctor)',
    hint:  'Live check every subsystem is actually wired — catches silent breakage',
    run:   () => runSub(['doctor']),
  });
  opts.push({
    label: 'Memory stats (BM25 recall)',
    hint:  'Local BM25 memory — captures, projects, top tags',
    run:   () => runSub(['dashboard', '--port', '5747', '--no-open']),
    background: true,
    backgroundNote: 'Dashboard started at http://127.0.0.1:5747 — visit for full stats. Ctrl+C in this menu to stop watching.',
  });
  opts.push({
    label: 'Run in background (dashboard + hooks live)',
    hint:  'Detach dashboard as a daemon so /api routes stay reachable',
    run:   () => runBackground(),
  });
  opts.push({
    label: 'Uninstall ECC completely',
    hint:  'Remove agents/skills/commands/hooks, RTK hook, codebase-mcp, and ~/.kodelythecc/',
    run:   () => runUninstall(ROOT),
  });
  opts.push({
    label: 'Exit',
    hint:  '',
    run:   () => process.exit(0),
    exit:  true,
  });

  return { opts, current, update };
}

// ── Actions ─────────────────────────────────────────────────────────────────
function runUpdate() {
  cleanup();
  console.log(`${C.cyan}Running: npm install -g kodelyth-ecc${C.reset}\n`);
  const r = spawnSync('npm', ['install', '-g', 'kodelyth-ecc'], { stdio: 'inherit' });
  process.exit(r.status ?? 0);
}

function runDashboard() {
  cleanup();
  console.log(`${C.cyan}Booting dashboard on http://127.0.0.1:5747${C.reset}`);
  console.log(`${C.gray}(Ctrl+C to stop)${C.reset}\n`);
  const r = spawnSync(process.execPath, [
    path.join(__dirname, '..', '..', 'bin', 'kodelyth-ecc.js'),
    'dashboard'
  ], { stdio: 'inherit' });
  process.exit(r.status ?? 0);
}

function runSub(args) {
  cleanup();
  const r = spawnSync(process.execPath, [
    path.join(__dirname, '..', '..', 'bin', 'kodelyth-ecc.js'),
    ...args,
  ], { stdio: 'inherit' });
  console.log(`\n${C.gray}Press Enter to return to menu…${C.reset}`);
  waitForEnter().then(() => main().catch(() => process.exit(0)));
}

async function pickIdeAndInstall(ROOT) {
  const targets = [
    'claude-code', 'cursor-project', 'windsurf-home', 'windsurf-project',
    'antigravity', 'codex-home', 'opencode', 'cline', 'roocode',
    'gemini-home', 'gemini-project', 'kimi', 'aider',
  ];
  const chosen = await pick('Pick an IDE to install for', targets);
  if (chosen == null) return main();
  cleanup();
  console.log(`${C.cyan}Installing ECC for ${targets[chosen]}…${C.reset}\n`);
  const r = spawnSync(process.execPath, [
    path.join(ROOT, 'bin', 'kodelyth-ecc.js'),
    '--target', targets[chosen],
  ], {
    stdio: 'inherit',
    env: { ...process.env, KODELYTH_NONINTERACTIVE: '1' },
  });
  console.log(`\n${C.gray}Press Enter to return to menu…${C.reset}`);
  waitForEnter().then(() => main().catch(() => process.exit(0)));
}

async function runUninstall(ROOT) {
  cleanup();
  console.log(`${C.red}${C.bold}⚠  Uninstall Kodelyth ECC${C.reset}`);
  console.log('');
  console.log('This will remove:');
  console.log(`  ${C.gray}·${C.reset} All ECC agents/skills/commands/hooks/rules installed under ~/.claude/`);
  console.log(`  ${C.gray}·${C.reset} RTK hook (rtk binary stays — remove with brew uninstall rtk)`);
  console.log(`  ${C.gray}·${C.reset} codebase-memory-mcp agent configs (binary stays)`);
  console.log(`  ${C.gray}·${C.reset} ECC MCP server entry from Claude Code + Claude Desktop`);
  console.log(`  ${C.gray}·${C.reset} ~/.kodelythecc/ (memory, ledgers, cache) — unless you keep it`);
  console.log('');
  const choice = await pick('Confirm', [
    'Uninstall — remove EVERYTHING including memory',
    'Uninstall — keep ~/.kodelythecc/ memory + ledgers',
    'Dry run — show what would be removed, change nothing',
    'Cancel',
  ]);
  if (choice == null || choice === 3) return main();
  const dryRun = choice === 2;
  const keepMemory = choice === 1;
  cleanup();
  console.log('');
  const un = require(path.join(ROOT, 'scripts', 'cli', 'uninstall.js'));
  const r = un.run({ log: (m) => console.log(m), dryRun, keepMemory });
  console.log('');
  console.log(`${C.green}✓${C.reset} Removed ${C.bold}${r.removed_files}${C.reset} files across ${r.subsystems_uninstalled.length} subsystems.`);
  if (r.errors.length) console.log(`${C.yellow}Errors: ${r.errors.length}${C.reset}`);
  if (dryRun) {
    console.log(`${C.dim}(dry-run — nothing was changed)${C.reset}`);
  } else {
    console.log('');
    console.log(`Finish by removing the npm package: ${C.cyan}npm uninstall -g kodelyth-ecc${C.reset}`);
  }
  process.exit(0);
}

function runBackground() {
  cleanup();
  const logDir = path.join(os.homedir(), '.kodelythecc');
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, 'dashboard-daemon.log');
  const pidFile = path.join(logDir, 'dashboard-daemon.pid');
  const child = spawn(process.execPath, [
    path.join(__dirname, '..', '..', 'bin', 'kodelyth-ecc.js'),
    'dashboard', '--port', '5747', '--no-open',
  ], {
    detached: true, stdio: ['ignore', fs.openSync(logFile, 'a'), fs.openSync(logFile, 'a')],
  });
  child.unref();
  fs.writeFileSync(pidFile, String(child.pid));
  console.log(`${C.green}✓${C.reset} Dashboard daemon started (pid ${child.pid})`);
  console.log(`  URL:    ${C.cyan}http://127.0.0.1:5747${C.reset}`);
  console.log(`  Log:    ${logFile}`);
  console.log(`  Pid:    ${pidFile}`);
  console.log(`  Stop:   ${C.dim}kill $(cat ${pidFile})${C.reset}`);
  process.exit(0);
}

// ── Render + keyboard loop ──────────────────────────────────────────────────
let _keyHandler = null;
function cleanup() {
  showCursor();
  try { process.stdin.setRawMode(false); } catch {}
  try { process.stdin.pause(); } catch {}
  if (_keyHandler) { process.stdin.removeListener('data', _keyHandler); _keyHandler = null; }
}
process.on('exit', cleanup);
process.on('SIGINT',  () => { cleanup(); console.log(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

function render({ current, update, opts, index }) {
  clear();
  const w = process.stdout.columns || 80;
  const bar = '─'.repeat(Math.max(20, w - 4));
  let updateLine = C.gray + 'up to date' + C.reset;
  if (update?.pending)         updateLine = C.dim + 'checking npm registry…' + C.reset;
  else if (update?.updateAvailable) updateLine = C.yellow + `${C.bold}update available: v${update.latest}${C.reset}`;
  else if (update?.latest && update.latest !== current) updateLine = C.gray + `latest: v${update.latest}` + C.reset;

  console.log(`${C.cyan}${C.bold}⚙ Kodelyth ECC${C.reset}  ${C.gray}v${current}${C.reset}  ${C.dim}·${C.reset}  ${C.magenta}Elite Code Crew${C.reset}   ${updateLine}`);
  console.log(`${C.gray}${bar}${C.reset}`);
  console.log('');

  for (let i = 0; i < opts.length; i++) {
    const o = opts[i];
    const active = i === index;
    const marker = active ? `${C.cyan} ▸ ${C.reset}` : '   ';
    const label  = active ? `${C.bold}${o.label}${C.reset}` : o.label;
    const hint   = o.hint ? `${C.gray}${o.hint}${C.reset}` : '';
    const badge  = o.badge ? ` ${C.yellow}[${o.badge}]${C.reset}` : '';
    // Two columns: label (36 wide) then hint.
    const labelText = (active ? '▸ ' : '  ') + o.label + (o.badge ? ` [${o.badge}]` : '');
    const pad = ' '.repeat(Math.max(2, 40 - labelText.length));
    const colored = active
      ? `${C.cyan} ▸ ${C.bold}${o.label}${C.reset}${badge}${pad}${hint}`
      : `   ${o.label}${badge}${pad}${hint}`;
    console.log(colored);
  }
  console.log('');
  console.log(`${C.gray}↑/↓ navigate  ·  ⏎ select  ·  q / esc / Ctrl+C to quit${C.reset}`);
}

async function pick(title, items) {
  return new Promise((resolve) => {
    let idx = 0;
    const draw = () => {
      clear();
      console.log(`${C.cyan}${C.bold}${title}${C.reset}\n`);
      for (let i = 0; i < items.length; i++) {
        console.log(i === idx ? `${C.cyan} ▸ ${C.bold}${items[i]}${C.reset}` : `   ${items[i]}`);
      }
      console.log(`\n${C.gray}↑/↓ move · ⏎ pick · esc / q cancel${C.reset}`);
    };
    hideCursor();
    process.stdin.setRawMode(true); process.stdin.resume();
    draw();
    const h = (b) => {
      const s = b.toString();
      if (s === '\x1b[A' || s === 'k') { idx = (idx - 1 + items.length) % items.length; draw(); }
      else if (s === '\x1b[B' || s === 'j') { idx = (idx + 1) % items.length; draw(); }
      else if (s === '\r' || s === '\n') {
        process.stdin.removeListener('data', h); resolve(idx);
      } else if (s === 'q' || s === '\x1b' || s === '\x03') {
        process.stdin.removeListener('data', h); resolve(null);
      }
    };
    process.stdin.on('data', h);
  });
}

function waitForEnter() {
  return new Promise((resolve) => {
    process.stdin.setRawMode(true); process.stdin.resume();
    const h = (b) => {
      const s = b.toString();
      if (s === '\r' || s === '\n' || s === 'q' || s === '\x1b' || s === '\x03') {
        process.stdin.removeListener('data', h); resolve();
      }
    };
    process.stdin.on('data', h);
  });
}

// ── Main loop ───────────────────────────────────────────────────────────────
async function main() {
  const ROOT = path.join(__dirname, '..', '..');
  const { opts, current, update } = await buildOptions({ ROOT });
  let index = 0;
  hideCursor();
  process.stdin.setRawMode(true);
  process.stdin.resume();
  render({ current, update, opts, index });

  _keyHandler = (buf) => {
    const s = buf.toString();
    if (s === '\x1b[A' || s === 'k') { index = (index - 1 + opts.length) % opts.length; render({ current, update, opts, index }); }
    else if (s === '\x1b[B' || s === 'j') { index = (index + 1) % opts.length; render({ current, update, opts, index }); }
    else if (s === '\r' || s === '\n') {
      const chosen = opts[index];
      process.stdin.removeListener('data', _keyHandler);
      _keyHandler = null;
      Promise.resolve(chosen.run()).catch(err => {
        cleanup();
        console.error(err.message || err);
        process.exit(1);
      });
    }
    else if (s === 'q' || s === '\x1b' || s === '\x03') { cleanup(); console.log(); process.exit(0); }
  };
  process.stdin.on('data', _keyHandler);
}

module.exports = { main };
