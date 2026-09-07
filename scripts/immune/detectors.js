// scripts/immune/detectors.js
//
// Executable detectors for the bug classes the arena has actually confirmed.
//
// The arena finds bugs and remembers them as prose. Prose does not scan a
// codebase. Each detector below encodes one class that was reproduced with a
// real repro during an arena run, so the knowledge becomes something that can
// run against any repository instead of only informing the next conversation.
//
// Every detector is proven against git history: it must FIRE on the exact
// pre-fix source the arena found the bug in, and stay SILENT on the fixed
// source. A detector that cannot do both does not ship. See
// tests/immune/detectors.test.js, which pins each one to a real commit.
//
// Precision over recall, deliberately. A scanner that cries wolf gets muted,
// and a muted scanner protects nothing.

'use strict';

// Strip comments and string literals before matching. Without this, every
// detector fires on its own documentation and on the changelog entry describing
// the bug it looks for — which is exactly how a scanner earns its mute button.
// Blank out COMMENTS ONLY, preserving line numbers.
//
// An earlier version also stripped string literals, which broke on the first
// apostrophe in ordinary prose ("don't") — the quote opened a span that ate
// everything to the next quote, including regex literals several lines later.
// The unbounded-quantifier detector went silent on a real, confirmed bug
// because of it. Regex-based lexing of JavaScript strings is not reliable
// enough to build detection on.
//
// Comments are the only noise that actually matters: a detector describing the
// bug it hunts would otherwise flag its own documentation.
function stripNoise(src) {
  return src
    // Block comments — keep newlines so line numbers stay correct.
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    // Line comments, but not the "//" inside a URL like https://example.com.
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (m, lead) => lead + ' '.repeat(m.length - lead.length));
}

function lineOf(src, index) {
  return src.slice(0, index).split('\n').length;
}

// ── The classes ─────────────────────────────────────────────────────────────

const DETECTORS = [
  {
    id: 'lexical-containment',
    severity: 'high',
    confirmed: 5,
    title: 'Path containment checked lexically, without resolving symlinks',
    why:
      'path.join and path.resolve normalise ".." but do not resolve symlinks. A link ' +
      'sitting lexically inside the root passes a startsWith() check while its target is ' +
      'anywhere on disk, and the read or write follows it.',
    fix: 'Canonicalise both sides with fs.realpathSync before comparing, or route through a shared guard.',
    detect(src) {
      const clean = stripNoise(src);
      // A containment comparison against a root-ish identifier...
      const guard = /\.startsWith\(\s*([A-Za-z_$][\w$]*(?:Root|Dir|DIR|Base|BASE|dir|base))\s*\+/g;
      const out = [];
      let m;
      while ((m = guard.exec(clean))) {
        // ...that is never accompanied by a realpath anywhere in the file.
        if (/realpathSync|realpath\(/.test(clean)) continue;
        // ...and the file actually touches the filesystem with that path.
        if (!/fs\.(?:readFileSync|readdirSync|writeFileSync|createReadStream|openSync|statSync)/.test(clean)) continue;
        out.push({ line: lineOf(clean, m.index), evidence: `startsWith(${m[1]} + ...) with no realpath in the file` });
      }
      return out;
    },
  },

  {
    id: 'prototype-key-map',
    severity: 'high',
    confirmed: 1,
    title: 'Plain object used as a map keyed by user-controlled text',
    why:
      'map["constructor"] returns Object.prototype.constructor, which is TRUTHY, so an ' +
      'if (!map[k]) guard never fires and the next line reads a property off a function. ' +
      '"constructor" and "toString" are ordinary vocabulary — this needs no attacker.',
    fix: 'Use Object.create(null) for any map keyed by tokens, tags, headers, or filenames.',
    detect(src) {
      const clean = stripNoise(src);
      const out = [];
      // The exact shape: guard-then-index on a dynamically keyed map.
      const re = /if\s*\(\s*!\s*([A-Za-z_$][\w$.]*)\[\s*([A-Za-z_$][\w$]*)\s*\]\s*\)/g;
      let m;
      while ((m = re.exec(clean))) {
        const [, map, key] = m;
        // A numeric-looking key (i, idx, n) is an array index, not a text map.
        if (/^(?:i|j|k|n|idx|index)$/.test(key)) continue;
        // Fires only when the map is never given a null prototype.
        if (new RegExp(`${map.split('.').pop()}\\s*=\\s*Object\\.create\\(null\\)`).test(clean)) continue;
        if (/Object\.create\(null\)/.test(clean) && new RegExp(`${map.split('.').pop()}:\\s*nullMap`).test(clean)) continue;
        out.push({ line: lineOf(clean, m.index), evidence: `if (!${map}[${key}]) — ${map} is keyed by a dynamic value and has a prototype` });
      }
      return out;
    },
  },

  {
    id: 'truncate-then-write',
    severity: 'medium',
    confirmed: 3,
    title: 'fs.writeFileSync used to replace persistent state',
    why:
      "writeFileSync opens with 'w', truncating the file to zero BEFORE writing. A crash, " +
      'a full disk, or a concurrent reader sees an empty file — measured at 0 bytes on a ' +
      '6.3 MB store, 32 torn reads in 1423 samples.',
    fix: 'Write to a temp sibling and rename, or use safeFs.replaceFilePreservingMode.',
    detect(src) {
      const clean = stripNoise(src);
      const out = [];
      const re = /fs\.writeFileSync\(\s*([A-Za-z_$][\w$.]*)/g;
      let m;
      while ((m = re.exec(clean))) {
        const target = m[1];
        // A temp file being written before a rename is the CORRECT pattern.
        if (/tmp|temp/i.test(target)) continue;
        // Only a module-level constant or a PATHS.x member reads as durable
        // user state. A local `filePath` loop variable is usually generated
        // output — regenerable, and truncating it costs nothing. Matching those
        // made this fire on half the CI scripts, which is how a scanner earns
        // its mute button.
        const durable = /^[A-Z][A-Z0-9_]*$/.test(target) || /^PATHS\.[a-z]/i.test(target);
        if (!durable) continue;
        if (/renameSync/.test(clean)) continue;   // already doing temp+rename
        out.push({ line: lineOf(clean, m.index), evidence: `fs.writeFileSync(${target}, ...) with no temp+rename in the file` });
      }
      return out;
    },
  },

  // REMOVED: 'unbounded-quantifier' (ReDoS).
  //
  // The class is real — an unbounded negated class cost 7.6 s on 293 KB — but it
  // cannot be detected statically with acceptable precision. Arena run #1
  // MEASURED five structurally identical regexes in one file: the fenced-code,
  // inline-code, bare-URL and file-path patterns were all linear, and only the
  // link-target pattern was quadratic. The difference is whether the closing
  // delimiter is commonly absent in real input — a property of the data, not of
  // the pattern, and invisible to a scanner.
  //
  // A detector here would have flagged all five and been wrong about four. A
  // scanner that is wrong four times out of five gets muted, and a muted scanner
  // protects nothing. ReDoS stays where it was actually caught: measurement,
  // under /arena, with a doubling ladder.

  {
    id: 'predictable-temp-name',
    severity: 'low',
    confirmed: 1,
    title: 'Temp filename derived from the process id',
    why:
      'A predictable temp name lets another process pre-plant a symlink there and capture ' +
      'the write. It also collides between concurrent runs.',
    fix: 'Use crypto.randomBytes for the suffix and create with O_EXCL.',
    detect(src) {
      const clean = stripNoise(src);
      const out = [];
      const re = /process\.pid/g;
      let m;
      while ((m = re.exec(clean))) {
        const around = clean.slice(Math.max(0, m.index - 160), m.index + 80);
        if (!/tmp|temp|\.lock|pidfile|pidFile/i.test(around)) continue;
        if (/pidFile|pidfile/i.test(around)) continue;   // writing a real pidfile is fine
        out.push({ line: lineOf(clean, m.index), evidence: 'temp path built from process.pid' });
      }
      return out;
    },
  },

  // REMOVED: 'unbounded-input'.
  //
  // The class is real — 4.9 MB of dense input allocated ~417 MB and OOMed under
  // a 256 MB heap — but the detectable shape is "this module reads a file",
  // which described 57 of 165 files here. The actual bug is reading UNTRUSTED
  // input with no cap, and a scanner cannot tell which reads are untrusted.
  //
  // Kept as a review question for security-reviewer and code-reviewer, where a
  // human can judge the trust boundary, rather than as a detector that flags a
  // third of every codebase it touches.
];

function detectorById(id) {
  return DETECTORS.find((d) => d.id === id) || null;
}

// Run every detector over one file's source.
function scanSource(src, file = '<source>') {
  const findings = [];
  for (const d of DETECTORS) {
    let hits = [];
    try {
      hits = d.detect(src) || [];
    } catch {
      continue;   // a detector must never take the scan down with it
    }
    for (const h of hits) {
      findings.push({
        detector: d.id,
        severity: d.severity,
        title: d.title,
        file,
        line: h.line,
        evidence: h.evidence,
        why: d.why,
        fix: d.fix,
        confirmedByArena: d.confirmed,
      });
    }
  }
  return findings;
}

module.exports = { DETECTORS, detectorById, scanSource, _internals: { stripNoise, lineOf } };
