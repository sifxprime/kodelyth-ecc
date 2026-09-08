'use strict';

const fs = require('fs');
const path = require('path');
const { RULES } = require('./rules.js');

const SHELL_LANGS = new Set(['', 'bash', 'sh', 'shell', 'zsh', 'console', 'terminal']);

/**
 * Extract only the executable-looking regions of a markdown file.
 *
 * Prose is deliberately excluded. A sentence like "we raised the timeout to 30"
 * is not a portability defect, and flagging it trains people to ignore the
 * scanner — which is worse than not having one.
 */
function shellLines(src) {
  const out = [];
  let m;

  const fence = /```(\w*)\n([\s\S]*?)```/g;
  while ((m = fence.exec(src)) !== null) {
    if (SHELL_LANGS.has((m[1] || '').toLowerCase())) out.push(...m[2].split('\n'));
  }

  const inline = /`([^`\n]+)`/g;
  while ((m = inline.exec(src)) !== null) out.push(m[1]);

  return out;
}

/**
 * A line that is itself teaching the anti-pattern is not a violation.
 * The shell-portability rule documents `timeout 30 npm test` as the WRONG form;
 * flagging its own documentation would make the scanner permanently red.
 */
function isTeachingExample(line) {
  return /^\s*#/.test(line) || /\bWRONG\b|\bBreaks on\b|not installed|illegal option/i.test(line);
}

/**
 * A line that CHECKS for a tool is the fix, not the defect. Without this the
 * scanner flags its own recommended remedy, which is the fastest way to teach
 * people that the scanner is wrong.
 */
function isGuard(line) {
  return /command\s+-v\s+\S+|which\s+\S+\s*>\/dev\/null|\|\|\s*(echo|gtimeout|true)/.test(line);
}

/** A bare command name in prose backticks — `grep -c` — is a reference, not a call. */
function isBareMention(line) {
  return /^[a-z-]+(\s+-{1,2}[a-zA-Z-]+)*$/.test(line.trim());
}

function walk(dir, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (e.isSymbolicLink()) continue; // never follow — a link out of the tree escapes scope
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== '.git') walk(p, acc);
    } else if (e.name.endsWith('.md')) {
      acc.push(p);
    }
  }
  return acc;
}

/**
 * @param {string[]} dirs      directories to scan
 * @param {object}   [opts]
 * @param {string[]} [opts.exclude]  path substrings to skip entirely
 * @returns {{file:string, rule:string, why:string, fix:string, line:string}[]}
 */
function scan(dirs, opts = {}) {
  const exclude = opts.exclude || [];
  const findings = [];

  for (const dir of dirs) {
    for (const file of walk(dir)) {
      if (exclude.some((x) => file.includes(x))) continue;

      let src;
      try {
        src = fs.readFileSync(file, 'utf8');
      } catch {
        continue;
      }

      const lines = shellLines(src);

      // File-level guards. A file that checks for a tool once at the top has
      // handled it for every later use; flagging those uses individually would
      // demand a guard on all twenty lines, which nobody would write.
      const guardedTools = new Set();
      for (const l of lines) {
        const m = /command\s+-v\s+([a-z0-9_-]+)/i.exec(l);
        if (m) guardedTools.add(m[1].toLowerCase());
      }

      for (const rule of RULES) {
        if (rule.guardedBy && guardedTools.has(rule.guardedBy)) continue;
        const hit = lines.find(
          (l) => !isTeachingExample(l) && !isGuard(l) && !isBareMention(l) && rule.re.test(l)
        );
        if (hit) {
          findings.push({
            file,
            rule: rule.id,
            why: rule.why,
            fix: rule.fix,
            line: hit.trim().slice(0, 100),
          });
        }
      }
    }
  }

  return findings;
}

module.exports = { scan, shellLines, isTeachingExample, isGuard, isBareMention, walk };

if (require.main === module) {
  const dirs = process.argv.slice(2);
  if (dirs.length === 0) {
    console.error('usage: node scripts/portability/scan.js <dir> [dir...]');
    process.exit(2);
  }
  const findings = scan(dirs, { exclude: ['shell-portability.md'] });
  if (findings.length === 0) {
    console.log(`portability: clean across ${dirs.join(', ')}`);
    process.exit(0);
  }
  for (const f of findings) {
    console.log(`${f.file}\n  [${f.rule}] ${f.why}\n  fix: ${f.fix}\n  > ${f.line}\n`);
  }
  console.log(`${findings.length} portability finding(s)`);
  process.exit(1);
}
