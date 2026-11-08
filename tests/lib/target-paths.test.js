'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const {
  canonTarget,
  getTargetSkillsDir,
  getTargetCommandsDir,
} = require('../../scripts/lib/target-paths.js');

const HOME = '/fake/home';
const CWD = '/fake/project';
const opts = { home: HOME, cwd: CWD };

test('canonTarget normalises the three aliases and passes the rest through', () => {
  assert.strictEqual(canonTarget('claude-code'), 'claude-home');
  assert.strictEqual(canonTarget('gemini-cli'), 'gemini-home');
  assert.strictEqual(canonTarget('cursor'), 'cursor-project');
  assert.strictEqual(canonTarget('roocode'), 'roocode');
  assert.strictEqual(canonTarget('kiro'), 'kiro');
});

test('roocode / aider / kimi resolve to their project skill+command dirs (the fix)', () => {
  // These were previously null, so /terse was silently skipped on these IDEs.
  assert.strictEqual(getTargetSkillsDir('roocode', opts), path.join(CWD, '.roo', 'skills'));
  assert.strictEqual(getTargetCommandsDir('roocode', opts), path.join(CWD, '.roo', 'commands'));

  assert.strictEqual(getTargetSkillsDir('aider', opts), path.join(CWD, '.aider-ecc', 'skills'));
  assert.strictEqual(getTargetCommandsDir('aider', opts), path.join(CWD, '.aider-ecc', 'commands'));

  assert.strictEqual(getTargetSkillsDir('kimi', opts), path.join(CWD, '.kimi', 'skills'));
  assert.strictEqual(getTargetCommandsDir('kimi', opts), path.join(CWD, '.kimi', 'commands'));
});

test('cline and kiro return null on purpose (no file-copy mechanism)', () => {
  assert.strictEqual(getTargetSkillsDir('cline', opts), null);
  assert.strictEqual(getTargetCommandsDir('cline', opts), null);
  assert.strictEqual(getTargetSkillsDir('kiro', opts), null);
  assert.strictEqual(getTargetCommandsDir('kiro', opts), null);
});

test('an unknown target returns null, not a throw', () => {
  assert.strictEqual(getTargetSkillsDir('totally-made-up', opts), null);
  assert.strictEqual(getTargetCommandsDir('totally-made-up', opts), null);
});

test('existing home-scoped targets are unchanged (no regression)', () => {
  assert.strictEqual(getTargetSkillsDir('claude-code', opts), path.join(HOME, '.claude', 'skills'));
  assert.strictEqual(getTargetCommandsDir('claude-code', opts), path.join(HOME, '.claude', 'commands'));
  assert.strictEqual(getTargetSkillsDir('codex-home', opts), path.join(HOME, '.codex', 'skills'));
  assert.strictEqual(getTargetSkillsDir('opencode', opts), path.join(HOME, '.config', 'opencode', 'skills'));
  // windsurf (home + project) both map to the shared Codeium dir.
  assert.strictEqual(getTargetSkillsDir('windsurf-home', opts), path.join(HOME, '.codeium', 'windsurf', 'skills'));
  assert.strictEqual(getTargetSkillsDir('windsurf-project', opts), path.join(HOME, '.codeium', 'windsurf', 'skills'));
});

test('project-scoped gemini uses cwd; home-scoped gemini uses home', () => {
  assert.strictEqual(getTargetSkillsDir('gemini-project', opts), path.join(CWD, '.gemini', 'skills'));
  assert.strictEqual(getTargetSkillsDir('gemini-cli', opts), path.join(HOME, '.gemini', 'skills')); // alias → gemini-home
});
