// scripts/lib/target-paths.js
//
// Single source of truth for where each IDE target reads skills and commands
// from. Mirrors the per-target destinations in install.sh, and is used by the
// `terse` install/enable path in bin/kodelyth-ecc.js so the dormant /terse
// skill + commands land in the same place the main installer uses.
//
// A target with no skill/command directory returns null on purpose:
//   - cline   reads only .clinerules/ markdown — no skill or command system.
//   - kiro    is MCP-native: the full catalog (terse included) is served by the
//             ECC MCP server wired into .kiro/settings/mcp.json, not copied files.
// Callers already guard on null, so those targets are skipped cleanly.
'use strict';

const os = require('node:os');
const path = require('node:path');

// Normalise alias → canonical target (matches scripts/rtk/index.js normalizeTarget).
function canonTarget(target) {
  if (target === 'claude-code') return 'claude-home';
  if (target === 'gemini-cli') return 'gemini-home';
  if (target === 'cursor') return 'cursor-project';
  return target;
}

function getTargetSkillsDir(target, { home = os.homedir(), cwd = process.cwd() } = {}) {
  switch (canonTarget(target)) {
    case 'claude-home':      return path.join(home, '.claude', 'skills');
    case 'cursor-project':   return path.join(home, '.cursor', 'skills');
    case 'windsurf-home':
    case 'windsurf-project': return path.join(home, '.codeium', 'windsurf', 'skills');
    case 'antigravity':      return path.join(home, '.antigravity', 'skills');
    case 'codex-home':       return path.join(home, '.codex', 'skills');
    case 'gemini-home':      return path.join(home, '.gemini', 'skills');
    case 'gemini-project':   return path.join(cwd, '.gemini', 'skills');
    case 'opencode':         return path.join(home, '.config', 'opencode', 'skills');
    case 'roocode':          return path.join(cwd, '.roo', 'skills');
    case 'aider':            return path.join(cwd, '.aider-ecc', 'skills');
    case 'kimi':             return path.join(cwd, '.kimi', 'skills');
    default: return null; // cline, kiro — see header note.
  }
}

function getTargetCommandsDir(target, { home = os.homedir(), cwd = process.cwd() } = {}) {
  switch (canonTarget(target)) {
    case 'claude-home':      return path.join(home, '.claude', 'commands');
    case 'cursor-project':   return path.join(home, '.cursor', 'commands');
    case 'windsurf-home':
    case 'windsurf-project': return path.join(home, '.codeium', 'windsurf', 'commands');
    case 'antigravity':      return path.join(home, '.antigravity', 'commands');
    case 'codex-home':       return path.join(home, '.codex', 'commands');
    case 'gemini-home':      return path.join(home, '.gemini', 'commands');
    case 'gemini-project':   return path.join(cwd, '.gemini', 'commands');
    case 'opencode':         return path.join(home, '.config', 'opencode', 'commands');
    case 'roocode':          return path.join(cwd, '.roo', 'commands');
    case 'aider':            return path.join(cwd, '.aider-ecc', 'commands');
    case 'kimi':             return path.join(cwd, '.kimi', 'commands');
    default: return null; // cline, kiro — see header note.
  }
}

module.exports = { canonTarget, getTargetSkillsDir, getTargetCommandsDir };
