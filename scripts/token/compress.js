// =============================================================================
// Kodelyth ECC — Context Compression (caveman-style)
//
// Deterministic compaction of large pasted context BEFORE it goes to the
// model. Preserves semantic content, strips ceremony. Every compaction is
// measured with the shared token counter and logged to the savings ledger.
//
// Techniques applied (in order):
//   1. Strip trailing whitespace on every line
//   2. Collapse runs of blank lines to a single blank
//   3. Deduplicate consecutive identical lines
//   4. Strip common license/boilerplate blocks
//   5. Truncate large repetitive blocks (JSON arrays, config lists) to
//      first N + "... M more"
//   6. Collapse code comment banners (======, -----, ####)
//   7. Strip trailing whitespace inside code fences
//
// Config via opts:
//   { maxRepeatedItems, truncateLongJsonArrays, minLenForDedup }
// =============================================================================

'use strict';

const counter = require('./count');
const ledger  = require('./ledger');

const DEFAULTS = {
  maxRepeatedItems:      20,   // truncate JSON arrays / lists beyond this
  truncateLongJsonArrays: true,
  minLenForDedup:        3,    // dedup consecutive runs even for short lines
};

// ── Line-based normalizers ──────────────────────────────────────────────────
function stripTrailingWs(lines) {
  return lines.map(l => l.replace(/[ \t]+$/g, ''));
}

function collapseBlankRuns(lines) {
  const out = [];
  let blank = false;
  for (const l of lines) {
    if (l.trim() === '') {
      if (!blank) out.push('');
      blank = true;
    } else {
      out.push(l); blank = false;
    }
  }
  return out;
}

function dedupeConsecutive(lines, opts) {
  const out = [];
  let last = null;
  for (const l of lines) {
    if (l === last && l.trim().length >= opts.minLenForDedup) continue;
    out.push(l); last = l;
  }
  return out;
}

function stripBannerLines(lines) {
  // Strip pure banner lines and comment-prefixed banner lines like `# =====`
  return lines.filter(l => !/^\s*(?:[#*/-]{1,3}\s*)?[-=_*#]{6,}\s*$/.test(l));
}

function stripCommonBoilerplate(text) {
  // MIT / Apache preambles
  const patterns = [
    /\/\*[\s\S]*?(?:MIT|Apache|Copyright \(c\)|Permission is hereby granted)[\s\S]*?\*\//g,
    /^#\s*(?:Copyright|Licensed under|SPDX-License-Identifier).*$/gm,
  ];
  let out = text;
  for (const p of patterns) out = out.replace(p, '');
  return out;
}

// ── Structural: JSON-array truncation ───────────────────────────────────────
function truncateLongJsonArrays(text, opts) {
  // Match JSON-like array literals `[...]` on their own line group.
  return text.replace(/\[\s*([^\]]{200,})\]/g, (whole, inner) => {
    // Try to split on commas at top-level. Cheap heuristic.
    const items = inner.split(',');
    if (items.length <= opts.maxRepeatedItems) return whole;
    const kept = items.slice(0, opts.maxRepeatedItems).join(',');
    return `[${kept}, /* ...${items.length - opts.maxRepeatedItems} more */]`;
  });
}

// ── Public API ──────────────────────────────────────────────────────────────
function compress(text, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const original = String(text || '');
  if (original.length === 0) return { text: '', saved: { raw: 0, lean: 0, saved: 0, ratio: 0 } };

  let out = original;
  out = stripCommonBoilerplate(out);

  let lines = out.split('\n');
  lines = stripTrailingWs(lines);
  lines = stripBannerLines(lines);
  lines = dedupeConsecutive(lines, cfg);
  lines = collapseBlankRuns(lines);
  out = lines.join('\n');

  if (cfg.truncateLongJsonArrays) {
    out = truncateLongJsonArrays(out, cfg);
  }

  out = out.replace(/\n{3,}/g, '\n\n').trim() + '\n';

  const saved = counter.measureSavings(original, out);

  if (opts.log !== false && saved.saved > 0) {
    ledger.append({
      source: 'compress',
      project: opts.project || null,
      command: opts.label || 'context-compress',
      raw:  saved.raw,
      lean: saved.lean,
      saved: saved.saved,
      ratio: saved.ratio,
      meta: { chars_before: original.length, chars_after: out.length },
    });
  }

  return { text: out, saved };
}

module.exports = { compress };
