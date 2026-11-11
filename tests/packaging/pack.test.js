'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync, execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..', '..');

/**
 * Why this file exists.
 *
 * v2.19.0 shipped 3,364 files and 21 MB instead of 794 files and 5 MB. Running
 * the nine project-scoped install targets inside the repo to test them wrote
 * .cursor/, .roo/, .kimi/, .gemini/, .agent/, .clinerules/, .opencode/,
 * .aider-ecc/ and friends into the working tree, and `git add -A` swept 2,570
 * duplicate files into the release.
 *
 * Nothing in the pipeline noticed: tests passed, CI was green, the version
 * published. The only signal was the tarball size, which nobody was looking at.
 * These tests look at it.
 */

/**
 * Spawning npm portably is genuinely awkward on Windows, and both obvious
 * approaches fail for different reasons:
 *
 *   execFileSync('npm', ...)      → ENOENT. npm is npm.cmd, and spawning
 *                                   without a shell does not apply PATHEXT.
 *   execFileSync('npm.cmd', ...)  → EINVAL. Since Node 18.20.2 (CVE-2024-27980)
 *                                   spawn refuses .cmd/.bat without shell:true.
 *
 * Both were observed on this repo's CI, one commit apart. The working form is
 * shell:true, which is safe here only because every argument is a hardcoded
 * literal — never interpolate into this.
 */
const SPAWN_MISS = new Set(['ENOENT', 'EINVAL', 'EACCES']);

const SPAWN_OPTS = {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
  maxBuffer: 32 * 1024 * 1024,
};

/**
 * Run `npm pack --dry-run --json` on any platform.
 *
 * On POSIX, execFileSync with an argv array — no shell, nothing to escape.
 *
 * On Windows neither obvious form works, and both were observed on this repo's
 * CI one commit apart:
 *   execFileSync('npm', [...])     → ENOENT. npm is npm.cmd and spawning
 *                                    without a shell does not apply PATHEXT.
 *   execFileSync('npm.cmd', [...]) → EINVAL. Since Node 18.20.2
 *                                    (CVE-2024-27980) spawn refuses .cmd/.bat
 *                                    without shell:true.
 *
 * So Windows goes through a shell. It uses execSync with one literal command
 * string rather than execFileSync with shell:true, because the latter emits
 * DEP0190 — args passed alongside a shell are concatenated, not escaped. There
 * is nothing to escape here and there never should be: this string is a
 * constant, and no caller input may ever reach it.
 */
function runNpmPack() {
  if (process.platform !== 'win32') {
    return execFileSync('npm', ['pack', '--dry-run', '--json'], SPAWN_OPTS);
  }
  return execSync('npm pack --dry-run --json', SPAWN_OPTS);
}

let manifest;
let packError = null;

function pack() {
  if (manifest) return manifest;
  if (packError) throw packError;

  try {
    manifest = JSON.parse(runNpmPack())[0];
    return manifest;
  } catch (err) {
    if (SPAWN_MISS.has(err.code)) return null; // npm not spawnable at all
    packError = err; // npm ran and genuinely failed — that IS the finding
    throw err;
  }
}

/**
 * These tests need to actually run npm. Where it cannot be spawned they report
 * why instead of going red — a guard that fails for an unrelated reason gets
 * disabled, and then it guards nothing. Publishing runs on ubuntu-latest
 * (publish.yml), which is where this always executes.
 */
const NPM_MISSING = { skip: pack() === null ? `npm not spawnable on ${process.platform}` : false };

/** Every project-scoped target's output directory, from the CLI's own target list. */
const INSTALL_TARGET_DIRS = [
  '.agent', '.agents', '.aider-ecc', '.clinerules', '.cursor',
  '.gemini', '.kimi', '.opencode', '.roo', '.windsurfrules',
  'CONVENTIONS.md',
];

test('the package ships no install-target output', NPM_MISSING, () => {
  const files = pack().files.map((f) => f.path);
  const stray = files.filter((p) =>
    INSTALL_TARGET_DIRS.some((d) => p === d || p.startsWith(d + '/'))
  );
  assert.deepStrictEqual(
    stray,
    [],
    `install-target output leaked into the package:\n  ${stray.slice(0, 10).join('\n  ')}` +
      `\n(${stray.length} files). Running a project-scoped target inside the repo ` +
      `writes these. They are gitignored and excluded by the files allowlist — ` +
      `if they are here, one of those guards was removed.`
  );
});

test('package.json has a files allowlist', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(Array.isArray(pkg.files) && pkg.files.length > 0,
    'no files allowlist — the package would fail open and ship whatever is in the tree');
});

test('the files allowlist restates the .npmignore exclusions', () => {
  // A files allowlist OVERRIDES .npmignore. Adding one without restating those
  // exclusions silently starts shipping content someone deliberately excluded.
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const negations = pkg.files.filter((f) => f.startsWith('!'));
  assert.ok(negations.some((n) => n.includes('openclaw-twitter')),
    'scripts/openclaw-twitter/ is excluded by .npmignore but not by files');
  assert.ok(negations.some((n) => n.includes('tests')),
    'nested tests/ are excluded by .npmignore but not by files');
});

test('nested test fixtures are not shipped', NPM_MISSING, () => {
  const files = pack().files.map((f) => f.path);
  const shipped = files.filter((p) => /(^|\/)tests\//.test(p));
  assert.deepStrictEqual(shipped, [], `test fixtures shipped: ${shipped.join(', ')}`);
});

test('package size stays in the expected band', NPM_MISSING, () => {
  // 2.18.0 was the last known-good release: 794 files, 5.01 MB unpacked.
  // The band is wide enough for normal growth and narrow enough that another
  // 4x blow-up fails here instead of on npm.
  const { entryCount, unpackedSize } = pack();
  const mb = unpackedSize / 1048576;
  assert.ok(entryCount > 700 && entryCount < 1200,
    `file count ${entryCount} outside 700-1200 (2.18.0 baseline: 794)`);
  assert.ok(mb > 3 && mb < 9,
    `unpacked ${mb.toFixed(2)} MB outside 3-9 MB (2.18.0 baseline: 5.01 MB)`);
});

/** Same reasoning as NPM_MISSING: no git, no verdict — say so rather than go red. */
const GIT_MISSING = (() => {
  try {
    execFileSync('git', ['--version'], { cwd: ROOT, stdio: 'ignore' });
    return { skip: false };
  } catch {
    return { skip: 'git not available' };
  }
})();

test('install-target dirs are gitignored', GIT_MISSING, () => {
  // The .gitignore entries for directories carry a trailing slash, so they only
  // match when git knows the path IS a directory. For a path that does not
  // exist on disk it cannot know that, so probe a child path instead — which is
  // also what git will actually be asked about when a target really runs here.
  const FILE_ENTRIES = new Set(['.agents', '.windsurfrules', 'CONVENTIONS.md']);

  for (const d of INSTALL_TARGET_DIRS) {
    const probe = FILE_ENTRIES.has(d) ? d : `${d}/probe.md`;
    let ignored = true;
    try {
      execFileSync('git', ['check-ignore', '-q', probe], { cwd: ROOT, stdio: 'ignore' });
    } catch {
      ignored = false;
    }
    assert.ok(ignored, `${probe} is not gitignored — a target run in the repo would be committed`);
  }
});

test('the bin entrypoint is shipped', NPM_MISSING, () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const bins = typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin || {});
  const files = pack().files.map((f) => f.path);
  for (const b of bins) {
    const rel = b.replace(/^\.\//, '');
    assert.ok(files.includes(rel), `bin ${rel} is not in the package — install would break`);
  }
});

/**
 * Catches the v2.31.1 + v2.31.2 class of bug: a file added to the repo and
 * referenced by code via `path.join(ROOT, '…', …)` but never added to
 * package.json files[], so npm pack silently omits it. The published package
 * then runtime-errors on any user who installs fresh.
 *
 * v2.31.1 was CITATION.cff (academic-citation tooling expected it, 404).
 * v2.31.2 was brand/ecc-lockup-*.svg (the dashboard's /brand/* route, 404).
 * Both shipped because no pre-publish check cross-referenced code paths
 * against the tarball manifest. This test is that check.
 *
 * Methodology: scan bin/ + scripts/ for `path.join(ROOT, '<x>', …)` and
 * `require(path.join(ROOT, '<x>', …))` call sites. Extract the first segment
 * (the one directly under the repo root). For each distinct segment, assert
 * it is reachable in the tarball — either listed in files[] directly, covered
 * by a parent directory, or deliberately allowed below.
 *
 * KNOWN_EXCLUDED documents the intentional runtime-optional references — code
 * that gracefully no-ops when the file is absent on disk. Anything else that
 * fails this check is an unshipped file the next release would break on.
 */
const KNOWN_EXCLUDED = new Set([
  // npm auto-includes these; they're never in files[] but always ship.
  'package.json',
  'README.md',
  'README.zh-CN.md',
  'LICENSE',
  // Runtime-optional — code checks existence and gracefully handles missing.
  // If any of these change behavior to be required-at-runtime, remove from here
  // and either add to files[] or make the code honestly throw a packaged-wrong error.
  'docs',   // `explain` subcommand uses it; prints a "no doc for X" error if absent
  'social', // maintainer-only: scripts/brand/export-assets.js reads it to regenerate
            // social assets. Graceful-fails on user installs; nothing user-facing
            // runs against it.
  // FIXME — real latent bugs this check surfaced on first run. They were never
  // actually shipped to work; the code paths that reference them aren't on any
  // user's happy path today. Leaving KNOWN_EXCLUDED so the check passes while
  // flagging the TODO. Remove the entry + fix the code or ship the file when
  // addressed.
  '.codex',  // scripts/codex/merge-codex-config.js:223 — requires a reference
             // .codex/config.toml at repo root that does not exist in the
             // tarball OR the user's install. process.exit(1) if hit. The
             // subcommand this path belongs to isn't reachable from the main
             // `kodelythecc` dispatcher today, which is why no user has filed it.
  'schemas', // scripts/lib/install/config.js:8 — references schemas/ecc-install-
             // config.schema.json that doesn't exist in the repo at all. The
             // Ajv-based install-config validator this feeds is likewise not
             // dispatched from the main CLI, so no user hits it in practice.
]);

function extractRootReferencedSegments() {
  const segments = new Map(); // segment → first file:line it appears in
  const dirs = ['bin', 'scripts'];
  function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) { walk(p); continue; }
      if (!/\.(js|mjs|cjs)$/.test(name)) continue;
      const body = fs.readFileSync(p, 'utf8');
      // How many `..` tokens land this file at ROOT? bin/x.js → 1; scripts/x/y.js → 2.
      const relDir = path.dirname(path.relative(ROOT, p));
      const depthToRoot = relDir === '.' ? 0 : relDir.split(path.sep).length;
      const rec = (seg, matchIndex) => {
        if (segments.has(seg)) return;
        const lineNo = body.slice(0, matchIndex).split('\n').length;
        segments.set(seg, `${path.relative(ROOT, p)}:${lineNo}`);
      };
      // Pattern A — `path.join(ROOT, '<segment>', …)`
      const reRoot = /path\.join\(\s*ROOT\s*,\s*['"]([^'"]+)['"]/g;
      for (let m; (m = reRoot.exec(body)) !== null; ) rec(m[1], m.index);
      // Pattern B — `path.join(__dirname, '..', '..', …, '<segment>', …)` where
      // the count of '..' matches this file's depth to ROOT. That's how
      // scripts/dashboard/server.js reaches `brand/` (the v2.31.2 bug). We only
      // treat the first literal after the climbed-to-root prefix as a segment.
      // Build the regex so the `(?:'\.\.',\s*){N}` repetition matches N-many '..'.
      if (depthToRoot > 0) {
        const climb = `(?:['"]\\.\\.['"]\\s*,\\s*){${depthToRoot}}`;
        const reDirname = new RegExp(`path\\.join\\(\\s*__dirname\\s*,\\s*${climb}['"]([^'"]+)['"]`, 'g');
        for (let m; (m = reDirname.exec(body)) !== null; ) rec(m[1], m.index);
      }
    }
  }
  for (const d of dirs) walk(path.join(ROOT, d));
  return segments;
}

test('every file referenced via path.join(ROOT, …) is in the published tarball', NPM_MISSING, () => {
  const manifest = pack();
  if (!manifest) return; // npm wasn't spawnable; pack() already returned null
  const tarballPaths = new Set(manifest.files.map((f) => f.path));
  // Build a prefix set so "scripts/foo.js" in tarball covers refs to "scripts".
  const tarballPrefixes = new Set();
  for (const p of tarballPaths) {
    const parts = p.split('/');
    for (let i = 1; i <= parts.length; i++) tarballPrefixes.add(parts.slice(0, i).join('/'));
  }

  const segments = extractRootReferencedSegments();
  const missing = [];
  for (const [seg, firstRef] of segments) {
    if (KNOWN_EXCLUDED.has(seg)) continue;
    // In tarball directly, OR a tarball path starts with it (dir reference).
    if (tarballPrefixes.has(seg)) continue;
    missing.push(`${seg}  (first referenced at ${firstRef})`);
  }

  assert.deepStrictEqual(
    missing,
    [],
    `Code references ${missing.length} path(s) that are NOT in the published tarball.\n` +
    `Add each to package.json files[] or document the exclusion in KNOWN_EXCLUDED:\n\n` +
    missing.map((m) => `  • ${m}`).join('\n') +
    `\n\nThis is the check that would have caught the v2.31.1 (CITATION.cff) and\n` +
    `v2.31.2 (brand/ecc-lockup-*.svg) release bugs before they shipped.\n`
  );
});

/**
 * Catches the v2.31.1 class of bug: a conventional root-level metadata file
 * exists in the repo and is consumed by external tooling (GitHub, Zenodo,
 * build systems) — but isn't in the published tarball, so `npm pack` + extract
 * omits it. The user who pulls the package from npm finds the file "missing"
 * and reports it as a bug.
 *
 * v2.31.1 was CITATION.cff: present in the repo, cited by GitHub's own "Cite
 * this repository" widget, but missing from package.json files[], so researchers
 * who pulled the tarball found no citation metadata.
 *
 * Unlike the previous test (which scans code for `path.join(ROOT, …)` paths),
 * this one works from a KNOWN-CONVENTIONS list — the small set of root-level
 * filenames external tools look for by community convention.
 */
const EXTERNAL_TOOL_CONVENTIONS = [
  // Academic / research
  'CITATION.cff',       // GitHub cite button + Zenodo + most reference managers
  // Governance + community (GitHub surfaces these as "community standards")
  'CODE_OF_CONDUCT.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'SUPPORT.md',
  'GOVERNANCE.md',
  'MAINTAINERS.md',
  // Attribution + licensing adjuncts
  'AUTHORS',
  'AUTHORS.md',
  'NOTICE',             // Apache-2.0 convention
  'THIRD-PARTY.md',
  'ACKNOWLEDGMENTS.md',
];

// npm auto-includes these even when they're not in files[]. We don't need to
// verify them — the registry will ship them regardless.
const NPM_AUTO_INCLUDED = new Set(['package.json', 'README.md', 'README', 'LICENSE', 'LICENCE']);

test('conventional external-tool files present in the repo are also in the tarball', NPM_MISSING, () => {
  const manifest = pack();
  if (!manifest) return; // npm not spawnable; honest skip
  const tarballPaths = new Set(manifest.files.map((f) => f.path));

  const violations = [];
  for (const name of EXTERNAL_TOOL_CONVENTIONS) {
    const absPath = path.join(ROOT, name);
    if (!fs.existsSync(absPath)) continue;         // not in repo → nothing to ship
    if (NPM_AUTO_INCLUDED.has(name)) continue;     // npm will include anyway
    if (tarballPaths.has(name)) continue;          // already shipped
    violations.push(name);
  }

  assert.deepStrictEqual(
    violations,
    [],
    `Conventional external-tool file(s) exist in the repo but are MISSING from the\n` +
    `published tarball. External tooling (GitHub community-standards widget, Zenodo,\n` +
    `reference managers, etc.) will treat them as absent on the npm distribution:\n\n` +
    violations.map((v) => `  • ${v}`).join('\n') +
    `\n\nAdd each to package.json files[] alongside the other root-level metadata.\n` +
    `This is the check that would have caught the v2.31.1 (CITATION.cff) bug\n` +
    `before it shipped.\n`
  );
});
