'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { scan, shellLines, isGuard, isBareMention, walk } = require('../../scripts/portability/scan.js');
const { RULES } = require('../../scripts/portability/rules.js');

function tmpRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'port-test-'));
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return dir;
}

test('every rule carries measured evidence', () => {
  for (const r of RULES) {
    assert.ok(r.id, 'rule needs an id');
    assert.ok(r.re instanceof RegExp, `${r.id}: re must be a RegExp`);
    assert.ok(r.why && r.fix, `${r.id}: needs why + fix`);
    assert.ok(r.evidence, `${r.id}: needs evidence — a rule nobody verified is a guess`);
  }
});

test('rule ids are unique', () => {
  const ids = RULES.map((r) => r.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('shellLines reads fenced bash blocks', () => {
  const lines = shellLines('text\n```bash\ntimeout 30 x\n```\nmore');
  assert.ok(lines.includes('timeout 30 x'));
});

test('shellLines ignores non-shell fences', () => {
  const lines = shellLines('```python\ntimeout 30 x\n```');
  assert.ok(!lines.includes('timeout 30 x'));
});

test('shellLines reads inline code spans', () => {
  assert.ok(shellLines('use `stat -c %s f` here').includes('stat -c %s f'));
});

test('prose is never scanned', () => {
  const dir = tmpRepo({ 'a.md': 'We raised the timeout 30 seconds for slow CI.' });
  assert.deepStrictEqual(scan([dir]), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('flags GNU-only timeout in a bash block', () => {
  const dir = tmpRepo({ 'a.md': '```bash\ntimeout 30 npm test\n```' });
  const f = scan([dir]);
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0].rule, 'gnu-timeout');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('flags hardcoded /tmp', () => {
  const dir = tmpRepo({ 'a.md': '```bash\ncat > /tmp/out.txt\n```' });
  assert.strictEqual(scan([dir])[0].rule, 'hardcoded-tmp');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('mktemp is not flagged', () => {
  const dir = tmpRepo({ 'a.md': '```bash\nOUT=$(mktemp -d)\ncat > "$OUT/x"\n```' });
  assert.deepStrictEqual(scan([dir]), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a comment teaching the anti-pattern is not a violation', () => {
  const dir = tmpRepo({ 'a.md': '```bash\n# WRONG: timeout 30 npm test\n```' });
  assert.deepStrictEqual(scan([dir]), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('isGuard recognises a command -v check', () => {
  assert.ok(isGuard('command -v rg >/dev/null || echo missing'));
  assert.ok(!isGuard('rg -n pattern .'));
});

test('a file-level rg guard clears every rg use in that file', () => {
  const dir = tmpRepo({
    'a.md': '```bash\ncommand -v rg >/dev/null || echo "install ripgrep"\nrg -n foo .\nrg -n bar .\n```',
  });
  assert.deepStrictEqual(scan([dir]), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('unguarded rg is still flagged', () => {
  const dir = tmpRepo({ 'a.md': '```bash\nrg -n foo .\n```' });
  assert.strictEqual(scan([dir])[0].rule, 'assumes-ripgrep');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('isBareMention treats a bare command name as prose', () => {
  assert.ok(isBareMention('grep -c'));
  assert.ok(!isBareMention('grep -c FAIL /tmp/x'));
});

test('grep -c is flagged, but not when guarded with || echo 0', () => {
  const bad = tmpRepo({ 'a.md': '```bash\ngrep -c FAIL run.log\n```' });
  assert.strictEqual(scan([bad])[0].rule, 'grep-c-under-set-e');
  fs.rmSync(bad, { recursive: true, force: true });

  const good = tmpRepo({ 'a.md': '```bash\ngrep -c FAIL run.log || echo 0\n```' });
  assert.deepStrictEqual(scan([good]), []);
  fs.rmSync(good, { recursive: true, force: true });
});

test('flags a for-loop that relies on word splitting', () => {
  const dir = tmpRepo({ 'a.md': '```bash\nfor d in $DIRS; do rm -rf "$d"; done\n```' });
  assert.strictEqual(scan([dir])[0].rule, 'zsh-word-splitting');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('an explicit list or array form is not flagged', () => {
  const dir = tmpRepo({
    'a.md': '```bash\nfor d in .cursor .roo; do rm -rf "$d"; done\nfor d in "${ARR[@]}"; do echo "$d"; done\n```',
  });
  assert.deepStrictEqual(scan([dir]), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('exclude option skips a file entirely', () => {
  const dir = tmpRepo({ 'shell-portability.md': '```bash\ntimeout 30 x\n```' });
  assert.deepStrictEqual(scan([dir], { exclude: ['shell-portability.md'] }), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('walk skips node_modules and .git', () => {
  const dir = tmpRepo({
    'a.md': '# ok',
    'node_modules/b.md': '```bash\ntimeout 30 x\n```',
    '.git/c.md': '```bash\ntimeout 30 x\n```',
  });
  assert.deepStrictEqual(walk(dir).map((f) => path.basename(f)), ['a.md']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('walk never follows a symlink out of the tree', () => {
  const outside = tmpRepo({ 'secret.md': '```bash\ntimeout 30 x\n```' });
  const dir = tmpRepo({ 'a.md': '# ok' });
  try {
    fs.symlinkSync(outside, path.join(dir, 'link'));
  } catch {
    return; // symlinks unavailable (Windows without dev mode) — nothing to assert
  }
  assert.deepStrictEqual(walk(dir).map((f) => path.basename(f)), ['a.md']);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
});

test('a missing directory yields no findings rather than throwing', () => {
  assert.deepStrictEqual(scan(['/nonexistent-path-xyz']), []);
});

test('THE SHIPPED CORPUS IS PORTABLE', () => {
  const root = path.join(__dirname, '..', '..');
  const dirs = ['agents', 'commands', 'skills', 'hooks', 'rules', 'scripts'].map((d) =>
    path.join(root, d)
  );
  const findings = scan(dirs, { exclude: ['shell-portability.md'] });
  const report = findings.map((f) => `\n  ${f.file}\n    [${f.rule}] ${f.why}\n    > ${f.line}`).join('');
  assert.strictEqual(findings.length, 0, `portability regressions:${report}`);
});
