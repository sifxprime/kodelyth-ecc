// =============================================================================
// Kodelyth ECC — Cost-Aware Model Router (Classifier + Config Loader)
//
// Pure-function task classifier. Given a task description and optional
// signals (file count, agent in scope, security flags, etc.), returns a
// recommended tier ("trivial" | "standard" | "hard") plus the top reasons.
//
// Used by:
//   - npx kodelyth-ecc route <task...>      ad-hoc CLI
//   - skills/cost-aware-model-routing       explicit invocation
//   - any future hook that wants a hint
//
// Pure JS, zero deps, deterministic.
// =============================================================================

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

// ── Defaults (provider-agnostic) ─────────────────────────────────────────────
const DEFAULT_MODELS = {
  trivial:  'claude-haiku-4-5-20251001',
  standard: 'claude-sonnet-4-6',
  hard:     'claude-opus-4-1',
  default:  'standard',
};

// Agents that should NEVER downgrade — security / incident / adversarial work.
const HARD_TIER_AGENTS = new Set([
  'security-reviewer', 'incident-commander', 'debug-detective',
  'prompt-injection-hunter', 'supply-chain-auditor', 'secret-hunter',
  'backdoor-hunter', 'chaos-engineer', 'jailbreak-tester',
  'code-stealer-detector', 'license-violation-finder',
  'code-architect', 'architect',
]);

// ── Signal catalogues ────────────────────────────────────────────────────────
const TRIVIAL_SIGNALS = [
  { id: 'rename',      regex: /\b(rename|renaming)\b/i },
  { id: 'format',      regex: /\b(format|formatting|prettier|biome|reformat)\b/i },
  { id: 'typo',        regex: /\b(typo|misspell|spelling)\b/i },
  { id: 'doc-comment', regex: /\b(jsdoc|tsdoc|docstring|add comments?|add docs?)\b/i },
  { id: 'capitalize',  regex: /\b(capitali[sz]e|lowercase|uppercase|kebab-case|snake_case|camelCase)\b/i },
  { id: 'list-files',  regex: /\b(list|count|enumerate)\s+(files?|imports?|exports?|functions?)\b/i },
  { id: 'summarize',   regex: /\b(summari[sz]e|tl;?dr|short summary)\b/i },
  { id: 'version-bump',regex: /\b(version\s+bump|bump\s+(version|deps?))\b/i },
  { id: 'simple-regex',regex: /\b(simple\s+regex|one[\s-]liner|small\s+regex)\b/i },
];

const HARD_SIGNALS = [
  { id: 'production',  regex: /\b(production|prod|live|outage|incident|down|leaking|on[\s-]?call|p[01]|sev[12])\b/i, weight: 3 },
  { id: 'security',    regex: /\b(security|vuln(?:erability)?|cve|exploit|injection|auth(?:n|z)?\s+(?:bypass|flaw)|secrets?\s+(?:leak|exposure))\b/i, weight: 3 },
  { id: 'architecture',regex: /\b(architect(?:ure|ural)?\s+(?:decision|design|review|trade[\s-]?off)|design\s+review|adr|RFC)\b/i, weight: 2 },
  { id: 'multi-file',  regex: /\b(across\s+(?:the\s+)?(?:codebase|repo|project)|every(?:where)?|all\s+(?:files|modules|services))\b/i, weight: 2 },
  { id: 'concurrency', regex: /\b(race\s+condition|deadlock|concurrency|thread[\s-]safe|atomic|mutex|lock)\b/i, weight: 2 },
  { id: 'urgent',      regex: /\b(urgent|asap|right\s+now|emergency|critical(?:al)?ly|fire|burning)\b/i, weight: 2 },
  { id: 'devil-mode',  regex: /\b(\/devil-mode|devil[\s-]?mode|red[\s-]?team|adversarial)\b/i, weight: 3 },
  { id: 'incident',    regex: /\bincident[\s-]?(commander|response|triage|postmortem|post[\s-]?mortem)\b/i, weight: 3 },
];

const STANDARD_SIGNALS = [
  { id: 'review-pr',   regex: /\b(review\s+(?:this\s+)?pr|code\s+review|pr\s+review)\b/i },
  { id: 'write-test',  regex: /\b(write\s+(?:a\s+)?(?:unit\s+)?tests?|add\s+tests?)\b/i },
  { id: 'fix-bug',     regex: /\b(fix\s+(?:this\s+)?bug|debug\s+this|why\s+is\s+this\s+failing)\b/i },
  { id: 'refactor',    regex: /\brefactor(?:ing)?\b/i },
  { id: 'optimize',    regex: /\b(optimi[sz]e|speed\s+up|improve\s+performance)\b/i },
  { id: 'doc-section', regex: /\b(write\s+docs?|document(?:ation)?\s+for)\b/i },
];

// ── Token utilities ──────────────────────────────────────────────────────────
function chars(s) { return typeof s === 'string' ? s.length : 0; }

// ── Main classifier ──────────────────────────────────────────────────────────
function classify(task, opts = {}) {
  if (!task || typeof task !== 'string') {
    return { tier: 'standard', reasons: ['no task text — defaulting to standard'], score: { trivial: 0, standard: 0, hard: 0 } };
  }
  const t = task.trim();
  const len = chars(t);

  const fileCount = Number(opts.file_count) || 0;
  const activeAgent = String(opts.active_agent || '').trim();
  const sessionTokens = Number(opts.session_tokens) || 0;
  const budgetTokens = Number(opts.budget_tokens) || 0;
  const explicitTier = opts.explicit_tier; // if user set --model X, we respect it.

  const score = { trivial: 0, standard: 0, hard: 0 };
  const reasons = [];

  // ── HARD: agent in scope ────────────────────────────────────────────────────
  if (activeAgent && HARD_TIER_AGENTS.has(activeAgent)) {
    score.hard += 4;
    reasons.push(`active agent "${activeAgent}" never downgrades`);
  }

  // ── HARD signals ────────────────────────────────────────────────────────────
  for (const s of HARD_SIGNALS) {
    if (s.regex.test(t)) {
      score.hard += s.weight;
      reasons.push(`hard:${s.id}`);
    }
  }

  // ── STANDARD signals ────────────────────────────────────────────────────────
  for (const s of STANDARD_SIGNALS) {
    if (s.regex.test(t)) {
      score.standard += 1;
      reasons.push(`standard:${s.id}`);
    }
  }

  // ── TRIVIAL signals ─────────────────────────────────────────────────────────
  for (const s of TRIVIAL_SIGNALS) {
    if (s.regex.test(t)) {
      score.trivial += 1;
      reasons.push(`trivial:${s.id}`);
    }
  }

  // ── File-count signals ──────────────────────────────────────────────────────
  if (fileCount >= 4) {
    score.hard += 2;
    reasons.push(`file_count=${fileCount} ≥ 4 (multi-file refactor)`);
  } else if (fileCount === 0 && len < 80 && score.hard === 0) {
    score.trivial += 1;
    reasons.push(`short task (${len} chars), no files in scope`);
  } else if (fileCount >= 1 && fileCount <= 3) {
    score.standard += 1;
    reasons.push(`file_count=${fileCount} (focused scope)`);
  }

  // ── Length signals ──────────────────────────────────────────────────────────
  if (len > 800 && score.trivial === 0) {
    score.standard += 1;
    reasons.push(`long task description (${len} chars)`);
  }

  // ── Budget pressure: bias one tier downward when ambiguous ──────────────────
  if (budgetTokens > 0 && sessionTokens / budgetTokens > 0.7 && score.hard === 0) {
    if (score.standard > 0) {
      score.trivial += 1;
      reasons.push('budget > 70% — biasing downward when standard/trivial tied');
    }
  }

  // ── Tier resolution ─────────────────────────────────────────────────────────
  // Hard rules first.
  if (score.hard >= 2) {
    return { tier: 'hard', reasons, score, explicit_tier: explicitTier || null };
  }

  // Trivial wins ONLY if it dominates and no hard signal at all.
  if (score.hard === 0 && score.trivial > 0 && score.trivial >= score.standard) {
    return { tier: 'trivial', reasons, score, explicit_tier: explicitTier || null };
  }

  // Anything with a hard signal but not enough weight → standard (defensive).
  if (score.hard > 0) {
    return { tier: 'standard', reasons: [...reasons, 'hard signal present but weight < 2 → defensive standard'], score, explicit_tier: explicitTier || null };
  }

  return { tier: 'standard', reasons, score, explicit_tier: explicitTier || null };
}

// ── Config loader (env vars + .kodelythecc/router.json) ─────────────────────────
function loadConfig({ projectRoot = process.cwd() } = {}) {
  const cfg = { ...DEFAULT_MODELS, notes: '' };

  // 1. Project-level override.
  try {
    const file = path.join(projectRoot, '.kodelythecc', 'router.json');
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const k of ['trivial', 'standard', 'hard', 'default', 'notes']) {
        if (typeof raw[k] === 'string') cfg[k] = raw[k];
      }
    }
  } catch { /* ignore — fall back to defaults */ }

  // 2. Env-var override (highest precedence).
  if (process.env.KODELYTH_ROUTER_TRIVIAL)  cfg.trivial  = process.env.KODELYTH_ROUTER_TRIVIAL;
  if (process.env.KODELYTH_ROUTER_STANDARD) cfg.standard = process.env.KODELYTH_ROUTER_STANDARD;
  if (process.env.KODELYTH_ROUTER_HARD)     cfg.hard     = process.env.KODELYTH_ROUTER_HARD;
  if (process.env.KODELYTH_ROUTER_DEFAULT)  cfg.default  = process.env.KODELYTH_ROUTER_DEFAULT;

  cfg.disabled = String(process.env.KODELYTH_ROUTER || '').toLowerCase() === 'off';
  return cfg;
}

// ── Recommend (combines classify + config) ───────────────────────────────────
function recommend(task, opts = {}) {
  const cfg = loadConfig({ projectRoot: opts.project_root });
  if (cfg.disabled) {
    return {
      disabled: true,
      tier: 'unknown',
      model: opts.current_model || null,
      reasons: ['KODELYTH_ROUTER=off — router disabled'],
      config: cfg,
    };
  }
  const cls = classify(task, opts);
  const tier = cls.tier;
  const recommendedModel = cfg[tier] || cfg.standard;
  const currentModel = opts.current_model || null;
  const mismatched = !!currentModel && currentModel !== recommendedModel;

  return {
    disabled: false,
    tier,
    recommended_model: recommendedModel,
    current_model: currentModel,
    mismatched,
    reasons: cls.reasons,
    score: cls.score,
    notes: cfg.notes || '',
    config: cfg,
  };
}

module.exports = {
  DEFAULT_MODELS,
  HARD_TIER_AGENTS,
  TRIVIAL_SIGNALS,
  STANDARD_SIGNALS,
  HARD_SIGNALS,
  classify,
  loadConfig,
  recommend,
};
