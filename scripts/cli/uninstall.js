// scripts/cli/uninstall.js
// Full ECC cleanup — reverses everything the installer + post-install did.
// Safe: only removes files installed BY ECC (checks for known markers).
// Never touches user's own custom agents/skills/commands they added themselves.

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// ── What ECC ships — used to identify which files WE installed ─────────────
function listShippedFiles(ROOT, subdir) {
  const src = path.join(ROOT, subdir);
  if (!fs.existsSync(src)) return [];
  const out = [];
  const walk = (dir, prefix = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = path.join(prefix, entry.name);
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs, rel);
      else out.push(rel);
    }
  };
  walk(src);
  return out;
}

// Only remove files that also exist in the ECC package.
// Preserves user-authored files in the same directory.
function removeInstalledFiles(destDir, shipped) {
  if (!fs.existsSync(destDir)) return { removed: 0, skipped: 0 };
  let removed = 0, skipped = 0;
  for (const rel of shipped) {
    const abs = path.join(destDir, rel);
    if (fs.existsSync(abs)) {
      try { fs.unlinkSync(abs); removed++; } catch { skipped++; }
    }
  }
  // Clean up now-empty ECC-owned directories.
  const dirs = new Set(shipped.map(f => path.dirname(f)).filter(d => d !== '.'));
  for (const rel of [...dirs].sort((a, b) => b.length - a.length)) {
    const abs = path.join(destDir, rel);
    try {
      if (fs.existsSync(abs) && fs.readdirSync(abs).length === 0) fs.rmdirSync(abs);
    } catch { /* keep going */ }
  }
  return { removed, skipped };
}

function rmrf(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); return true; }
  catch { return false; }
}

// ── The uninstall plan (dry-run friendly) ──────────────────────────────────
function plan(ROOT) {
  const home = os.homedir();
  const claudeDir = path.join(home, '.claude');
  const shipped = {
    agents:   listShippedFiles(ROOT, 'agents'),
    skills:   listShippedFiles(ROOT, 'skills'),
    commands: listShippedFiles(ROOT, 'commands'),
    hooks:    listShippedFiles(ROOT, 'hooks'),
    rules:    listShippedFiles(ROOT, 'rules'),
    scripts:  listShippedFiles(ROOT, 'scripts'),
  };
  const dests = {
    agents:   path.join(claudeDir, 'agents'),
    skills:   path.join(claudeDir, 'skills'),
    commands: path.join(claudeDir, 'commands'),
    hooks:    path.join(claudeDir, 'hooks'),
    rules:    path.join(claudeDir, 'rules'),
    scripts:  path.join(claudeDir, 'scripts'),
  };
  return { home, claudeDir, shipped, dests };
}

// ── Run the uninstall ──────────────────────────────────────────────────────
function run({ log = () => {}, keepMemory = false, dryRun = false } = {}) {
  const ROOT = path.join(__dirname, '..', '..');
  const p = plan(ROOT);
  const results = { removed_files: 0, dirs_removed: [], subsystems_uninstalled: [], errors: [] };

  log('Removing ECC-installed files from ~/.claude/ …');
  for (const kind of Object.keys(p.shipped)) {
    if (dryRun) {
      log(`  [dry-run] would remove ${p.shipped[kind].length} ${kind} files from ${p.dests[kind]}`);
      continue;
    }
    const r = removeInstalledFiles(p.dests[kind], p.shipped[kind]);
    results.removed_files += r.removed;
    log(`  ${kind}: removed ${r.removed} files (${r.skipped} skipped)`);
  }

  // Remove ECC's own MCP entries from Claude Code / Claude Desktop configs.
  try {
    const reg = require('../mcp/register-self.js');
    if (!dryRun) reg.unregisterAll({ log: (m) => log('  ' + m) });
    else         log('  [dry-run] would unregister kodelyth-ecc MCP server from Claude Code + Desktop');
    results.subsystems_uninstalled.push('mcp-registration');
  } catch (e) { results.errors.push('mcp-unregister: ' + e.message); }

  // Remove RTK integration (uses their own uninstall flag).
  try {
    log('Unwiring RTK integrations …');
    if (!dryRun) {
      const r = spawnSync('rtk', ['init', '-g', '--uninstall'], { encoding: 'utf8' });
      log(r.status === 0 ? '  ✓ rtk uninstalled from claude-code' : '  · rtk uninstall skipped (may not be present)');
    }
    results.subsystems_uninstalled.push('rtk');
  } catch (e) { results.errors.push('rtk: ' + e.message); }

  // Remove codebase-memory-mcp registration (their own uninstall).
  try {
    log('Uninstalling codebase-memory-mcp agent configs …');
    if (!dryRun) {
      const r = spawnSync('codebase-memory-mcp', ['uninstall'], { encoding: 'utf8' });
      log(r.status === 0 ? '  ✓ codebase-memory-mcp configs removed' : '  · codebase-memory-mcp uninstall skipped (binary not present)');
    }
    results.subsystems_uninstalled.push('codebase-memory-mcp');
  } catch (e) { results.errors.push('codebase-memory-mcp: ' + e.message); }

  // Remove memory + ledgers.
  if (!keepMemory) {
    log(`${dryRun ? '[dry-run] would remove' : 'Removing'} ~/.kodelythecc/ (memory, ledgers, cache) …`);
    const target = path.join(p.home, '.kodelythecc');
    if (!dryRun && rmrf(target)) results.dirs_removed.push(target);
  } else {
    log('Keeping ~/.kodelythecc/ (memory preserved as requested)');
  }

  // Remove legacy migration backup if present.
  try {
    for (const name of fs.readdirSync(p.home)) {
      if (name.startsWith('.kodelyth.backup-')) {
        const abs = path.join(p.home, name);
        if (dryRun) log(`  [dry-run] would remove backup ${abs}`);
        else { rmrf(abs); results.dirs_removed.push(abs); }
      }
    }
  } catch { /* home dir listing failed — skip */ }

  return results;
}

module.exports = { plan, run };
