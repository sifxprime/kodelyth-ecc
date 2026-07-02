// =============================================================================
// Kodelyth ECC — Token-Saver Command Proxy (RTK-style)
//
// Wraps common READ-ONLY dev commands. The raw output goes to the user's
// terminal; a token-lean summary is what would go to the model. We measure
// both and log the delta.
//
// SAFETY: strict allowlist. No write commands are ever proxied. If a caller
// asks for `git commit`, `rm`, `npm install`, etc., we refuse.
//
// Public API:
//   proxy(cmd, args, opts?)  → { stdout, leanStdout, saved: {raw, lean, saved, ratio} }
//   isAllowed(cmd, args)     → boolean
//   compress(rawStdout, cmd) → string (lean output)
// =============================================================================

'use strict';

const { spawnSync } = require('child_process');
const path   = require('path');

const counter = require('./count');
const ledger  = require('./ledger');

// ── Allowlist — read-only only ──────────────────────────────────────────────
const ALLOW = {
  git: {
    subs: new Set([
      'status', 'log', 'diff', 'show', 'branch', 'remote', 'blame',
      'ls-files', 'ls-tree', 'rev-parse', 'reflog', 'stash', 'shortlog',
      'describe', 'name-rev',
    ]),
    // Even inside allowed subs, block flags that alter state.
    blockFlags: new Set(['--force', '--reset', '--delete', '-D', '--hard']),
  },
  ls:   { anySub: true, blockFlags: new Set() },
  cat:  { anySub: true, blockFlags: new Set() },
  head: { anySub: true, blockFlags: new Set() },
  tail: { anySub: true, blockFlags: new Set() },
  grep: { anySub: true, blockFlags: new Set() },
  find: { anySub: true, blockFlags: new Set(['-delete', '-exec']) },
  tree: { anySub: true, blockFlags: new Set() },
  wc:   { anySub: true, blockFlags: new Set() },
  npm:  { subs: new Set(['ls', 'view', 'outdated', 'audit', 'doctor', 'why']), blockFlags: new Set() },
  pnpm: { subs: new Set(['list', 'why', 'outdated', 'audit', 'doctor']), blockFlags: new Set() },
  yarn: { subs: new Set(['list', 'why', 'outdated', 'audit']), blockFlags: new Set() },
  node: { subs: new Set(['--version', '-v']), blockFlags: new Set() },
  ps:   { anySub: true, blockFlags: new Set(['-e', '-ef', '-A']) },
};

// ── Public: allowlist check ─────────────────────────────────────────────────
function isAllowed(cmd, args = []) {
  const base = path.basename(String(cmd || ''));
  const rule = ALLOW[base];
  if (!rule) return { ok: false, reason: `command not in allowlist: ${base}` };

  const sub = args[0] || '';
  if (!rule.anySub && !rule.subs.has(sub)) {
    return { ok: false, reason: `subcommand not allowed: ${base} ${sub}` };
  }
  for (const flag of args) {
    if (rule.blockFlags.has(flag)) {
      return { ok: false, reason: `flag not allowed: ${flag}` };
    }
  }
  return { ok: true };
}

// ── Compression heuristics (per-command) ────────────────────────────────────
// Each compressor takes raw stdout and returns a token-lean equivalent that
// preserves meaningful information (paths, hashes, states) but strips
// decoration, banners, and repetition.

function compressGeneric(raw) {
  const lines = String(raw).split('\n');
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const t = line.trimEnd();
    if (!t) { continue; }
    // Drop pure separator lines and repeated blank sequences
    if (/^[-=_*]{4,}$/.test(t)) continue;
    if (seen.has(t) && t.length < 40) continue;
    seen.add(t);
    out.push(t);
  }
  return out.join('\n');
}

function compressGitStatus(raw) {
  const lines = String(raw).split('\n');
  const out = [];
  for (const line of lines) {
    // Skip help hints from `git status`
    if (/^\s*\(use "git .+ to /.test(line)) continue;
    if (/^Untracked files:$|^Changes not staged for commit:$|^Changes to be committed:$|^On branch/i.test(line)) {
      out.push(line.trim());
      continue;
    }
    if (line.trim()) out.push(line.trimEnd());
  }
  return out.join('\n');
}

function compressGitLog(raw) {
  const commits = String(raw).split(/\ncommit /).filter(Boolean);
  const out = [];
  for (const c of commits) {
    const lines = c.split('\n');
    const hash = lines[0].startsWith('commit ') ? lines[0].slice(7) : lines[0];
    const short = hash.slice(0, 8);
    const author = (lines.find(l => l.startsWith('Author:')) || '').replace('Author:', '').split('<')[0].trim();
    const dateLn = (lines.find(l => l.startsWith('Date:')) || '').replace('Date:', '').trim();
    const date   = dateLn.split(' ').slice(0, 4).join(' ');
    const msg    = (lines.find(l => l.startsWith('    ')) || '').trim();
    out.push(`${short}  ${date}  ${author}  ${msg}`);
  }
  return out.join('\n');
}

function compressLs(raw) {
  const lines = String(raw).split('\n').filter(Boolean);
  // Drop the "total N" prefix and per-file metadata; keep just names.
  const out = [];
  for (const line of lines) {
    if (/^total\s+\d+/.test(line)) continue;
    // If it's a long-format line (starts with dr / -rw), drop meta cols
    const cols = line.trim().split(/\s+/);
    if (cols.length >= 9 && /^[-dl]/.test(cols[0])) {
      out.push(cols.slice(8).join(' '));
    } else {
      out.push(line.trim());
    }
  }
  return out.join('\n');
}

function compressGrep(raw) {
  // grep is usually already lean — just strip identical repeated hits.
  return compressGeneric(raw);
}

function compressNpmLs(raw) {
  const lines = String(raw).split('\n');
  const out = [];
  for (const line of lines) {
    // Drop depth markers and empty
    const t = line.replace(/^[│├└─\s]+/g, '').trim();
    if (t) out.push(t);
  }
  return out.join('\n');
}

function pickCompressor(cmd, args) {
  const base = path.basename(String(cmd));
  if (base === 'git' && args[0] === 'status') return compressGitStatus;
  if (base === 'git' && args[0] === 'log')    return compressGitLog;
  if (base === 'ls')                          return compressLs;
  if (base === 'grep')                        return compressGrep;
  if (base === 'npm'  && args[0] === 'ls')    return compressNpmLs;
  if (base === 'pnpm' && args[0] === 'list')  return compressNpmLs;
  return compressGeneric;
}

// ── Public: proxy execution ─────────────────────────────────────────────────
function proxy(cmd, args = [], opts = {}) {
  const check = isAllowed(cmd, args);
  if (!check.ok) {
    return {
      allowed: false,
      reason:  check.reason,
      stdout:  '',
      leanStdout: '',
      saved: { raw: 0, lean: 0, saved: 0, ratio: 0 },
    };
  }

  const cwd = opts.cwd || process.cwd();
  const timeoutMs = Number(opts.timeoutMs) || 15000;
  const result = spawnSync(cmd, args, {
    cwd,
    timeout: timeoutMs,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  const raw = (result.stdout || '') + (result.stderr || '');

  const compressor = pickCompressor(cmd, args);
  const lean = compressor(raw);
  const saved = counter.measureSavings(raw, lean);

  ledger.append({
    source:  'proxy',
    project: opts.project || cwd,
    command: `${cmd} ${args.join(' ')}`.trim(),
    raw:  saved.raw,
    lean: saved.lean,
    saved: saved.saved,
    ratio: saved.ratio,
    meta: { exit: result.status },
  });

  return {
    allowed: true,
    exitCode: result.status,
    stdout:  raw,
    leanStdout: lean,
    saved,
    command: `${cmd} ${args.join(' ')}`.trim(),
  };
}

module.exports = { proxy, isAllowed, pickCompressor, ALLOW };
