// scripts/terse/compress.js
// Deterministic markdown compressor for memory files (CLAUDE.md, lessons.md, rules).
// Byte-preserves code blocks, inline code, URLs, paths, YAML frontmatter.
// Zero dependencies.
//
// Public API:
//   compressText(source, opts?) → { output, stats: { originalBytes, newBytes, saved, savedPct } }
//   compressFile(path, opts?)   → same + writes file if opts.write

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const safeFs = require('../lib/safe-fs.js');

// ── Substitutions: wordy connective → short form ────────────────────────────
// These run BEFORE deletions. Order matters: "due to the fact that" must become
// "because" before the generic "the fact that" deletion can shred it.
const REPLACE = [
  [/\bin order to\b/gi,               'to'],
  [/\bdue to the fact that\b/gi,      'because'],
  [/\bfor the purpose of\b/gi,        'to'],
  [/\bwith regard to\b/gi,            'about'],
  [/\bwith respect to\b/gi,           'about'],
  [/\bat this point in time\b/gi,     'now'],
  [/\ba (?:large )?number of\b/gi,    'many'],
  [/\bmake use of\b/gi,               'use'],
  [/\bcarry out\b/gi,                 'do'],
  [/\bprior to\b/gi,                  'before'],
  [/\bsubsequent to\b/gi,             'after'],
  [/\bin the event that\b/gi,         'if'],
  [/\bfor the reason that\b/gi,       'because'],
];

// ── Filler patterns to remove outright ──────────────────────────────────────
// NOTE: nothing here may duplicate a REPLACE pattern — a deletion would win and
// the substitution would never fire, leaving broken grammar behind.
const FILLERS = [
  // Prepended verbosity
  /\bI'?d be happy to\b\s*/gi,
  /\bLet me (?:take a look and )?(?:explain|walk you through|show you|help you (?:with )?that|see|check)\b\s*/gi,
  /\bSure(?:!|,)?\s*I'?(?:d|ll)?\s+(?:be\s+)?(?:happy\s+to\s+)?/gi,
  /\bOf course(?:!|,)?\s*/gi,
  /\bGreat question(?:!|,)?\s*/gi,
  /\bAbsolutely(?:!|,)?\s*/gi,
  /\bThat's a good (?:question|point)(?:!|,)?\s*/gi,
  /\bHere'?s (?:a summary of )?what (?:is|will) (?:going on|happening)(?:\s*:)?\s*/gi,
  /\bThe (?:main )?(?:reason|issue|problem) (?:you'?re (?:experiencing|seeing) )?is (?:most\s+)?likely\s+(?:that|because)\s+/gi,
  /\bIt (?:is|looks like it is|appears to be) (?:likely|possible|possibly) (?:that|because) /gi,
  // Weakeners
  /\bplease (?:note|be aware) that\b\s*/gi,
  /\bit'?s (?:important|worth) (?:to note|noting|mentioning) that\b\s*/gi,
  /\bin (?:general|most cases|many cases)\b,?\s*/gi,
  // Only pure discourse hedges — words with no propositional content — belong
  // here. Degree and scope words do NOT, because this tool's primary target is
  // governance prose (CLAUDE.md, rules/, lessons.md) where they carry the
  // threshold. Deleting them silently rewrites policy:
  //   "approval unless the risk is extremely low"  ->  "...is low"
  //   "auto-merge only for very minor changes"     ->  "...for minor changes"
  //   "run just the failing test"                  ->  "run the failing test"
  //   "you cannot simply skip review"              ->  "you cannot skip review"
  // Negations were checked and are safe — nothing here matches not/never/must/
  // only — but a widened permission gate is just as damaging as an inverted one.
  // The few bytes these would save are not worth rewriting a rule.
  /\b(?:basically|essentially|actually|literally|clearly|obviously)\b,?\s*/gi,
  // Wordy phrases with no short form — safe to drop entirely
  /\bas a matter of fact\b/gi,
  /\bthe fact that\b/gi,
  // Politeness padding
  /\bI (?:would|will) (?:recommend|suggest|advise) (?:that )?/gi,
  /\bI (?:hope|think|believe|feel) (?:that )?/gi,
  /\bYou (?:can|could|should|might want to) /gi,
  /\bYou'?ll want to /gi,
];

// ── Guard rails: never touch anything inside these ──────────────────────────
// Strategy: mask preserved regions with sentinels, transform prose, restore.
//
// The sentinel carries a per-invocation random nonce. Without it, a sentinel
// left in a document by an earlier run (or crafted by hand) would resolve
// against THIS run's holds array and splice in unrelated content.
const SENTINEL_PREFIX = '\u0000K';
const SENTINEL_SUFFIX = '\u0000';

function makeNonce() {
  return crypto.randomBytes(6).toString('hex');
}

function protect(src, nonce) {
  const holds = [];
  let masked = src;
  const stash = (text) => `${SENTINEL_PREFIX}${nonce}:${holds.push(text) - 1}${SENTINEL_SUFFIX}`;

  // Fenced code blocks (```lang ... ```)
  masked = masked.replace(/```[\s\S]*?```/g, m => stash(m));
  // YAML frontmatter at file top
  masked = masked.replace(/^---\n[\s\S]*?\n---\n?/, m => stash(m));
  // Inline code `...`
  masked = masked.replace(/`[^`\n]+`/g, m => stash(m));
  // Markdown/HTML link + image targets: [text](url)
  // This runs BEFORE the bare-URL rule so the href is stashed once, as a whole.
  // Masking the URL first and then stashing the resulting sentinel would nest
  // one sentinel inside another, and String.replace does not rescan its own
  // replacement text — the inner sentinel would leak into the output verbatim.
  // The length bound is load-bearing, not cosmetic. `[^)\n]+` is unanchored and
  // unbounded, so at every `](` the engine scans to EOF hunting a `)`, fails,
  // and backtracks — O(n²) across K occurrences. A document with one unclosed
  // paren is enough to trigger it: 293 KB took 7.6 s before the bound, 0.24 s
  // after. Excluding `\n` alone does NOT help (measured: no improvement).
  masked = masked.replace(/(\]\()([^)\n]{1,2048})(\))/g, (_, open, target, close) =>
    open + stash(target) + close);
  // Bare URLs
  masked = masked.replace(/https?:\/\/[^\s)>\]]+/g, m => stash(m));
  // File paths: absolute, ~/, ./, ../  — the leading delimiter is captured
  // separately so it is not swallowed into the hold.
  masked = masked.replace(
    /(^|[\s(])((?:~\/|\.\.?\/|\/)[A-Za-z0-9._/-]+)/g,
    (_, delim, p) => delim + stash(p),
  );

  return { masked, holds };
}

// Restore to a fixed point. A hold may legitimately contain another sentinel
// (a link whose text contains inline code, say), and replace() does not rescan
// replacement text — so one pass can leave sentinels behind.
function restore(masked, holds, nonce) {
  const re = new RegExp(`${SENTINEL_PREFIX}${nonce}:(\\d+)${SENTINEL_SUFFIX}`, 'g');
  let out = masked;
  for (let pass = 0; pass < 10; pass++) {
    let replaced = false;
    out = out.replace(re, (whole, i) => {
      const held = holds[+i];
      if (held === undefined) return whole; // unknown index: leave it, never emit "undefined"
      replaced = true;
      return held;
    });
    if (!replaced) break;
  }
  return out;
}

// ── Prose-level transforms ──────────────────────────────────────────────────
//
// REPLACE and FILLERS are each collapsed into ONE alternation rather than run as
// 13 + 24 separate passes. Every `String.replace` allocates a fresh copy of the
// whole document, so 37 passes over a multi-megabyte string is 37 full-size
// allocations plus garbage — that is what turned a 4.9 MB input into 417 MB of
// heap. Two passes instead of 37 keeps the cost proportional to the input.
//
// Alternation order preserves rule priority: the regex engine takes the first
// alternative that matches at a position, so the arrays stay authoritative.
// Each pattern gets exactly one wrapping group, so group index == rule index.
// A pattern carrying its own capture group would shift every index after it and
// silently map matches to the wrong replacement, so refuse at load time rather
// than corrupt text at runtime. Use (?:...) in these tables.
function buildAlternation(patterns) {
  patterns.forEach((re) => {
    const groups = new RegExp(`${re.source}|`).exec('').length - 1;
    if (groups > 0) {
      throw new Error(`compress.js: pattern ${re} has a capture group — use (?:...) instead`);
    }
  });
  return new RegExp(patterns.map((re) => `(${re.source})`).join('|'), 'gi');
}

const REPLACE_RE = buildAlternation(REPLACE.map(([re]) => re));
const REPLACE_SUBS = REPLACE.map(([, sub]) => sub);
const FILLERS_RE = buildAlternation(FILLERS);

// Substitutions first, then deletions (see REPLACE note above).
function stripFillersOnce(text) {
  // `groups` are the per-alternative captures; exactly one is defined per match,
  // and its index selects that rule's replacement.
  const out = text.replace(REPLACE_RE, (...args) => {
    const groups = args.slice(1, 1 + REPLACE_SUBS.length);
    const hit = groups.findIndex((g) => g !== undefined);
    return hit === -1 ? args[0] : REPLACE_SUBS[hit];
  });
  return out.replace(FILLERS_RE, '');
}

// Run to a fixed point: deleting one filler can expose a pattern that an
// earlier rule would have matched, so a single ordered pass is not stable.
function stripFillers(text) {
  let out = text;
  for (let pass = 0; pass < 5; pass++) {
    const next = stripFillersOnce(out);
    if (next === out) break;
    out = next;
  }
  return out;
}

// Merge wrapped-prose paragraphs into single lines, collapse runs of blank
// lines, and trim trailing whitespace.
function collapseWhitespace(text) {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^ +| +$/gm, '')
    .replace(/(?:^|\n)\s*\n(?=\s*\n)/g, '\n');
}

// ── Public: compress a string ────────────────────────────────────────────────
// Nothing this tool legitimately compresses comes close to this — CLAUDE.md and
// lessons.md are tens of kilobytes, a large docs page is a few hundred. The cap
// exists to bound the pathological case, not the real one.
//
// It matters because masking is inherently memory-hungry on dense input: every
// protected span becomes an array entry plus a sentinel wider than the span it
// replaces. Measured on text that is nothing but inline code, 4.9 MB allocates
// ~320 MB transiently (fine under Node's default heap, fatal under a 256 MB
// one). At 2 MB the worst case is ~130 MB, which any environment survives.
const MAX_INPUT_BYTES = 2 * 1024 * 1024;

function compressText(source) {
  if (typeof source !== 'string') throw new TypeError('compressText: source must be a string');
  const inputBytes = Buffer.byteLength(source, 'utf8');
  if (inputBytes > MAX_INPUT_BYTES) {
    throw new Error(
      `compressText: input is ${(inputBytes / 1048576).toFixed(1)} MB, over the ${MAX_INPUT_BYTES / 1048576} MB limit`,
    );
  }
  // A NUL in the input would be indistinguishable from our own sentinel framing.
  // Refuse rather than silently corrupt.
  if (source.includes('\u0000')) {
    throw new Error('compressText: input contains NUL bytes and cannot be safely compressed');
  }

  const originalBytes = Buffer.byteLength(source, 'utf8');
  const nonce = makeNonce();
  const { masked, holds } = protect(source, nonce);

  let out = masked;
  out = stripFillers(out);
  out = collapseWhitespace(out);
  out = restore(out, holds, nonce);

  // Belt and braces: never hand back text carrying our framing bytes.
  if (out.includes('\u0000')) {
    throw new Error('compressText: internal error — sentinel leaked into output; aborting rather than writing corrupt text');
  }

  const newBytes = Buffer.byteLength(out, 'utf8');
  const saved    = originalBytes - newBytes;
  const savedPct = originalBytes ? Math.round((saved / originalBytes) * 100) : 0;
  return {
    output: out,
    stats: {
      originalBytes,
      newBytes,
      saved,
      savedPct,
      estimatedTokensSaved: Math.round(saved / 4),
    },
  };
}

// ── Public: compress a file, optionally write ───────────────────────────────
//
// Note on paths: `filePath` is deliberately unconfined — compressing
// `~/.claude/CLAUDE.md` from any directory is the primary use case, so a
// project-root jail would break the tool. The containment boundary is the
// *caller's*: never pass a path that came from the contents of a document.
// See commands/terse-compress.md, which states that rule for AI callers.
function compressFile(filePath, { write = false, backup = true } = {}) {
  const abs = path.resolve(filePath);

  // Refuses symlinks: following one would copy the link target's bytes into a
  // backup beside the link, which is how a 0600 secret ends up in a 0644 file.
  const st = safeFs.statRegularFile(abs);

  // Check the size from the stat we already have, before reading. Otherwise an
  // oversized file is pulled fully into memory only to be rejected a line later.
  if (st.size > MAX_INPUT_BYTES) {
    throw new Error(
      `compressFile: ${abs} is ${(st.size / 1048576).toFixed(1)} MB, over the ${MAX_INPUT_BYTES / 1048576} MB limit`,
    );
  }

  const source = fs.readFileSync(abs, 'utf8');
  const { output, stats } = compressText(source);

  if (!write) return { path: abs, output, stats, wrote: false };

  // Nothing gained — leave the file (and its backup) alone.
  if (stats.saved <= 0) {
    return { path: abs, output, stats, wrote: false, skipped: 'no savings' };
  }

  // Carry the original permissions onto everything we create. Without this the
  // replacement and the backup are born under the process umask, so compressing
  // a 0600 file silently publishes it as 0644.
  const mode = st.mode & 0o7777;

  let backupPath = null;
  if (backup) {
    // Never clobber an existing backup: a second run would otherwise overwrite
    // the only copy of the true original with already-compressed text. The
    // O_EXCL open is what actually enforces this — the loop just picks a name.
    backupPath = `${abs}.pre-terse.bak`;
    for (let n = 1; ; n++) {
      try {
        safeFs.writeNewFile(backupPath, source, mode);
        break;
      } catch (err) {
        if (err.code !== 'EEXIST') throw err;
        if (n > 1000) throw new Error(`cannot find a free backup name beside ${abs}`);
        backupPath = `${abs}.pre-terse.${n}.bak`;
      }
    }
  }

  // Atomic replace preserving the original mode — see scripts/lib/safe-fs.js.
  safeFs.replaceFileAtomic(abs, output, mode);

  return { path: abs, output, stats, wrote: true, backupPath };
}

module.exports = { compressText, compressFile };
