#!/usr/bin/env node
// =============================================================================
// Kodelyth ECC — Token Budget Enforcer
//
// A safety hook that tracks per-session token usage and blocks new turns once
// a configurable budget is exceeded. Wires into:
//
//   - Stop          (after each AI response — accumulate usage, write state)
//   - SessionStart  (before each new turn — block if budget already exhausted)
//
// Token estimation:
//   Hooks don't get authoritative token counts from the platform, so we use
//   a 4-chars-per-token heuristic over the visible transcript path supplied
//   in the Stop payload (transcript_path). On UserPromptSubmit we also count
//   the user message; on PostToolUse we count the tool response.
//
// Modes (env var KODELYTH_TOKEN_BUDGET):
//   off        — never run (default if unset)
//   warn       — exit 0; write usage to stderr; never block
//   <number>   — hard budget in tokens (e.g. 200000). Warns at WARN_AT_PCT.
//                Blocks SessionStart once usage >= budget.
//
// Optional knobs:
//   KODELYTH_TOKEN_BUDGET_DIR=/custom/path   default ~/.kodelyth/safety
//   KODELYTH_TOKEN_BUDGET_WARN=0.7           warn threshold (0-1, default 0.7)
//   KODELYTH_TOKEN_BUDGET_RESET=1            wipe usage and exit (admin op)
//
// Always exits 0 on internal errors so the hook never blocks accidentally.
// =============================================================================

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const RAW_BUDGET = String(process.env.KODELYTH_TOKEN_BUDGET || 'off').toLowerCase();
const WARN_PCT   = Math.max(0, Math.min(1, Number(process.env.KODELYTH_TOKEN_BUDGET_WARN) || 0.7));
const RESET      = !!process.env.KODELYTH_TOKEN_BUDGET_RESET;

const STATE_DIR = process.env.KODELYTH_TOKEN_BUDGET_DIR
  || path.join(os.homedir(), '.kodelyth', 'safety');

function safeExit(code) {
  try { process.stdout.write(''); } catch {}
  process.exit(code);
}

function readStdinSync() {
  try {
    const chunks = [];
    const tmp = Buffer.alloc(64 * 1024);
    while (true) {
      let n;
      try { n = fs.readSync(0, tmp, 0, tmp.length, null); }
      catch { break; }
      if (!n) break;
      chunks.push(Buffer.from(tmp.subarray(0, n)));
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch {
    return '';
  }
}

function loadState(sessionId) {
  try {
    const file = path.join(STATE_DIR, `budget-${sessionId}.json`);
    if (!fs.existsSync(file)) return { tokens: 0, turns: 0 };
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { tokens: 0, turns: 0 };
  }
}

function saveState(sessionId, state) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    const file = path.join(STATE_DIR, `budget-${sessionId}.json`);
    fs.writeFileSync(file, JSON.stringify(state, null, 2));
  } catch { /* never block on persistence */ }
}

function resetState(sessionId) {
  try {
    const file = path.join(STATE_DIR, `budget-${sessionId}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {}
}

// ── Token estimation ─────────────────────────────────────────────────────────
// Rough heuristic — 1 token ≈ 4 characters. Good enough for budget guards.
function estimateTokensFromChars(s) {
  if (typeof s !== 'string' || !s) return 0;
  return Math.ceil(s.length / 4);
}

function estimateTokensFromTranscript(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return 0;
  try {
    if (!fs.existsSync(transcriptPath)) return 0;
    const stat = fs.statSync(transcriptPath);
    // Each transcript line is JSON with `text` fields. We approximate by
    // file size (proxy for transcript length); rough but stable.
    return Math.ceil(stat.size / 4);
  } catch {
    return 0;
  }
}

function parseBudget() {
  if (RAW_BUDGET === 'off') return { mode: 'off', limit: 0 };
  if (RAW_BUDGET === 'warn') return { mode: 'warn', limit: 0 };
  const n = Number(RAW_BUDGET);
  if (Number.isFinite(n) && n > 0) return { mode: 'block', limit: Math.floor(n) };
  return { mode: 'off', limit: 0 };
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const cfg = parseBudget();
  if (cfg.mode === 'off') return safeExit(0);

  let raw = '';
  try { raw = readStdinSync(); } catch { return safeExit(0); }

  let payload = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch { payload = null; }

  // Echo stdin so chained hooks still see it.
  if (raw) process.stdout.write(raw);
  if (!payload) return safeExit(0);

  const sessionId =
    payload.session_id ||
    payload.sessionId  ||
    process.env.CLAUDE_SESSION_ID ||
    'default';

  if (RESET) {
    resetState(sessionId);
    process.stderr.write(`[Kodelyth Safety] token-budget reset for session ${sessionId}\n`);
    return safeExit(0);
  }

  const event = payload.hook_event_name || '';

  // ── SessionStart: pre-check, block if already over ─────────────────────────
  if (/SessionStart/i.test(event)) {
    const state = loadState(sessionId);
    if (cfg.mode === 'block' && state.tokens >= cfg.limit) {
      process.stderr.write(
        `\n[Kodelyth Safety] BLOCKED — session token budget exhausted.\n` +
        `  session=${sessionId}\n` +
        `  used=${state.tokens.toLocaleString()} tokens\n` +
        `  budget=${cfg.limit.toLocaleString()} tokens\n` +
        `  • Reset with KODELYTH_TOKEN_BUDGET_RESET=1.\n` +
        `  • Raise budget via KODELYTH_TOKEN_BUDGET=<larger number>.\n` +
        `  • Disable entirely via KODELYTH_TOKEN_BUDGET=off.\n\n`
      );
      return safeExit(2);
    }
    if (cfg.mode === 'warn' || cfg.mode === 'block') {
      process.stderr.write(
        `[Kodelyth Safety] token-budget — session=${sessionId} ` +
        `used=${state.tokens.toLocaleString()} ` +
        (cfg.mode === 'block' ? `budget=${cfg.limit.toLocaleString()}` : '(warn-only)') +
        `\n`
      );
    }
    return safeExit(0);
  }

  // ── Stop: accumulate usage from transcript path ────────────────────────────
  if (/Stop/i.test(event) || event === 'PostToolUse' || event === 'UserPromptSubmit' || event === '') {
    const state = loadState(sessionId);
    let added = 0;
    if (typeof payload.prompt === 'string')        added += estimateTokensFromChars(payload.prompt);
    if (typeof payload.user_message === 'string')  added += estimateTokensFromChars(payload.user_message);
    if (typeof payload.message === 'string')       added += estimateTokensFromChars(payload.message);
    if (payload.transcript_path)                   added  = Math.max(added, estimateTokensFromTranscript(payload.transcript_path));
    if (payload.tool_response) {
      try { added += estimateTokensFromChars(JSON.stringify(payload.tool_response)); } catch {}
    }
    if (added > 0) {
      state.tokens = (state.tokens || 0) + added;
      state.turns  = (state.turns  || 0) + 1;
      state.last_updated = new Date().toISOString();
      saveState(sessionId, state);
    }

    if (cfg.mode === 'block') {
      const pct = state.tokens / cfg.limit;
      if (pct >= 1) {
        process.stderr.write(
          `\n[Kodelyth Safety] token-budget EXCEEDED — ` +
          `used=${state.tokens.toLocaleString()} budget=${cfg.limit.toLocaleString()}. ` +
          `Next SessionStart will be blocked. Use KODELYTH_TOKEN_BUDGET_RESET=1 to clear.\n`
        );
      } else if (pct >= WARN_PCT) {
        process.stderr.write(
          `[Kodelyth Safety] token-budget at ${(pct * 100).toFixed(0)}% — ` +
          `used=${state.tokens.toLocaleString()} budget=${cfg.limit.toLocaleString()}\n`
        );
      }
    } else {
      process.stderr.write(
        `[Kodelyth Safety] token-budget (warn) — session=${sessionId} ` +
        `used=${state.tokens.toLocaleString()} added=${added.toLocaleString()}\n`
      );
    }
  }

  return safeExit(0);
}

if (require.main === module) {
  try { main(); } catch { safeExit(0); }
}

module.exports = {
  // Exposed for tests
  estimateTokensFromChars,
  estimateTokensFromTranscript,
  parseBudget,
  loadState,
  saveState,
  resetState,
};
