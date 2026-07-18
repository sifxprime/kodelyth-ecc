#!/usr/bin/env node
// =============================================================================
// Kodelyth ECC — Prompt Injection Guard
//
// A safety hook that scans inbound text for jailbreak / instruction-override
// patterns BEFORE the model sees it. Wires into two Claude Code hook events:
//
//   - UserPromptSubmit              (scans the user's outbound message)
//   - PostToolUse on Read|WebFetch|mcp__*  (scans tool responses for indirect
//                                           injection from external content)
//
// Modes (env var KODELYTH_PI_GUARD):
//   off    — never run
//   warn   — exit 0 always; print findings to stderr (visible in transcript)
//   block  — exit 2 (block) on critical; warn on high; pass on medium
//
// Optional knobs:
//   KODELYTH_PI_GUARD_LOG=/path/to/log.jsonl   append findings as JSONL
//   KODELYTH_PI_GUARD_MAX_INPUT=20000          truncate input before scan
//
// Always exits 0 on internal errors so the hook never blocks accidentally.
// =============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');

const { scan, maxSeverity } = require('./lib/patterns');

// Default is 'warn' (v2.4.4+): the guard scans and surfaces findings to stderr
// but NEVER blocks — exit 0 always. This makes the safety feature actually run
// on a fresh install instead of being a silent no-op. Measured 0 false positives
// on realistic legit prompts. Set KODELYTH_PI_GUARD=off to silence entirely, or
// =block to hard-block on critical patterns (opt-in, can halt on false positives).
const MODE = String(process.env.KODELYTH_PI_GUARD || 'warn').toLowerCase();
const MAX_INPUT = Number(process.env.KODELYTH_PI_GUARD_MAX_INPUT || 20000);
const LOG_PATH = process.env.KODELYTH_PI_GUARD_LOG || null;

function safeExit(code) {
  try { process.stdout.write(''); } catch {}
  process.exit(code);
}

function appendLog(record) {
  if (!LOG_PATH) return;
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify(record) + '\n');
  } catch { /* never block on logging */ }
}

// ── Read the hook payload from stdin ─────────────────────────────────────────
function readStdinSync() {
  try {
    const chunks = [];
    let buf;
    // Node 18+: readSync of stdin in blocking mode.
    const fd = 0;
    const tmp = Buffer.alloc(64 * 1024);
    while (true) {
      let n;
      try { n = fs.readSync(fd, tmp, 0, tmp.length, null); }
      catch { break; }
      if (!n) break;
      chunks.push(Buffer.from(tmp.subarray(0, n)));
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch {
    return '';
  }
}

// ── Extract scannable text from a hook payload ───────────────────────────────
function extractTextFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const buckets = [];

  // Common payload shapes across Claude Code hooks:
  // - UserPromptSubmit:  { prompt: "..." } or { user_message: "..." }
  // - PostToolUse:       { tool_name, tool_response: { content: [...] } }
  // - Generic fallback:  any string anywhere

  if (typeof payload.prompt === 'string')        buckets.push(payload.prompt);
  if (typeof payload.user_message === 'string')  buckets.push(payload.user_message);
  if (typeof payload.message === 'string')       buckets.push(payload.message);

  if (payload.tool_response) {
    const tr = payload.tool_response;
    if (typeof tr === 'string') buckets.push(tr);
    if (Array.isArray(tr.content)) {
      for (const c of tr.content) {
        if (typeof c === 'string') buckets.push(c);
        else if (c && typeof c.text === 'string') buckets.push(c.text);
      }
    } else if (typeof tr.text === 'string') {
      buckets.push(tr.text);
    } else if (typeof tr.output === 'string') {
      buckets.push(tr.output);
    }
  }

  // Last-resort fallback: walk shallowly for any string fields.
  if (buckets.length === 0) {
    for (const v of Object.values(payload)) {
      if (typeof v === 'string') buckets.push(v);
    }
  }

  return buckets.join('\n').slice(0, MAX_INPUT);
}

// ── Format a human-friendly stderr report ────────────────────────────────────
function formatReport(findings, eventLabel) {
  const sev = maxSeverity(findings);
  const lines = [];
  lines.push(`\n[Kodelyth Safety] prompt-injection-guard — ${eventLabel} — severity=${sev}`);
  for (const f of findings.slice(0, 5)) {
    lines.push(`  • [${f.severity}] ${f.id} — ${f.why}`);
    if (f.excerpt) lines.push(`      excerpt: ${f.excerpt.replace(/\s+/g, ' ').trim().slice(0, 120)}`);
  }
  if (findings.length > 5) lines.push(`  …and ${findings.length - 5} more.`);
  lines.push(`  mode=${MODE}\n`);
  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  if (MODE === 'off') return safeExit(0);

  let raw = '';
  try { raw = readStdinSync(); } catch { return safeExit(0); }

  let payload = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch { payload = null; }

  // Echo stdin to stdout so chained hooks/loggers still see the original.
  if (raw) process.stdout.write(raw);

  if (!payload) return safeExit(0);

  const text = extractTextFromPayload(payload);
  if (!text) return safeExit(0);

  const findings = scan(text);
  if (findings.length === 0) return safeExit(0);

  const baseEvent = payload.hook_event_name || (payload.tool_name ? 'PostToolUse' : 'UserPromptSubmit');
  const eventLabel = payload.tool_name ? `${baseEvent}:${payload.tool_name}` : baseEvent;

  const sev = maxSeverity(findings);

  appendLog({
    timestamp: new Date().toISOString(),
    event:     eventLabel,
    severity:  sev,
    mode:      MODE,
    findings:  findings.map(f => ({ id: f.id, severity: f.severity, why: f.why })),
  });

  // Always emit the report on stderr (visible to user/transcript).
  process.stderr.write(formatReport(findings, eventLabel));

  if (MODE === 'block' && sev === 'critical') {
    process.stderr.write(
      '\n[Kodelyth Safety] BLOCKED: critical prompt-injection patterns detected.\n' +
      '  • Set KODELYTH_PI_GUARD=warn to downgrade to warning-only.\n' +
      '  • Set KODELYTH_PI_GUARD=off to disable this guard entirely.\n\n'
    );
    return safeExit(2);
  }

  return safeExit(0);
}

if (require.main === module) {
  try { main(); } catch { safeExit(0); }
}

module.exports = {
  // Exposed for tests
  extractTextFromPayload,
  formatReport,
};
