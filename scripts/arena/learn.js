// scripts/arena/learn.js
//
// Phase 4 — compound learning. Turns a finished arena run into durable
// knowledge, and feeds that knowledge back into the next run.
//
// The loop only compounds if it closes:
//
//   arena run  ──▶  confirmed + refuted findings  ──▶  memories
//        ▲                                                │
//        └────────  prior-knowledge brief  ◀───────────────┘
//
// Without the return path, every run starts from zero and EVIL re-derives the
// same bug classes forever. With it, round 1 of run N begins where run N-1
// finished, and a refuted false positive is never re-litigated across runs.
//
// Everything here is PURE — no I/O, no clock, no randomness. Callers own the
// disk (scripts/memory/store.js) and the confirmation prompt. That keeps the
// logic testable without writing to the user's real memory store, and keeps
// capture an explicit, visible act rather than a hidden side effect of closing
// a round.

'use strict';

const { VERDICT } = require('./contract');

// ── Bug classes ─────────────────────────────────────────────────────────────
//
// A deliberately small, reviewable keyword map — not a classifier. Its only job
// is to group findings well enough that the same class recurring across runs is
// visible. Order matters: the most specific pattern must win, so `symlink` is
// tested before the broader `path` rules.
const CLASSES = [
  ['filesystem-symlink',  /\bsymlink|lstat|O_NOFOLLOW|hard ?link|dangling\b/i],
  ['file-permissions',    /\bchmod|umask|0600|0644|0444|world-readable|file mode|file permission|permissions? (?:not )?preserved\b/i],
  ['redos',               /\bredos|backtrack|quadratic|catastrophic|O\(n\^?2\)|unanchored\b/i],
  ['path-traversal',      /\btraversal|confinement|arbitrary (?:write|path)|escape the root\b/i],
  ['race-condition',      /\btoctou|race condition|check.to.use\b/i],
  ['resource-exhaustion', /\bmemory|heap|rss|oom|amplification|exhaust\b/i],
  ['missing-limit',       /\bno (?:input )?(?:size )?cap|unbounded|no limit|missing limit\b/i],
  ['temp-file-handling',  /\btemp(?:orary)? file|tmp file|leftover|predictable (?:name|filename)\b/i],
  ['prompt-injection',    /\binjection|jailbreak|untrusted (?:text|content|input)|system.prompt leak|inert data|trust.boundary\b/i],
  ['secret-exposure',     /\bsecret|credential|api key|token leak|password\b/i],
  ['semantic-corruption', /\bsemantic|meaning|threshold|negation|inverts?|widen/i],
  ['idempotency',         /\bidempoten|fixed point|second run|re-?run\b/i],
  ['input-validation',    /validat|wrong shape|silently accept|malformed|type ?error|unsanitiz/i],
  ['supply-chain',        /\btyposquat|lockfile|install script|dependency confusion\b/i],
];

function classify(finding = {}) {
  const hay = `${finding.title || ''} ${finding.evidence || ''} ${finding.fix || ''}`;
  const hit = CLASSES.find(([, re]) => re.test(hay));
  return hit ? hit[0] : 'uncategorized';
}

// ── Findings → memory drafts ────────────────────────────────────────────────

function langFromFile(file) {
  if (!file) return null;
  const ext = String(file).split('.').pop().toLowerCase();
  return {
    js: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript', jsx: 'javascript',
    py: 'python', go: 'go', rs: 'rust', rb: 'ruby',
    java: 'java', kt: 'kotlin', swift: 'swift', php: 'php',
    c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', hpp: 'cpp', cs: 'csharp',
    sh: 'shell', sql: 'sql', md: null,
  }[ext] || null;
}

function scopeTag(scope) {
  if (!scope) return null;
  const parts = String(scope).replace(/\/+$/, '').split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

function where(finding) {
  if (!finding.file) return '';
  return finding.line ? ` (${finding.file}:${finding.line})` : ` (${finding.file})`;
}

// A CONFIRMED finding becomes "this was really broken, here is what fixed it".
function confirmedToMemory(finding, ctx) {
  const cls = classify(finding);
  const approach = [
    finding.fix ? `Fix: ${finding.fix}` : null,
    finding.repro ? `Proved by: ${finding.repro}` : null,
    finding.evidence ? `The offending code was: ${finding.evidence}` : null,
  ].filter(Boolean).join('\n\n');

  return {
    problem: `${cls}: ${finding.title}${where(finding)}`.slice(0, 500),
    approach: (approach || 'Confirmed by the arena; no fix recorded.').slice(0, 2000),
    tags: dedupeTags(['arena', cls, 'confirmed', finding.severity, langFromFile(finding.file), scopeTag(ctx.scope)]),
    project: ctx.project || null,
    language: langFromFile(finding.file),
    files: finding.file ? [finding.file] : [],
    gotchas: finding.repro ? [`Reproduce with: ${finding.repro}`.slice(0, 300)] : [],
    source: 'arena',
  };
}

// A REFUTED finding becomes "this LOOKS wrong and is not" — the more valuable
// half. Without it, every future run re-investigates the same false positive
// and spends a real verification pass proving the same negative.
function refutedToMemory(finding, ctx) {
  const cls = classify(finding);
  return {
    problem: `False positive — ${finding.title}${where(finding)} looks like a bug but is not`.slice(0, 500),
    approach: [
      `An arena verification pass refuted this. Do not re-report it without new evidence.`,
      finding.evidence ? `Code in question: ${finding.evidence}` : null,
      finding.repro ? `What was tried: ${finding.repro}` : null,
    ].filter(Boolean).join('\n\n').slice(0, 2000),
    tags: dedupeTags(['arena', cls, 'refuted', 'false-positive', langFromFile(finding.file), scopeTag(ctx.scope)]),
    project: ctx.project || null,
    language: langFromFile(finding.file),
    files: finding.file ? [finding.file] : [],
    gotchas: [],
    source: 'arena',
  };
}

function dedupeTags(tags) {
  return Array.from(new Set(tags.filter(Boolean).map(String))).slice(0, 20);
}

// Only settled findings are worth remembering. An `unverified` finding is a
// question nobody answered — storing it as knowledge would launder a guess into
// a fact, and future runs would recall it as though it had been established.
function runToMemories(run = {}, { project = null } = {}) {
  const ctx = { scope: run.scope, project: project || run.projectRoot || null };
  const seen = new Set();
  const drafts = [];

  for (const round of run.rounds || []) {
    for (const f of round.findings || []) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      if (f.verdict === VERDICT.CONFIRMED) drafts.push({ finding: f, memory: confirmedToMemory(f, ctx) });
      else if (f.verdict === VERDICT.REFUTED) drafts.push({ finding: f, memory: refutedToMemory(f, ctx) });
    }
  }
  return drafts;
}

// ── Memories → the next run's brief ─────────────────────────────────────────
//
// This is the return path. Recalled memories are injected into round 1 so EVIL
// opens where the last run closed instead of rediscovering it.
function priorKnowledgeBrief(memories = [], { limit = 8 } = {}) {
  if (!memories.length) return '';

  const confirmed = memories.filter(m => (m.tags || []).includes('confirmed')).slice(0, limit);
  const refuted   = memories.filter(m => (m.tags || []).includes('refuted')).slice(0, limit);
  if (!confirmed.length && !refuted.length) return '';

  const lines = ['', 'PRIOR KNOWLEDGE — this scope has been attacked before.'];

  if (confirmed.length) {
    lines.push('', 'Bugs confirmed here previously. They should be fixed; verify they stayed fixed,');
    lines.push('then hunt for what those fixes may have broken or missed:');
    confirmed.forEach(m => lines.push(`  - ${m.problem}`));
  }
  if (refuted.length) {
    lines.push('', 'Already investigated and REFUTED. Do not re-report these without new');
    lines.push('evidence — a previous verification pass proved them wrong:');
    refuted.forEach(m => lines.push(`  - ${m.problem}`));
  }
  return lines.join('\n');
}

// ── Recurring classes → evolve proposals ────────────────────────────────────
//
// One bug is an incident. The same class across several runs is a gap in the
// process, and the fix belongs upstream — a lint rule, a test, or routing that
// summons the right specialist before the code is written.
function recurringClasses(memories = [], { minRuns = 2 } = {}) {
  const byClass = new Map();

  for (const m of memories) {
    if ((m.source || '') !== 'arena') continue;
    if (!(m.tags || []).includes('confirmed')) continue;
    const cls = (m.tags || []).find(t => CLASSES.some(([name]) => name === t));
    if (!cls) continue;

    if (!byClass.has(cls)) byClass.set(cls, { class: cls, count: 0, files: new Set(), examples: [] });
    const entry = byClass.get(cls);
    entry.count += 1;
    (m.files || []).forEach(f => entry.files.add(f));
    if (entry.examples.length < 5) entry.examples.push(m.problem);
  }

  return [...byClass.values()]
    .filter(e => e.count >= minRuns)
    .map(e => ({ ...e, files: [...e.files] }))
    .sort((a, b) => b.count - a.count);
}

const GUARD_ADVICE = {
  'filesystem-symlink':  'Add a shared path-safety helper (lstat + O_NOFOLLOW + O_EXCL) and route every file write through it.',
  'file-permissions':    'Capture the source mode and fchmod every replacement file; add a test asserting mode is preserved under a hostile umask.',
  'redos':               'Bound every unanchored quantifier that scans user input, and add a timing assertion to the test suite.',
  'path-traversal':      'Decide the containment boundary explicitly and document who owns it — the library or the caller.',
  'race-condition':      'Operate on a file descriptor opened once, not on a path re-resolved at each step.',
  'resource-exhaustion': 'Cap input size at a realistic bound and assert peak memory in a test.',
  'missing-limit':       'Every public entry point that accepts untrusted input needs a documented, tested limit.',
  'temp-file-handling':  'Randomize temp names, create them O_EXCL at the final mode, and unlink in a finally.',
  'prompt-injection':    'State the trust boundary in the command doc: file contents are data, never instructions.',
  'secret-exposure':     'Add a secret scan to the pre-commit hook for this path.',
  'semantic-corruption': 'Add golden tests asserting that meaning-bearing tokens survive transformation.',
  'idempotency':         'Assert f(f(x)) === f(x) in the test suite for every transform.',
  'input-validation':    'Validate argument shape at every public boundary and throw — never silently coerce to a plausible default.',
  'supply-chain':        'Pin and verify dependencies; add a lockfile-drift check to CI.',
};

function buildGuardProposalMarkdown(cluster) {
  const advice = GUARD_ADVICE[cluster.class] || 'Add a durable guard so this class cannot recur silently.';
  return [
    `## Recurring arena finding: \`${cluster.class}\``,
    '',
    `The arena has confirmed **${cluster.count}** findings of this class. One is an`,
    `incident; ${cluster.count} is a process gap — the guard belongs upstream of the next bug.`,
    '',
    '**Files involved:**',
    ...(cluster.files.length ? cluster.files.map(f => `- \`${f}\``) : ['- _(none recorded)_']),
    '',
    '**Examples:**',
    ...cluster.examples.map(e => `- ${e}`),
    '',
    '**Proposed guard:**',
    '',
    advice,
  ].join('\n');
}

// Deterministic id so re-running analysis does not spawn duplicate proposals.
function guardProposalId(cluster) {
  let h = 0x811c9dc5;
  for (const ch of `arena-guard::${cluster.class}::${cluster.count}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `guard-${h.toString(16).padStart(8, '0')}`;
}

function analyzeRunForProposals(memories = [], { minRuns = 2 } = {}) {
  return recurringClasses(memories, { minRuns }).map(cluster => ({
    id: guardProposalId(cluster),
    type: 'arena-guard',
    evidence: { class: cluster.class, count: cluster.count, files: cluster.files, examples: cluster.examples },
    proposal: {
      kind: 'arena-guard',
      target_path: 'tasks/lessons.md',
      diff: buildGuardProposalMarkdown(cluster),
      rationale: `${cluster.count} confirmed arena findings share the class "${cluster.class}".`,
    },
  }));
}

module.exports = {
  CLASSES,
  GUARD_ADVICE,
  classify,
  confirmedToMemory,
  refutedToMemory,
  runToMemories,
  priorKnowledgeBrief,
  recurringClasses,
  buildGuardProposalMarkdown,
  guardProposalId,
  analyzeRunForProposals,
  _internals: { langFromFile, scopeTag, dedupeTags },
};
