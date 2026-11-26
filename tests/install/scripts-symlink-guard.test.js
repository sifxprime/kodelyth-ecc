'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

/**
 * Why this file exists.
 *
 * ~/.claude/scripts could be a SYMLINK into an old `npx kodelyth-ecc` cache
 * (v1.5.3). install.sh then ran `mkdir -p`/`cp` THROUGH that link, writing into
 * the stale cache instead of ~/.claude. On top of that, the scripts step copied
 * only lib/hook-flags.js, never lib/safe-fs.js — which run-with-flags.js
 * requires. The result: the PreCompact hook crashed every compaction with
 * "Cannot find module '../lib/safe-fs.js'".
 *
 * Two guarantees are pinned here against the real install.sh:
 *   1. A pre-existing symlink at <home>/.claude/scripts is replaced by a REAL
 *      directory, and nothing is written through it into the link target.
 *   2. The full scripts/lib tree is installed — safe-fs.js present — so
 *      run-with-flags.js can load its dependency.
 */

const REPO = path.resolve(__dirname, '..', '..');
const INSTALL_SH = path.join(REPO, 'install.sh');

const hasBash = (() => {
  try { execFileSync('bash', ['--version'], { stdio: 'ignore' }); return true; }
  catch { return false; }
})();

test('install.sh replaces a symlinked scripts dir and installs lib/safe-fs.js', { skip: (!hasBash || process.platform === 'win32') ? 'needs bash (POSIX)' : false }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-install-home-'));
  const staleCache = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-stale-cache-'));
  try {
    // Simulate the broken state: a stale cache (no safe-fs.js) and ~/.claude/scripts
    // pointing at it.
    fs.mkdirSync(path.join(staleCache, 'scripts', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(staleCache, 'scripts', 'lib', 'hook-flags.js'), '// ancient\n');
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.symlinkSync(path.join(staleCache, 'scripts'), path.join(home, '.claude', 'scripts'));

    const res = spawnSync('bash', [INSTALL_SH, '--target', 'claude-home'], {
      env: { ...process.env, HOME: home },
      encoding: 'utf8',
      timeout: 180000,
    });
    assert.ok(res.status === 0, `installer should exit 0, got ${res.status}: ${res.stderr || ''}`);

    const scriptsDest = path.join(home, '.claude', 'scripts');

    // 1. No longer a symlink.
    assert.ok(!fs.lstatSync(scriptsDest).isSymbolicLink(), 'scripts must be a real directory, not a symlink');

    // 2. The dependency that crashed the hook is present.
    const safeFs = path.join(scriptsDest, 'lib', 'safe-fs.js');
    assert.ok(fs.existsSync(safeFs), 'scripts/lib/safe-fs.js must be installed');

    // 3. Nothing was written through the link into the stale cache.
    assert.ok(
      !fs.existsSync(path.join(staleCache, 'scripts', 'lib', 'safe-fs.js')),
      'installer must not write through the symlink into the stale cache',
    );

    // 4. run-with-flags.js can actually load its dependency now.
    const rwf = path.join(scriptsDest, 'hooks', 'run-with-flags.js');
    assert.ok(fs.existsSync(rwf), 'run-with-flags.js must be installed');
    const probe = spawnSync(process.execPath, [rwf, 'pre:compact', 'scripts/hooks/pre-compact.js', 'standard,strict'], {
      input: '{}',
      env: { ...process.env, HOME: home, CLAUDE_PLUGIN_ROOT: path.join(home, '.claude') },
      encoding: 'utf8',
      timeout: 30000,
    });
    assert.doesNotMatch(probe.stderr || '', /Cannot find module/, 'hook must not crash on a missing module');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(staleCache, { recursive: true, force: true });
  }
});
