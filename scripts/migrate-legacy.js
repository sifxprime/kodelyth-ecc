#!/usr/bin/env node
// One-shot migrator: ~/.kodelyth/ (old canonical) → ~/.kodelythecc/ (1.8.5+ canonical)
// Idempotent — leaves a marker so it never runs twice.
// Safe — never deletes source; renames old dir to .backup-<date>.

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const LEGACY = path.join(os.homedir(), '.kodelyth');
const NEW    = path.join(os.homedir(), '.kodelythecc');
const MARKER = path.join(NEW, '.migrated-from-kodelyth');

function main() {
  if (!fs.existsSync(LEGACY)) return { migrated: false, reason: 'no legacy dir' };
  if (fs.existsSync(MARKER))  return { migrated: false, reason: 'already migrated' };

  fs.mkdirSync(path.join(NEW, 'memory'), { recursive: true });

  const legacyMem = path.join(LEGACY, 'memory', 'memories.jsonl');
  const newMem    = path.join(NEW,    'memory', 'memories.jsonl');
  let addedLines = 0;

  if (fs.existsSync(legacyMem)) {
    const existing = new Set(
      fs.existsSync(newMem)
        ? fs.readFileSync(newMem, 'utf8').split('\n').filter(Boolean)
        : []
    );
    const legacyLines = fs.readFileSync(legacyMem, 'utf8').split('\n').filter(Boolean);
    const toAppend = legacyLines.filter(l => !existing.has(l));
    if (toAppend.length) {
      fs.appendFileSync(newMem, (existing.size ? '\n' : '') + toAppend.join('\n') + '\n');
      addedLines = toAppend.length;
    }
  }

  // Copy any sibling files (index.json, session-surfaced-*.json) if not already present.
  const legacyMemDir = path.join(LEGACY, 'memory');
  let copiedFiles = 0;
  if (fs.existsSync(legacyMemDir)) {
    for (const f of fs.readdirSync(legacyMemDir)) {
      if (f === 'memories.jsonl') continue;
      const dst = path.join(NEW, 'memory', f);
      if (!fs.existsSync(dst)) {
        fs.copyFileSync(path.join(legacyMemDir, f), dst);
        copiedFiles++;
      }
    }
  }

  // Copy other subtrees (evolve, safety, token-budget, mcp-clients.json) if missing.
  const subtrees = ['evolve', 'safety', 'token-budget'];
  for (const sub of subtrees) {
    const src = path.join(LEGACY, sub);
    const dst = path.join(NEW, sub);
    if (fs.existsSync(src) && !fs.existsSync(dst)) {
      copyDirSync(src, dst);
    }
  }
  const legacyMcp = path.join(LEGACY, 'mcp-clients.json');
  const newMcp    = path.join(NEW,    'mcp-clients.json');
  if (fs.existsSync(legacyMcp) && !fs.existsSync(newMcp)) {
    fs.copyFileSync(legacyMcp, newMcp);
  }

  // Rename legacy dir → backup (never delete).
  const stamp = new Date().toISOString().slice(0, 10);
  const backup = path.join(os.homedir(), `.kodelyth.backup-${stamp}`);
  try {
    if (!fs.existsSync(backup)) fs.renameSync(LEGACY, backup);
  } catch { /* best-effort */ }

  fs.writeFileSync(MARKER, JSON.stringify({
    at: new Date().toISOString(),
    addedLines,
    copiedFiles,
    backupPath: backup,
  }, null, 2));

  return { migrated: true, addedLines, copiedFiles, backupPath: backup };
}

function copyDirSync(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (require.main === module) {
  try {
    const r = main();
    if (r.migrated) {
      process.stdout.write(
        `[kodelyth] migrated legacy ~/.kodelyth → ~/.kodelythecc ` +
        `(+${r.addedLines} memories, ${r.copiedFiles} files copied, backup: ${r.backupPath})\n`
      );
    }
  } catch (e) {
    process.stderr.write(`[kodelyth] migration skipped: ${e.message}\n`);
  }
}

module.exports = { main };
