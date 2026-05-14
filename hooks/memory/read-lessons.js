#!/usr/bin/env node
// =============================================================================
// Kodelyth ECC — Lessons + Project DNA Hook (SessionStart)
//
// Runs at the start of every Claude Code session. Does two things:
//
//   1. LESSONS: Reads tasks/lessons.md from the project root (if it exists)
//      and injects the encoded rules as high-priority context. These are
//      corrections the user made in past sessions — hard rules, not soft
//      suggestions. Claude MUST follow them for this session.
//
//   2. PROJECT DNA: Detects the tech stack, package manager, and key
//      conventions from the project root (package.json, go.mod, Cargo.toml,
//      etc.) and injects a concise project brief so Claude doesn't need to
//      re-discover basics each session.
//
// Output contract: emit { additionalContext: "..." } to stdout.
// Never block a session — exit 0 even on any error.
// =============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', run);
setTimeout(() => { if (!process.stdin.readableEnded) run(); }, 150);

function run() {
  try {
    const payload = raw ? JSON.parse(raw) : {};
    const projectRoot = payload.cwd || payload.project_root || process.cwd();

    const parts = [];

    const lessons = readLessons(projectRoot);
    if (lessons) parts.push(lessons);

    const dna = buildProjectDNA(projectRoot);
    if (dna) parts.push(dna);

    if (parts.length === 0) {
      process.exit(0);
    }

    process.stdout.write(JSON.stringify({
      additionalContext: parts.join('\n\n---\n\n'),
      meta: { source: 'kodelyth-ecc:read-lessons', hasLessons: !!lessons, hasDNA: !!dna },
    }));
    process.exit(0);
  } catch (err) {
    process.stderr.write(`[ecc:read-lessons] ${err.message}\n`);
    process.exit(0);
  }
}

// ── Read tasks/lessons.md and format as hard rules ────────────────────────
function readLessons(projectRoot) {
  const lessonsFile = path.join(projectRoot, 'tasks', 'lessons.md');
  if (!fs.existsSync(lessonsFile)) return null;

  const content = fs.readFileSync(lessonsFile, 'utf8').trim();
  if (!content) return null;

  // Extract all bullet rules across all dated sections
  const rules = content
    .split('\n')
    .filter(line => line.match(/^-\s+.{5,}/))
    .map(line => line.trim())
    .filter(Boolean);

  if (rules.length === 0) return null;

  return [
    '## PROJECT LESSONS — HARD RULES (from past corrections)',
    '',
    'These rules were encoded from corrections made in previous sessions.',
    'You MUST follow them for this entire session. They override generic defaults.',
    '',
    rules.join('\n'),
  ].join('\n');
}

// ── Detect project tech stack and conventions ─────────────────────────────
function buildProjectDNA(projectRoot) {
  const facts = [];

  // Node / JS / TS
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const name = pkg.name || path.basename(projectRoot);
      facts.push(`Project: ${name} (Node.js / JavaScript)`);

      // Package manager
      if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) {
        facts.push('Package manager: pnpm');
      } else if (fs.existsSync(path.join(projectRoot, 'bun.lockb')) || fs.existsSync(path.join(projectRoot, 'bun.lock'))) {
        facts.push('Package manager: bun');
      } else if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) {
        facts.push('Package manager: yarn');
      } else {
        facts.push('Package manager: npm');
      }

      // Framework detection
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const frameworks = [];
      if (deps.next) frameworks.push(`Next.js ${deps.next}`);
      if (deps.react) frameworks.push(`React ${deps.react}`);
      if (deps.vue) frameworks.push(`Vue ${deps.vue}`);
      if (deps.svelte) frameworks.push(`Svelte`);
      if (deps.express) frameworks.push(`Express ${deps.express}`);
      if (deps.fastify) frameworks.push(`Fastify`);
      if (deps.nestjs || deps['@nestjs/core']) frameworks.push('NestJS');
      if (deps.typescript || deps['ts-node']) frameworks.push('TypeScript');
      if (deps.prisma || deps['@prisma/client']) frameworks.push('Prisma');
      if (deps.drizzle) frameworks.push('Drizzle ORM');
      if (frameworks.length > 0) facts.push(`Stack: ${frameworks.join(', ')}`);

      // Test runner
      if (deps.jest) facts.push('Test runner: Jest');
      else if (deps.vitest) facts.push('Test runner: Vitest');
      else if (deps.mocha) facts.push('Test runner: Mocha');
    } catch {}
  }

  // Go
  const goModPath = path.join(projectRoot, 'go.mod');
  if (fs.existsSync(goModPath)) {
    try {
      const goMod = fs.readFileSync(goModPath, 'utf8');
      const moduleLine = goMod.match(/^module (.+)/m);
      const goVersion  = goMod.match(/^go (.+)/m);
      facts.push(`Project: ${moduleLine?.[1] || 'Go module'} (Go${goVersion ? ' ' + goVersion[1] : ''})`);
    } catch {}
  }

  // Rust
  const cargoPath = path.join(projectRoot, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    try {
      const cargo = fs.readFileSync(cargoPath, 'utf8');
      const name  = cargo.match(/^name\s*=\s*"(.+)"/m);
      facts.push(`Project: ${name?.[1] || 'Rust crate'} (Rust / Cargo)`);
    } catch {}
  }

  // Python
  const reqPath   = path.join(projectRoot, 'requirements.txt');
  const pyprojPath = path.join(projectRoot, 'pyproject.toml');
  if (fs.existsSync(reqPath) || fs.existsSync(pyprojPath)) {
    facts.push('Language: Python');
    if (fs.existsSync(path.join(projectRoot, 'poetry.lock'))) facts.push('Package manager: Poetry');
    else if (fs.existsSync(path.join(projectRoot, 'Pipfile.lock'))) facts.push('Package manager: Pipenv');
    else facts.push('Package manager: pip');
  }

  // Java / Kotlin
  if (fs.existsSync(path.join(projectRoot, 'build.gradle')) || fs.existsSync(path.join(projectRoot, 'build.gradle.kts'))) {
    facts.push('Build: Gradle (Java / Kotlin)');
  }
  if (fs.existsSync(path.join(projectRoot, 'pom.xml'))) {
    facts.push('Build: Maven (Java)');
  }

  // Existing tasks/todo.md
  const todoPath = path.join(projectRoot, 'tasks', 'todo.md');
  if (fs.existsSync(todoPath)) {
    const todo = fs.readFileSync(todoPath, 'utf8').trim();
    const openItems = todo.split('\n').filter(l => l.match(/^-\s*\[ \]/)).slice(0, 5);
    if (openItems.length > 0) {
      facts.push('');
      facts.push('Open tasks (from tasks/todo.md):');
      openItems.forEach(item => facts.push(item.trim()));
    }
  }

  if (facts.length === 0) return null;

  return [
    '## PROJECT DNA (auto-detected)',
    '',
    facts.join('\n'),
  ].join('\n');
}
