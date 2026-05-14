// =============================================================================
// Kodelyth ECC — MCP Catalog
// Read-only loader for agents, skills, commands, and rule files.
// Pure file reads. Zero side effects. Cached after first call.
// =============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

const PATHS = {
  agents:   path.join(ROOT, 'agents'),
  skills:   path.join(ROOT, 'skills'),
  commands: path.join(ROOT, 'commands'),
  rules:    path.join(ROOT, 'rules', 'common'),
  bundles:  path.join(ROOT, 'bundles'),
};

// ── Frontmatter parser ───────────────────────────────────────────────────────
// Minimal YAML frontmatter parser (key: value, supports basic > folded scalars).
// We don't need full YAML — agent/skill files use a tiny subset.
function parseFrontmatter(raw) {
  if (typeof raw !== 'string') return { meta: {}, body: '' };
  if (!raw.startsWith('---')) return { meta: {}, body: raw };

  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { meta: {}, body: raw };

  const fmText = raw.slice(3, end).replace(/^\r?\n/, '');
  const body   = raw.slice(end + 4).replace(/^\r?\n/, '');

  const meta = {};
  const lines = fmText.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
    const m = /^([A-Za-z0-9_\-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) { i++; continue; }
    const key = m[1];
    let val = m[2].trim();
    // Folded scalar: `>` or `>-`
    if (val === '>' || val === '>-' || val === '|' || val === '|-') {
      const folded = [];
      let j = i + 1;
      const baseIndent = (lines[j] || '').match(/^(\s*)/)[1].length;
      while (j < lines.length) {
        const next = lines[j];
        if (next.trim() && (next.match(/^(\s*)/)[1].length < baseIndent)) break;
        folded.push(next.slice(baseIndent));
        j++;
      }
      meta[key] = folded.join(val.startsWith('>') ? ' ' : '\n').trim();
      i = j;
      continue;
    }
    // Quoted strings
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    meta[key] = val;
    i++;
  }
  return { meta, body };
}

// ── Generic directory loader ─────────────────────────────────────────────────
function safeReadFile(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { return null; }
}

function listMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(dir, f));
}

// ── Agents ───────────────────────────────────────────────────────────────────
let _agentsCache = null;
function loadAgents() {
  if (_agentsCache) return _agentsCache;
  const out = [];
  for (const file of listMarkdownFiles(PATHS.agents)) {
    const raw = safeReadFile(file);
    if (raw === null) continue;
    const { meta, body } = parseFrontmatter(raw);
    const name = meta.name || path.basename(file, '.md');
    out.push({
      name,
      description: meta.description || '',
      file,
      relpath: path.relative(ROOT, file),
      meta,
      body,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  _agentsCache = out;
  return out;
}

// ── Skills ───────────────────────────────────────────────────────────────────
let _skillsCache = null;
function loadSkills() {
  if (_skillsCache) return _skillsCache;
  const out = [];
  if (!fs.existsSync(PATHS.skills)) { _skillsCache = out; return out; }
  for (const dir of fs.readdirSync(PATHS.skills)) {
    const skillFile = path.join(PATHS.skills, dir, 'SKILL.md');
    const raw = safeReadFile(skillFile);
    if (raw === null) continue;
    const { meta, body } = parseFrontmatter(raw);
    out.push({
      name: meta.name || dir,
      description: meta.description || '',
      origin: meta.origin || '',
      file: skillFile,
      relpath: path.relative(ROOT, skillFile),
      meta,
      body,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  _skillsCache = out;
  return out;
}

// ── Commands ─────────────────────────────────────────────────────────────────
let _commandsCache = null;
function loadCommands() {
  if (_commandsCache) return _commandsCache;
  const out = [];
  for (const file of listMarkdownFiles(PATHS.commands)) {
    const raw = safeReadFile(file);
    if (raw === null) continue;
    const { meta, body } = parseFrontmatter(raw);
    const name = meta.name || path.basename(file, '.md');
    out.push({
      name,
      description: meta.description || '',
      argumentHint: meta['argument-hint'] || '',
      file,
      relpath: path.relative(ROOT, file),
      meta,
      body,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  _commandsCache = out;
  return out;
}

// ── Rules ────────────────────────────────────────────────────────────────────
function loadRule(name) {
  const file = path.join(PATHS.rules, `${name}.md`);
  const raw = safeReadFile(file);
  if (raw === null) return null;
  return { name, file, relpath: path.relative(ROOT, file), body: raw };
}

function loadAllRules() {
  if (!fs.existsSync(PATHS.rules)) return [];
  return listMarkdownFiles(PATHS.rules).map(file => {
    const name = path.basename(file, '.md');
    return {
      name,
      file,
      relpath: path.relative(ROOT, file),
      body: safeReadFile(file) || '',
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

// ── Bundles ──────────────────────────────────────────────────────────────────
function loadBundles() {
  const out = [];
  if (!fs.existsSync(PATHS.bundles)) return out;
  for (const file of listMarkdownFiles(PATHS.bundles)) {
    const raw = safeReadFile(file);
    if (raw === null) continue;
    const name = path.basename(file, '.md');
    out.push({
      name,
      file,
      relpath: path.relative(ROOT, file),
      body: raw,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Lookups ──────────────────────────────────────────────────────────────────
function findAgent(name) {
  return loadAgents().find(a => a.name === name) || null;
}
function findSkill(name) {
  return loadSkills().find(s => s.name === name) || null;
}
function findCommand(name) {
  const target = String(name || '').replace(/^\//, '');
  return loadCommands().find(c => c.name === target) || null;
}

// ── Stats ────────────────────────────────────────────────────────────────────
function stats() {
  return {
    agents: loadAgents().length,
    skills: loadSkills().length,
    commands: loadCommands().length,
    rules: loadAllRules().length,
    bundles: loadBundles().length,
    root: ROOT,
  };
}

// ── Cache reset (mainly for tests) ───────────────────────────────────────────
function resetCache() {
  _agentsCache = null;
  _skillsCache = null;
  _commandsCache = null;
}

module.exports = {
  PATHS,
  ROOT,
  parseFrontmatter,
  loadAgents,
  loadSkills,
  loadCommands,
  loadRule,
  loadAllRules,
  loadBundles,
  findAgent,
  findSkill,
  findCommand,
  stats,
  resetCache,
};
