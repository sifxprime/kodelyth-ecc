// =============================================================================
// Kodelyth ECC — Context Fabric (path resolver)
//
// Single source of truth for every path ECC reads or writes.
// Two layers:
//   1. GLOBAL BRAIN   ~/.kodelythecc/       (cross-project, one per machine)
//   2. PROJECT SPINE  <project>/.kodelythecc/ (per-repo, git-ignored by default)
//
// Migration: if ~/.kodelyth/ exists but ~/.kodelythecc/ does not, we treat
// the old dir as a read-only fallback so no memories are lost. New writes
// go to the new dir. Users can copy old data over when convenient.
// =============================================================================

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const crypto = require('crypto');

const HOME = os.homedir();
const LEGACY_DIR = path.join(HOME, '.kodelyth');

// Resolve env dynamically on each read so tests can swap env + clear caches.
function globalDir() {
  return process.env.KODELYTH_HOME || path.join(HOME, '.kodelythecc');
}
function memoryDir() {
  return process.env.KODELYTH_MEMORY_DIR || path.join(globalDir(), 'memory');
}

// ── Global paths (all lazy getters) ──────────────────────────────────────────
const GLOBAL = {
  get root()          { return globalDir(); },
  get memory()        { return memoryDir(); },
  get memoryLog()     { return path.join(memoryDir(), 'memories.jsonl'); },
  get memoryIndex()   { return path.join(memoryDir(), 'index.json'); },
  get memoryPending() { return path.join(memoryDir(), 'pending-review.jsonl'); },
  get patterns()      { return path.join(memoryDir(), 'patterns.json'); },
  get instincts()     { return path.join(globalDir(), 'instincts'); },
  get instinctsFile() { return path.join(globalDir(), 'instincts', 'instincts.json'); },
  get savings()       { return path.join(globalDir(), 'savings'); },
  get savingsLedger() { return path.join(globalDir(), 'savings', 'ledger.jsonl'); },
  get telemetry()     { return path.join(globalDir(), 'telemetry'); },
  get telemetryLog()  { return path.join(globalDir(), 'telemetry', 'events.jsonl'); },
  get graphCache()    { return path.join(globalDir(), 'graph-cache'); },
  get config()        { return path.join(globalDir(), 'config.json'); },
};

// ── Legacy paths (read-only fallback) ────────────────────────────────────────
const LEGACY = {
  memory:      path.join(LEGACY_DIR, 'memory'),
  memoryLog:   path.join(LEGACY_DIR, 'memory', 'memories.jsonl'),
  memoryIndex: path.join(LEGACY_DIR, 'memory', 'index.json'),
};

// ── Project paths ────────────────────────────────────────────────────────────
function project(projectRoot) {
  const root = projectRoot ? String(projectRoot) : process.cwd();
  const dir  = path.join(root, '.kodelythecc');
  return {
    root:        root,
    fabricDir:   dir,
    graph:       path.join(dir, 'graph.json'),
    graphManifest: path.join(dir, 'graph.manifest.json'),
    lessons:     path.join(dir, 'lessons.md'),
    intentCache: path.join(dir, 'intent-cache.json'),
    sessionLog:  path.join(dir, 'session-log.jsonl'),
    projectInfo: path.join(dir, 'project.json'),
    // legacy tasks/lessons.md compatibility
    legacyLessons: path.join(root, 'tasks', 'lessons.md'),
  };
}

// ── Utilities ────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function projectHash(projectRoot) {
  return crypto.createHash('sha256')
    .update(String(projectRoot))
    .digest('hex')
    .slice(0, 12);
}

// Ensure the global fabric exists.
function ensureGlobal() {
  ensureDir(GLOBAL.root);
  ensureDir(GLOBAL.memory);
  ensureDir(GLOBAL.instincts);
  ensureDir(GLOBAL.savings);
  ensureDir(GLOBAL.telemetry);
  ensureDir(GLOBAL.graphCache);
  return GLOBAL;
}

// Ensure a project spine exists. Also writes .gitignore so it stays out of git
// by default (opt-in with --commit later).
function ensureProject(projectRoot) {
  const p = project(projectRoot);
  ensureDir(p.fabricDir);
  const gi = path.join(p.fabricDir, '.gitignore');
  if (!fs.existsSync(gi)) {
    fs.writeFileSync(gi, '# Kodelyth ECC project spine — local by default\n*\n!.gitignore\n');
  }
  return p;
}

// Read a JSON file safely; return fallback on any error.
function readJson(file, fallback = null) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, obj) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

// Legacy-aware read: try new path, fall back to legacy read-only.
// Legacy fallback is skipped when the caller overrode the memory dir
// (KODELYTH_MEMORY_DIR / KODELYTH_HOME) — that means isolated store, no leaks.
function legacyEnabled() {
  return !process.env.KODELYTH_MEMORY_DIR && !process.env.KODELYTH_HOME;
}

function readLogWithLegacy(newPath, legacyPath) {
  const lines = [];
  if (legacyEnabled() && fs.existsSync(legacyPath)) {
    try {
      lines.push(...fs.readFileSync(legacyPath, 'utf8').split('\n').filter(Boolean));
    } catch {}
  }
  if (fs.existsSync(newPath)) {
    try {
      lines.push(...fs.readFileSync(newPath, 'utf8').split('\n').filter(Boolean));
    } catch {}
  }
  return lines;
}

module.exports = {
  HOME,
  GLOBAL,
  LEGACY,
  project,
  ensureGlobal,
  ensureProject,
  ensureDir,
  projectHash,
  readJson,
  writeJson,
  readLogWithLegacy,
};
