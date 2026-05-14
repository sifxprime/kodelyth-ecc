// =============================================================================
// Kodelyth ECC — Structured Instinct Schema  (Improvement B)
//
// Stores learned instincts as typed JSON records in:
//   ~/.kodelyth/memory/instincts.jsonl
//
// Each instinct has: pattern, trigger, confidence, last_used, outcome, decay.
// This replaces free-form markdown bullets for machine-readable learning.
// The lessons.md file is still written for human readability — this runs
// in parallel, enabling deduplication, conflict detection, and decay.
//
// Schema:
//   id           — deterministic hash (stable across re-runs)
//   pattern      — short slug: "use-pnpm-not-npm", "no-console-logs"
//   rule         — full human-readable text of the rule
//   scope        — "project" | "global"
//   trigger      — keywords/phrases that activate this instinct
//   confidence   — 0.0–1.0 (starts at 0.7, confirmed → 1.0, decays with age)
//   source       — "correction" | "manual" | "evolved"
//   created      — ISO date
//   last_used    — ISO date
//   use_count    — how many sessions this was applied
//   outcome      — null | "success" | "failure"
//   project_path — absolute path of origin project
//   stale        — true if unused for 30+ days (set by decay check)
// =============================================================================

'use strict';

const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const crypto = require('crypto');

const MEMORY_DIR = process.env.KODELYTH_MEMORY_DIR
  || path.join(os.homedir(), '.kodelyth', 'memory');

const INSTINCTS_FILE = path.join(MEMORY_DIR, 'instincts.jsonl');
const STALE_DAYS     = 30;

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'rule';
}

function deterministicId(rule, projectPath) {
  return crypto
    .createHash('sha256')
    .update(`${rule}::${projectPath || ''}`)
    .digest('hex')
    .slice(0, 12);
}

function extractTriggers(ruleText) {
  // Heuristic: extract key words that would activate this rule
  const FILLER = new Set(['use','don\'t','never','always','please','stop','avoid',
    'instead','of','not','the','a','an','and','or','in','on','at','to','is',
    'are','was','were','do','does','did','should','would','could']);
  return ruleText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !FILLER.has(w))
    .slice(0, 6);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function daysSince(isoDate) {
  if (!isoDate) return 999;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
}

// ── Read / Write ──────────────────────────────────────────────────────────────

function loadAll() {
  if (!fs.existsSync(INSTINCTS_FILE)) return [];
  return fs.readFileSync(INSTINCTS_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

function saveAll(instincts) {
  ensureDir();
  fs.writeFileSync(
    INSTINCTS_FILE,
    instincts.map(i => JSON.stringify(i)).join('\n') + '\n',
    'utf8'
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Add a new instinct from a correction string.
 * If a record with the same id already exists, increments use_count.
 * Returns the instinct record.
 */
function captureFromCorrection(ruleText, projectPath, scope = 'project') {
  ensureDir();
  const id = deterministicId(ruleText, projectPath);
  const all = loadAll();

  const existing = all.find(i => i.id === id);
  if (existing) {
    existing.use_count = (existing.use_count || 1) + 1;
    existing.last_used = today();
    existing.confidence = Math.min(1.0, (existing.confidence || 0.7) + 0.1);
    existing.stale = false;
    saveAll(all);
    return existing;
  }

  const instinct = {
    id,
    pattern: slugify(ruleText),
    rule: ruleText.trim(),
    scope,
    trigger: extractTriggers(ruleText),
    confidence: 0.7,
    source: 'correction',
    created: today(),
    last_used: today(),
    use_count: 1,
    outcome: null,
    project_path: projectPath || null,
    stale: false,
  };

  fs.appendFileSync(INSTINCTS_FILE, JSON.stringify(instinct) + '\n', 'utf8');
  return instinct;
}

/**
 * Record the outcome of an instinct (success/failure) by id.
 * A failure reduces confidence; a success boosts it.
 */
function recordOutcome(id, outcome) {
  const all = loadAll();
  const instinct = all.find(i => i.id === id);
  if (!instinct) return null;

  instinct.outcome = outcome;
  instinct.last_used = today();

  if (outcome === 'success') {
    instinct.confidence = Math.min(1.0, (instinct.confidence || 0.7) + 0.15);
  } else if (outcome === 'failure') {
    instinct.confidence = Math.max(0.0, (instinct.confidence || 0.7) - 0.3);
  }

  saveAll(all);
  return instinct;
}

/**
 * Decay check (Improvement D).
 * Marks instincts unused for STALE_DAYS+ as stale: true.
 * Returns list of newly-stale instincts for review prompting.
 */
function runDecayCheck() {
  const all = loadAll();
  const newlyStale = [];

  for (const instinct of all) {
    const age = daysSince(instinct.last_used);
    const wasStale = instinct.stale;
    instinct.stale = age >= STALE_DAYS;
    if (instinct.stale && !wasStale) {
      newlyStale.push(instinct);
    }
  }

  if (newlyStale.length > 0) saveAll(all);
  return newlyStale;
}

/**
 * Return all instincts, optionally filtered.
 * Filters: { scope, stale, minConfidence, projectPath }
 */
function list({ scope, stale, minConfidence, projectPath } = {}) {
  let all = loadAll();
  if (scope !== undefined)          all = all.filter(i => i.scope === scope);
  if (stale !== undefined)          all = all.filter(i => Boolean(i.stale) === stale);
  if (minConfidence !== undefined)  all = all.filter(i => (i.confidence || 0) >= minConfidence);
  if (projectPath !== undefined)    all = all.filter(i => i.project_path === projectPath);
  return all;
}

/**
 * Prune instincts with confidence below threshold (auto-cleanup of bad patterns).
 */
function pruneWeak(threshold = 0.2) {
  const all = loadAll();
  const kept = all.filter(i => (i.confidence || 0.7) >= threshold);
  const pruned = all.length - kept.length;
  if (pruned > 0) saveAll(kept);
  return pruned;
}

/**
 * Improvement C: outcome tracking via store.js bridge.
 *
 * Called when a follow-up file edit implies a previous instinct didn't stick.
 * Finds instincts that match both the project_path AND a fragment of the
 * problem text, then records a failure outcome on each match.
 *
 * This is intentionally fuzzy: a partial match (>20% token overlap between
 * problemHint and instinct.rule) is enough to trigger a downgrade. The goal
 * is to surface bad patterns, not to be surgically precise.
 *
 * Returns the list of downgraded instinct ids.
 */
function recordOutcomeByProject(projectPath, problemHint, outcome) {
  if (!projectPath && !problemHint) return [];
  const all = loadAll();
  const changed = [];

  const hintTokens = problemHint
    ? new Set(
        String(problemHint)
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(t => t.length >= 3)
      )
    : null;

  for (const instinct of all) {
    // Project match (when provided)
    if (projectPath && instinct.project_path && instinct.project_path !== projectPath) continue;

    // Problem text fuzzy match (when provided)
    if (hintTokens && hintTokens.size > 0) {
      const ruleTokens = String(instinct.rule || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 3);
      const overlap = ruleTokens.filter(t => hintTokens.has(t)).length;
      const ratio   = overlap / Math.max(hintTokens.size, 1);
      if (ratio < 0.2) continue; // < 20% overlap — not a match
    }

    instinct.outcome   = outcome;
    instinct.last_used = today();
    if (outcome === 'success') {
      instinct.confidence = Math.min(1.0, (instinct.confidence || 0.7) + 0.15);
    } else if (outcome === false || outcome === 'failure') {
      instinct.confidence = Math.max(0.0, (instinct.confidence || 0.7) - 0.3);
    }
    changed.push(instinct.id);
  }

  if (changed.length > 0) saveAll(all);
  return changed;
}

module.exports = {
  captureFromCorrection,
  recordOutcome,
  recordOutcomeByProject,
  runDecayCheck,
  list,
  pruneWeak,
  INSTINCTS_FILE,
  STALE_DAYS,
};
