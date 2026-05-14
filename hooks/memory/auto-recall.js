#!/usr/bin/env node
// =============================================================================
// Kodelyth ECC — Auto Chat Detection (Memory Auto-Recall)
//
// Triggered on UserPromptSubmit (every message the user sends).
// Reads the prompt, searches memory in real-time, and injects relevant
// matches as additional context BEFORE the AI sees the prompt.
//
// Behaviour:
//   - Skips on prompts that are too short (< 12 chars) or trivial ("ok", "yes")
//   - Skips on prompts that look like agent commands (`use foo`, `@bar`)
//   - Skips when no memory exists yet
//   - Suppresses repeats: never re-surfaces the same memory twice in a session
//     (state file: ~/.kodelyth/memory/session-surfaced-<sessionId>.json)
//   - Always exits 0 — never blocks the prompt because memory is unavailable
// =============================================================================

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const MIN_PROMPT_CHARS    = 12;
const MIN_TOKENS          = 2;
const MAX_RECALLED        = 3;
const MIN_SCORE           = 1.0;       // Higher than passive inject — we want strong signal
const TRIVIAL_PROMPTS     = new Set(['ok', 'yes', 'no', 'thanks', 'thx', 'sure', 'go', 'cool', 'k']);
const SKIP_PATTERN        = /^\s*(use\s+|@|\/|invoke\s+)/i;

let payload = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { payload += chunk; });
process.stdin.on('end', main);
setTimeout(() => { if (!process.stdin.readableEnded) main(); }, 200);

function main() {
  try {
    const data        = payload ? safeJson(payload) : {};
    const userPrompt  = (data.prompt || data.user_prompt || data.text || '').trim();
    const sessionId   = data.session_id || 'unknown';
    const projectRoot = data.cwd || process.cwd();

    if (!shouldRecall(userPrompt)) return done({});

    // Lazy require so the hook doesn't crash if memory module breaks
    const { recallForProject } = require(path.join(__dirname, '..', '..', 'scripts', 'memory', 'store'));

    const matches = recallForProject(projectRoot, userPrompt, {
      limit:    MAX_RECALLED * 2,   // grab extra so we can filter out repeats
      minScore: MIN_SCORE,
    });

    // Phase 3.4 — record signal for self-evolving memory.
    // Fire-and-forget; never block recall path on stats failure.
    if (matches.length === 0) {
      tryRecordRoutingMiss({ prompt: userPrompt, sessionId, projectRoot });
      return done({});
    }

    // Filter out memories already surfaced this session
    const surfacedFile = surfacedStatePath(sessionId);
    const surfaced     = loadSurfaced(surfacedFile);
    const fresh        = matches.filter(m => !surfaced.has(m.id)).slice(0, MAX_RECALLED);
    if (fresh.length === 0) return done({});

    // Mark the freshly surfaced memories so they don't re-appear this session
    for (const m of fresh) surfaced.add(m.id);
    saveSurfaced(surfacedFile, surfaced);

    // Phase 3.4 — bump reuse counters for each freshly surfaced memory.
    for (const m of fresh) {
      tryRecordSurface({ memoryId: m.id, sessionId, projectRoot });
    }

    const block = formatBlock(fresh, userPrompt);
    done({
      additionalContext: block,
      meta: {
        source:        'kodelyth-memory:auto-recall',
        recalledCount: fresh.length,
        surfacedTotal: surfaced.size,
      },
    });
  } catch (err) {
    process.stderr.write(`kodelyth-memory auto-recall: ${err.message}\n`);
    done({});
  }
}

function shouldRecall(prompt) {
  if (!prompt || prompt.length < MIN_PROMPT_CHARS)        return false;
  if (TRIVIAL_PROMPTS.has(prompt.toLowerCase().trim()))   return false;
  if (SKIP_PATTERN.test(prompt))                          return false;
  // Token gate — need at least N meaningful words
  const meaningful = prompt
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 4);
  return meaningful.length >= MIN_TOKENS;
}

function formatBlock(memories, userPrompt) {
  const lines = [];
  lines.push('## Kodelyth Memory — relevant past solutions');
  lines.push('');
  lines.push(`Auto-detected from your message: "${userPrompt.slice(0, 100).replace(/\n/g, ' ')}${userPrompt.length > 100 ? '...' : ''}"`);
  lines.push('');
  for (const m of memories) {
    lines.push(`- **${m.problem}**`);
    if (m.approach) lines.push(`  Approach: ${m.approach.split('\n')[0].slice(0, 240)}`);
    if (m.gotchas?.length) lines.push(`  Gotcha: ${m.gotchas[0].slice(0, 200)}`);
    if (m.tags?.length) lines.push(`  Tags: ${m.tags.slice(0, 5).join(', ')}`);
    lines.push(`  (memory id: ${m.id} · captured ${m.captured_at?.slice(0, 10)})`);
  }
  lines.push('');
  lines.push('> Surface these to the user before answering only if they are genuinely relevant to the current task. If not, ignore silently — do not force-fit a memory.');
  return lines.join('\n');
}

function surfacedStatePath(sessionId) {
  const dir = process.env.KODELYTH_MEMORY_DIR
    || path.join(os.homedir(), '.kodelyth', 'memory');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `session-surfaced-${sessionId}.json`);
}

function loadSurfaced(file) {
  try {
    if (!fs.existsSync(file)) return new Set();
    return new Set(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return new Set();
  }
}

function saveSurfaced(file, set) {
  try {
    fs.writeFileSync(file, JSON.stringify(Array.from(set)));
  } catch {
    /* non-fatal */
  }
}

// ── Phase 3.4 — self-evolving memory signals ────────────────────────────────
// Lazy-require the evolve stats module so the hook does not pay the cost
// (or crash on a broken module) unless we actually have something to record.
function tryRecordSurface(args) {
  try {
    const stats = require(path.join(__dirname, '..', '..', 'scripts', 'evolve', 'stats.js'));
    stats.recordSurface(args);
  } catch { /* never break the hook */ }
}

function tryRecordRoutingMiss(args) {
  try {
    const stats = require(path.join(__dirname, '..', '..', 'scripts', 'evolve', 'stats.js'));
    stats.recordRoutingMiss(args);
  } catch { /* never break the hook */ }
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return {}; }
}

function done(obj) {
  if (Object.keys(obj).length > 0) process.stdout.write(JSON.stringify(obj));
  process.exit(0);
}
