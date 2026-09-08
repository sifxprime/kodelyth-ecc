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
