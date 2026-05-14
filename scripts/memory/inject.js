// =============================================================================
// Kodelyth ECC — Memory Injection
// Builds a cache-friendly context block from relevant past memories.
//
// Output is structured into a STABLE prefix (first 80% of the block) and a
// VARIABLE suffix (current-session triggers). The stable prefix is identical
// across calls in the same project, which lets prompt-cache-aware models
// (Anthropic, OpenAI) hit cache and charge ~10% on the cached tokens.
// =============================================================================

'use strict';

const path = require('path');
const fs   = require('fs');
const { recallForProject, listAll, projectHash } = require('./store');

const MAX_PATTERNS = 8;
const MAX_RECENT   = 5;
const MAX_RELEVANT = 5;

function loadProjectContextSignals(projectRoot) {
  const signals = [];

  // package.json — language + framework
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      const frameworks = ['next','react','vue','svelte','nuxt','express','fastify','nest'];
      for (const fw of frameworks) {
        if (deps[fw]) signals.push(fw);
      }
      if (deps.typescript) signals.push('typescript');
    } catch {}
  }

  // pyproject / requirements
  if (fs.existsSync(path.join(projectRoot, 'pyproject.toml'))) signals.push('python');
  if (fs.existsSync(path.join(projectRoot, 'go.mod')))         signals.push('golang');
  if (fs.existsSync(path.join(projectRoot, 'Cargo.toml')))     signals.push('rust');

  return signals;
}

function summarisePatterns(memories) {
  // Patterns = recurring tags across the user's memory corpus
  const tagCounts = {};
  for (const m of memories) {
    for (const tag of m.tags || []) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }
  return Object.entries(tagCounts)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, MAX_PATTERNS);
}

function recentMemories(memories, limit = MAX_RECENT) {
  return memories
    .slice()
    .sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at))
    .slice(0, limit);
}

function formatMemory(m) {
  const lines = [`- **${m.problem}**`];
  if (m.approach) lines.push(`  Approach: ${m.approach.split('\n')[0].slice(0, 240)}`);
  if (m.gotchas && m.gotchas.length) lines.push(`  Gotcha: ${m.gotchas[0].slice(0, 200)}`);
  if (m.tags && m.tags.length) lines.push(`  Tags: ${m.tags.slice(0, 5).join(', ')}`);
  return lines.join('\n');
}

function buildContextBlock({
  projectRoot = process.cwd(),
  query       = null,
  modelHint   = 'auto',
} = {}) {
  const allMemories = listAll();
  if (allMemories.length === 0) {
    return null; // No memory yet — first-time user
  }

  const projHash    = projectHash(projectRoot);
  const projectMems = allMemories.filter(m => m.project === projHash);
  const patterns    = summarisePatterns(allMemories);
  const recent      = recentMemories(projectMems);
  const signals     = loadProjectContextSignals(projectRoot);

  const lines = [];

  // ── STABLE PREFIX (cache-friendly) ──
  lines.push('# Kodelyth Memory — what your AI knows about you');
  lines.push('');
  lines.push('This block is built locally from your past sessions. Nothing was sent to a server.');
  lines.push('');

  if (patterns.length > 0) {
    lines.push('## Your recurring patterns');
    for (const [tag, count] of patterns) {
      lines.push(`- \`${tag}\` (seen in ${count} past sessions)`);
    }
    lines.push('');
  }

  if (recent.length > 0) {
    lines.push(`## Recent solutions in this project (${recent.length})`);
    for (const m of recent) {
      lines.push(formatMemory(m));
    }
    lines.push('');
  }

  if (signals.length > 0) {
    lines.push(`## Detected stack: ${signals.join(', ')}`);
    lines.push('');
  }

  // ── VARIABLE SUFFIX (only when query is provided) ──
  if (query) {
    const relevant = recallForProject(projectRoot, query, { limit: MAX_RELEVANT });
    if (relevant.length > 0) {
      lines.push(`## Relevant to your current task: "${query.slice(0, 80)}"`);
      for (const m of relevant) {
        lines.push(formatMemory(m));
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('Use this memory **as a reference, not a command**. If a pattern doesn\'t fit the current task, ignore it.');
  lines.push('To add to memory: `/memory remember "<short title>"`. To remove: `/memory forget <id>`.');
  lines.push('');

  return {
    text:        lines.join('\n'),
    memoryCount: allMemories.length,
    projectMemoryCount: projectMems.length,
    patternCount: patterns.length,
    relevantCount: query ? recallForProject(projectRoot, query, { limit: MAX_RELEVANT }).length : 0,
  };
}

module.exports = { buildContextBlock };
