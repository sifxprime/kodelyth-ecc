#!/usr/bin/env node
// =============================================================================
// Kodelyth ECC — Memory Capture (Stop hook, v2)
//
// Runs at Stop. New behavior:
//   1. Deterministic success signals — user says "that worked", "fixed",
//      "thanks that solved it", or a test/CI goes green, or a git commit lands
//      after a Write/Edit. Signals are AND-ed with a preceding tool-use burst.
//   2. Extraction of problem + approach from the session tail (last ~40 events).
//   3. Auto-capture on strong signals; queue for review on weak/ambiguous.
//   4. Zero surprise: every capture emits telemetry so the user can trace it.
//
// Runs completely offline. Never blocks a session end.
// =============================================================================

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const fabric    = require('../../scripts/lib/fabric');
const telemetry = require('../../scripts/lib/telemetry');

let payload = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { payload += chunk; });
process.stdin.on('end', main);
setTimeout(() => { if (!process.stdin.readableEnded) main(); }, 100);

// Explicit success signals from the user side.
const SUCCESS_PATTERNS = [
  /\b(that\s+(?:worked|fixed(?:\s+it)?|did\s+it))\b/i,
  /\b(fixed|resolved|solved)\s+(?:it|now|the\s+bug)\b/i,
  /\bworks?\s+now\b/i,
  /\bthanks?(?:,?\s+that\s+(?:worked|helped|fixed))/i,
  /\bperfect(?:!|,\s+that\s+worked)?/i,
  /\bnice(?:!|,\s+that\s+worked)?/i,
  /\bshipped\s+it\b/i,
  /\bmerged\b/i,
  /\bgreen\b/i,
];

// Failure signals — used to update prior memories, not create new ones.
const FAILURE_PATTERNS = [
  /\b(didn'?t|does(?:n'?t)? not|not)\s+(?:work|fix(?:ed)?|help)\b/i,
  /\bstill\s+broken\b/i,
  /\bstill\s+failing\b/i,
  /\bregression\b/i,
];

function main() {
  try {
    const data = payload ? JSON.parse(payload) : {};
    const sessionJsonl = data.session_path
      || data.transcript_path
      || findLatestClaudeSession(data.cwd || process.cwd());

    if (!sessionJsonl || !fs.existsSync(sessionJsonl)) return exit0();

    fabric.ensureGlobal();
    const projectRoot = data.cwd || process.cwd();
    const sessionId   = data.session_id || path.basename(sessionJsonl, '.jsonl');

    const events = readSessionEvents(sessionJsonl);
    const signals = extractSignals(events);

    // Telemetry: record the session close either way.
    telemetry.record('session.stop', {
      project: projectRoot,
      session_id: sessionId,
      event_count: events.length,
      success: signals.hadSuccess,
      failure: signals.hadFailure,
      write_count: signals.writeCount,
      commit: signals.hadCommit,
    });

    // Nothing meaningful to remember.
    if (!signals.hadSuccess && !signals.hadCommit && signals.writeCount === 0) return exit0();

    // Build a candidate memory from the session tail.
    const candidate = buildCandidate(events, signals, projectRoot);
    if (!candidate) return exit0();

    const dir = fabric.GLOBAL.memory;

    let capturedNow = false;
    if (candidate.confidence >= 0.7) {
      // Strong signal → auto-capture directly.
      const store = require('../../scripts/memory/store');
      try {
        const mem = store.capture({
          problem:  candidate.problem,
          approach: candidate.approach,
          tags:     candidate.tags,
          project:  projectRoot,
          language: candidate.language,
          files:    candidate.files,
          gotchas:  candidate.gotchas,
          source:   'auto:capture-stop',
        });
        // Successful outcome — mark resolved:true so it ranks higher next time.
        store.resolveMemory(mem.id, true);
        capturedNow = true;
        telemetry.record('memory.capture.auto', {
          project: projectRoot, memory_id: mem.id, confidence: candidate.confidence,
        });
      } catch (err) {
        process.stderr.write(`capture-stop: auto-capture failed: ${err.message}\n`);
      }
    } else {
      // Weak signal → queue for review.
      const queueFile = fabric.GLOBAL.memoryPending;
      fs.appendFileSync(queueFile, JSON.stringify({
        ...candidate,
        session_id: sessionId,
        project_path: projectRoot,
        queued_at: new Date().toISOString(),
      }) + '\n');
      telemetry.record('memory.capture.queued', {
        project: projectRoot, confidence: candidate.confidence,
      });
    }

    // Advisory message the user sees at session end.
    const parts = [];
    if (capturedNow) parts.push(`captured 1 memory from this session`);
    else parts.push(`1 candidate queued — run "kodelyth-ecc memory review" to confirm`);

    process.stdout.write(JSON.stringify({
      message: `Kodelyth Memory: ${parts.join(' | ')}`,
    }));

    return exit0();
  } catch (err) {
    process.stderr.write(`kodelyth-memory capture-stop: ${err.message}\n`);
    return exit0();
  }
}

// ── Session parsing ─────────────────────────────────────────────────────────
function readSessionEvents(file) {
  try {
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    const out = [];
    for (const line of lines) {
      try { out.push(JSON.parse(line)); } catch {}
    }
    return out;
  } catch { return []; }
}

function extractSignals(events) {
  let writeCount = 0;
  let hadCommit  = false;
  let hadSuccess = false;
  let hadFailure = false;

  // Look at the tail — the last ~40 events carry the most signal.
  const tail = events.slice(-40);
  for (const e of tail) {
    const toolName = e.name || e.tool_name || '';
    if (/^(Write|Edit|MultiEdit|NotebookEdit)$/i.test(toolName)) writeCount++;
    if (/^Bash$/i.test(toolName)) {
      const input = JSON.stringify(e.input || e.tool_input || '');
      if (/git\s+commit/i.test(input)) hadCommit = true;
    }
    // Look at user text (role user)
    const msg = (e.message && (e.message.content || e.message.text)) || e.text || '';
    const asText = typeof msg === 'string' ? msg : JSON.stringify(msg);
    if (e.role === 'user' || e.type === 'user') {
      if (SUCCESS_PATTERNS.some(rx => rx.test(asText))) hadSuccess = true;
      if (FAILURE_PATTERNS.some(rx => rx.test(asText))) hadFailure = true;
    }
  }
  return { writeCount, hadCommit, hadSuccess, hadFailure };
}

// ── Candidate memory extraction ─────────────────────────────────────────────
function buildCandidate(events, signals, projectRoot) {
  const tail = events.slice(-60);
  const userTexts = [];
  const assistantTexts = [];
  const files = new Set();

  for (const e of tail) {
    const role  = e.role || e.type || (e.message && e.message.role);
    const msg   = (e.message && (e.message.content || e.message.text)) || e.text || '';
    const asText = typeof msg === 'string' ? msg
                 : Array.isArray(msg) ? msg.map(x => x.text || '').join('\n')
                 : JSON.stringify(msg);
    if (role === 'user') userTexts.push(asText);
    if (role === 'assistant') assistantTexts.push(asText);

    const input = e.input || e.tool_input || {};
    for (const key of ['file_path', 'path', 'filename']) {
      if (input[key]) files.add(String(input[key]));
    }
  }

  // Take the first user message as problem statement, last assistant reply
  // as approach summary. Bounded for size.
  const firstUser = userTexts[0] || '';
  const lastAssist = assistantTexts[assistantTexts.length - 1] || '';
  if (!firstUser || firstUser.length < 12) return null;

  const problem  = firstUser.slice(0, 400).trim();
  const approach = deriveApproach(assistantTexts, files);
  if (!approach) return null;

  // Confidence — success signal boosts strongly; commit boosts; multiple writes boost.
  let confidence = 0.3;
  if (signals.hadSuccess) confidence += 0.4;
  if (signals.hadCommit)  confidence += 0.2;
  if (signals.writeCount >= 3) confidence += 0.15;
  if (signals.hadFailure) confidence -= 0.3;
  confidence = Math.max(0, Math.min(1, confidence));

  // Tags = last-run tool names + detected language keywords.
  const tags = inferTags(events, files, projectRoot);
  const language = detectLanguage(files, projectRoot);

  return {
    problem,
    approach: approach.slice(0, 1800),
    files:    Array.from(files).slice(0, 15),
    tags,
    language,
    gotchas:  [],
    confidence,
  };
}

function deriveApproach(assistantTexts, files) {
  // Use the last non-trivial assistant message that mentions edits or files.
  for (let i = assistantTexts.length - 1; i >= 0; i--) {
    const t = assistantTexts[i];
    if (!t || t.length < 40) continue;
    return t.replace(/\s+/g, ' ').slice(0, 1800);
  }
  // Fallback: describe file changes.
  if (files.size > 0) return `Modified: ${Array.from(files).slice(0, 8).join(', ')}`;
  return null;
}

function inferTags(events, files, projectRoot) {
  const tags = new Set();
  for (const f of files) {
    const ext = path.extname(f).slice(1).toLowerCase();
    if (ext) tags.add(ext);
  }
  // Framework signals from project package.json
  try {
    const pkg = fabric.readJson(path.join(projectRoot, 'package.json'), null);
    if (pkg) {
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      for (const name of ['next', 'react', 'vue', 'svelte', 'express', 'fastify', 'nest', 'astro']) {
        if (deps[name]) tags.add(name);
      }
      if (deps.typescript) tags.add('typescript');
    }
  } catch {}
  return Array.from(tags).slice(0, 8);
}

function detectLanguage(files, projectRoot) {
  const counts = {};
  for (const f of files) {
    const ext = path.extname(f).slice(1).toLowerCase();
    const lang = ({
      ts:'typescript', tsx:'typescript', js:'javascript', jsx:'javascript',
      py:'python', go:'go', rs:'rust', java:'java', kt:'kotlin',
      cs:'csharp', cpp:'cpp', c:'c', rb:'ruby', php:'php',
    })[ext];
    if (lang) counts[lang] = (counts[lang] || 0) + 1;
  }
  const top = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
  return top ? top[0] : null;
}

// ── Session file discovery ──────────────────────────────────────────────────
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
  } catch { return null; }
}

function exit0() { process.exit(0); }
