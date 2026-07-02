#!/usr/bin/env node
// =============================================================================
// Kodelyth ECC — Auto-Recall + Intent Dispatch (UserPromptSubmit, v2)
//
// Runs on every user prompt. Two jobs:
//   1. Recall relevant memories (fabric-backed BM25 with outcome ranking).
//   2. Dispatch to the right specialist agent (routing that actually fires).
//
// Both are additive to the model's context. Both are transparent — the user
// sees exactly which memories were surfaced and which agent was routed to.
// Never blocks the prompt.
// =============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');

const fabric    = require('../../scripts/lib/fabric');
const telemetry = require('../../scripts/lib/telemetry');

const MIN_PROMPT_CHARS    = 10;
const MIN_TOKENS          = 2;
const MAX_RECALLED        = 3;
const MIN_SCORE           = 0.9;
const TRIVIAL_PROMPTS     = new Set(['ok', 'yes', 'no', 'thanks', 'thx', 'sure', 'go', 'cool', 'k', 'hi', 'hey']);
const SKIP_PATTERN        = /^\s*(use\s+|@|\/|invoke\s+)/i;

let payload = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { payload += chunk; });
process.stdin.on('end', main);
setTimeout(() => { if (!process.stdin.readableEnded) main(); }, 250);

function main() {
  try {
    const data        = payload ? safeJson(payload) : {};
    const userPrompt  = (data.prompt || data.user_prompt || data.text || '').trim();
    const sessionId   = data.session_id || 'unknown';
    const projectRoot = data.cwd || process.cwd();

    fabric.ensureGlobal();

    telemetry.record('prompt.submit', {
      project: projectRoot, session_id: sessionId, len: userPrompt.length,
    });

    if (!shouldProcess(userPrompt)) return done({});

    const blocks = [];
    let recalledCount = 0;
    let routedAgent = null;
    let surfacedTotal = 0;

    // ── 1. Intent Dispatch ──────────────────────────────────────────────────
    try {
      const dispatch = require('../../scripts/router/dispatch');
      const d = dispatch.directive(userPrompt, projectRoot);
      if (d && d.block) { blocks.push(d.block); routedAgent = d.agent; }
    } catch (err) {
      process.stderr.write(`kodelyth-recall: dispatch error: ${err.message}\n`);
    }

    // ── 2. Memory recall ────────────────────────────────────────────────────
    try {
      const { recallForProject } = require('../../scripts/memory/store');
      const matches = recallForProject(projectRoot, userPrompt, {
        limit:    MAX_RECALLED * 2,
        minScore: MIN_SCORE,
      });

      if (matches.length > 0) {
        const surfacedFile = surfacedStatePath(sessionId);
        const surfaced     = loadSurfaced(surfacedFile);
        const fresh        = matches.filter(m => !surfaced.has(m.id)).slice(0, MAX_RECALLED);

        if (fresh.length > 0) {
          for (const m of fresh) surfaced.add(m.id);
          saveSurfaced(surfacedFile, surfaced);
          for (const m of fresh) tryRecordSurface({ memoryId: m.id, sessionId, projectRoot });
          blocks.push(formatMemoryBlock(fresh, userPrompt));
          recalledCount = fresh.length;
          surfacedTotal = surfaced.size;
        }
      } else {
        tryRecordRoutingMiss({ prompt: userPrompt, sessionId, projectRoot });
      }
    } catch (err) {
      process.stderr.write(`kodelyth-recall: memory error: ${err.message}\n`);
    }

    if (blocks.length === 0) return done({});
    done({
      additionalContext: blocks.join('\n\n---\n\n'),
      meta: {
        source: 'kodelyth-memory:auto-recall',
        recalledCount,
        surfacedTotal,
        routedAgent,
      },
    });
  } catch (err) {
    process.stderr.write(`kodelyth-ecc auto-recall: ${err.message}\n`);
    done({});
  }
}

function shouldProcess(prompt) {
  if (!prompt || prompt.length < MIN_PROMPT_CHARS)      return false;
  if (TRIVIAL_PROMPTS.has(prompt.toLowerCase().trim())) return false;
  if (SKIP_PATTERN.test(prompt))                        return false;
  const meaningful = prompt.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
  return meaningful.length >= MIN_TOKENS;
}

function formatMemoryBlock(memories, userPrompt) {
  const lines = [];
  lines.push('## Kodelyth Memory — relevant past solutions');
  lines.push('');
  lines.push(`Auto-detected from: "${userPrompt.slice(0, 100).replace(/\n/g, ' ')}${userPrompt.length > 100 ? '...' : ''}"`);
  lines.push('');
  for (const m of memories) {
    lines.push(`- **${m.problem}**`);
    if (m.approach) lines.push(`  Approach: ${String(m.approach).split('\n')[0].slice(0, 240)}`);
    if (m.gotchas?.length) lines.push(`  Gotcha: ${m.gotchas[0].slice(0, 200)}`);
    if (m.tags?.length)    lines.push(`  Tags: ${m.tags.slice(0, 5).join(', ')}`);
    const scoreInfo = [];
    if (m.score)         scoreInfo.push(`score=${m.score.toFixed(2)}`);
    if (m.outcome_boost) scoreInfo.push(`outcome=${m.outcome_boost.toFixed(2)}`);
    if (m.recency_boost) scoreInfo.push(`recency=${m.recency_boost.toFixed(2)}`);
    lines.push(`  (id: ${m.id} · ${m.captured_at?.slice(0, 10)}${scoreInfo.length ? ' · ' + scoreInfo.join(', ') : ''})`);
  }
  lines.push('');
  lines.push('> Only surface these to the user if genuinely relevant. Do not force-fit a memory.');
  return lines.join('\n');
}

function surfacedStatePath(sessionId) {
  fabric.ensureDir(fabric.GLOBAL.memory);
  return path.join(fabric.GLOBAL.memory, `session-surfaced-${sessionId}.json`);
}

function loadSurfaced(file) {
  try {
    if (!fs.existsSync(file)) return new Set();
    return new Set(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch { return new Set(); }
}

function saveSurfaced(file, set) {
  try { fs.writeFileSync(file, JSON.stringify(Array.from(set))); } catch {}
}

function tryRecordSurface(args) {
  try {
    const stats = require('../../scripts/evolve/stats.js');
    stats.recordSurface(args);
  } catch {}
}

function tryRecordRoutingMiss(args) {
  try {
    const stats = require('../../scripts/evolve/stats.js');
    stats.recordRoutingMiss(args);
  } catch {}
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }

function done(obj) {
  if (Object.keys(obj).length > 0) process.stdout.write(JSON.stringify(obj));
  process.exit(0);
}
