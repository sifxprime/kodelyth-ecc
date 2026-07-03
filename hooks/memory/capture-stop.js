#!/usr/bin/env node
// =============================================================================
// Kodelyth ECC — Memory Capture Hook (Stop)
//
// Runs at the end of a Claude Code session. Locates the session JSONL,
// extracts memory candidates, writes them to a review queue at:
//   ~/.kodelythecc/memory/pending-review.jsonl
//
// Candidates are NEVER auto-stored. The user reviews via:
//   /memory review-pending
// or:
//   node scripts/memory/cli.js list-pending
//
// Improvement A: detects meaningful file writes / git commits in the session
//   and emits a contextual "should I save what we learned?" prompt.
//
// Improvement D: runs instinct decay check — flags instincts unused 30+ days.
// =============================================================================

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

let payload = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { payload += chunk; });
process.stdin.on('end', main);
setTimeout(() => { if (!process.stdin.readableEnded) main(); }, 100);

function main() {
  try {
    const data = payload ? JSON.parse(payload) : {};
    const sessionJsonl = data.session_path
      || data.transcript_path
      || findLatestClaudeSession(data.cwd || process.cwd());

    if (!sessionJsonl || !fs.existsSync(sessionJsonl)) {
      process.exit(0);
    }

    const { extractCandidates } = require(path.join(__dirname, '..', '..', 'scripts', 'memory', 'extract'));
    const candidates = extractCandidates(sessionJsonl);

    // ── Improvement A: detect meaningful file writes or git commits ───────────
    const hadFileWrites = detectFileWrites(sessionJsonl);

    if (candidates.length === 0 && !hadFileWrites) {
      process.exit(0);
    }

    const dir = process.env.KODELYTH_MEMORY_DIR
      || path.join(os.homedir(), '.kodelythecc', 'memory');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const sessionId = data.session_id || path.basename(sessionJsonl, '.jsonl');

    if (candidates.length > 0) {
      const queueFile = path.join(dir, 'pending-review.jsonl');
      const lines = candidates.map(c => JSON.stringify({
        ...c,
        session_id: sessionId,
        project_path: data.cwd || process.cwd(),
        queued_at: new Date().toISOString(),
      }));
      fs.appendFileSync(queueFile, lines.join('\n') + '\n');
    }

    // ── Improvement A: build contextual advisory from session activity ────────
    const parts = [];
    if (candidates.length > 0) {
      parts.push(`${candidates.length} memory candidate(s) queued — run "/memory review-pending" to confirm`);
    }
    if (hadFileWrites) {
      parts.push('files written this session — run "/memory save" or "/learn-eval" to save what we learned');
    }

    // ── Improvement D: decay check — surface stale instincts for review ───────
    try {
      const instinctsPath = path.join(__dirname, '..', '..', 'scripts', 'memory', 'instincts.js');
      if (fs.existsSync(instinctsPath)) {
        const instincts = require(instinctsPath);
        const stale = instincts.runDecayCheck();
        if (stale.length > 0) {
          parts.push(`${stale.length} instinct(s) unused 30+ days — run "/skill-health" to review stale rules`);
        }
      }
    } catch { /* decay check is best-effort, never block a session */ }

    if (parts.length > 0) {
      process.stdout.write(JSON.stringify({
        message: `Kodelyth Memory: ${parts.join(' | ')}`,
      }));
    }

    process.exit(0);
  } catch (err) {
    process.stderr.write(`kodelyth-memory capture: ${err.message}\n`);
    process.exit(0);
  }
}

// ── Improvement A: scan session JSONL for Write/Edit tool uses or git commits ─
function detectFileWrites(sessionJsonl) {
  try {
    const lines = fs.readFileSync(sessionJsonl, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      let event;
      try { event = JSON.parse(line); } catch { continue; }

      // Tool use events that write files
      const toolName = event.name || event.tool_name || '';
      if (/^(Write|Edit|MultiEdit|NotebookEdit)$/i.test(toolName)) return true;

      // Bash events containing git commit
      if (/^Bash$/i.test(toolName)) {
        const input = JSON.stringify(event.input || event.tool_input || '');
        if (/git\s+commit|git\s+push/i.test(input)) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function findLatestClaudeSession(cwd) {
  try {
    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    if (!fs.existsSync(projectsDir)) return null;
    const encoded = '-' + cwd.replace(/\//g, '-');
    const matches = fs.readdirSync(projectsDir).filter(d => d.endsWith(encoded.slice(-30)));
    if (matches.length === 0) return null;
    const projectDir = path.join(projectsDir, matches[0]);
    const sessions = fs.readdirSync(projectDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => ({ f, mtime: fs.statSync(path.join(projectDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    return sessions[0] ? path.join(projectDir, sessions[0].f) : null;
  } catch {
    return null;
  }
}
