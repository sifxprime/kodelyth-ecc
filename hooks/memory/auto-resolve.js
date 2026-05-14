#!/usr/bin/env node
// =============================================================================
// Kodelyth ECC — Memory Auto-Resolve Hook (PostToolUse: Write|Edit|MultiEdit)
//
// Improvement C — Outcome Tracking
//
// Fires after every file write or edit. Checks if the edited file appears in
// any unresolved memory's files[] list. If it does, that memory's outcome is
// marked resolved:false — a follow-up edit implies the previous solution
// didn't fully stick.
//
// The same event is propagated to instincts.js so that any structued instinct
// sourced from the same session gets its confidence downgraded (−0.30),
// enabling automatic pruning of bad patterns over time.
//
// This hook is deliberately silent:
//   - It never emits output to stdout (would pollute the AI's context).
//   - It always exits 0 (never blocks a session).
//   - All writes are atomic enough for the append-only JSONL format.
//
// Output contract: pass stdin through to stdout unchanged. Never block.
// =============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', run);
setTimeout(() => { if (!process.stdin.readableEnded) run(); }, 150);

function run() {
  // Always echo stdin — never block the tool result from reaching the AI
  if (raw) process.stdout.write(raw);

  try {
    const payload    = raw ? JSON.parse(raw) : {};
    const toolName   = payload.tool_name || payload.name || '';
    const toolInput  = payload.tool_input || payload.input || {};
    const cwd        = payload.cwd || process.cwd();

    // Extract the file path from Write, Edit, or MultiEdit inputs
    let filePath = toolInput.file_path || toolInput.path || null;
    if (!filePath && Array.isArray(toolInput.edits) && toolInput.edits[0]) {
      filePath = toolInput.edits[0].file_path || toolInput.edits[0].path || null;
    }

    if (!filePath) return; // no file path — nothing to resolve

    const storePath = path.join(__dirname, '..', '..', 'scripts', 'memory', 'store.js');
    if (!fs.existsSync(storePath)) return;

    const store    = require(storePath);
    const resolved = store.autoResolveOnEdit(filePath, cwd);

    if (resolved.length > 0) {
      process.stderr.write(
        `[ecc:auto-resolve] Marked ${resolved.length} memory/memories resolved:false` +
        ` after edit to ${path.basename(filePath)}\n`
      );
    }
  } catch (err) {
    process.stderr.write(`[ecc:auto-resolve] ${err.message}\n`);
  }
}
