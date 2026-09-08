'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { registerHooks, countEntries } = require('../../scripts/install/register-hooks.js');

/**
 * Why this file exists.
 *
 * install.sh copied hooks/hooks.json into <target>/hooks/hooks.json and stopped.
 * Claude Code reads hooks from settings.json, not from that file, so every hook
 * ECC ships was written to disk and never activated — memory inject on
 * SessionStart, memory capture and correction encoding on Stop, the
 * prompt-injection guard, the token-budget enforcer. The single PreToolUse
 * entry that showed up came from RTK's installer, not from ECC.
 *
 * It also copied only the manifest, not the hooks/memory and hooks/safety
 * scripts the manifest points at — so 17 of the entries referenced files that
 * were never installed.
 *
 * Measured on a fresh install before the fix: 1 event / 1 entry, 0 hook scripts
 * on disk. After: 8 events / 45 entries, 9 scripts, 0 dangling references.
 */

function makeTarget(hooksConfig, existingSettings) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-hooks-'));
  if (hooksConfig !== null) {
    fs.mkdirSync(path.join(root, 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(root, 'hooks', 'hooks.json'), JSON.stringify(hooksConfig, null, 2));
  }
  if (existingSettings) {
    fs.writeFileSync(path.join(root, 'settings.json'), JSON.stringify(existingSettings, null, 2));
  }
  return root;
}

const SAMPLE = {
  hooks: {
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/safety/guard.js"' }] }],
    SessionStart: [{ matcher: '*', hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/memory/inject-start.js"' }] }],
    Stop: [{ matcher: '*', hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/memory/capture-stop.js"' }] }],
  },
};

function readSettings(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'settings.json'), 'utf8'));
}

test('registers every event, not just the first', () => {
  const root = makeTarget(SAMPLE);
  const r = registerHooks(root);
  assert.strictEqual(r.status, 'ok');
  assert.deepStrictEqual(
    Object.keys(readSettings(root).hooks).sort(),
    ['PreToolUse', 'SessionStart', 'Stop']
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('resolves ${CLAUDE_PLUGIN_ROOT} to the target root', () => {
  const root = makeTarget(SAMPLE);
  registerHooks(root);
  const settings = readSettings(root);

  // Assert on the parsed values, not on JSON.stringify output. A Windows root
  // is D:\a\repo, which stringify escapes to D:\\a\\repo — so matching the raw
  // path against the JSON text fails even when substitution worked correctly.
  const commands = Object.values(settings.hooks)
    .flat()
    .flatMap((entry) => entry.hooks || [])
    .map((hook) => hook.command);

  assert.ok(commands.length > 0, 'no commands registered');
  for (const cmd of commands) {
    assert.ok(!cmd.includes('${CLAUDE_PLUGIN_ROOT}'), `placeholder left unresolved: ${cmd}`);
    assert.ok(cmd.includes(root), `target root not substituted in: ${cmd}`);
  }
  fs.rmSync(root, { recursive: true, force: true });
});

test('is idempotent — re-running adds nothing', () => {
  const root = makeTarget(SAMPLE);
  const first = registerHooks(root);
  const second = registerHooks(root);
  const third = registerHooks(root);
  assert.strictEqual(first.added, 3);
  assert.strictEqual(second.added, 0);
  assert.strictEqual(third.added, 0);
  assert.strictEqual(second.total, first.total);
  assert.strictEqual(third.total, first.total);
  fs.rmSync(root, { recursive: true, force: true });
});

test("preserves another tool's hook in the same event", () => {
  // RTK writes its own PreToolUse entry. Losing it would silently disable RTK.
  const rtk = { matcher: 'Bash', hooks: [{ type: 'command', command: 'rtk hook claude' }] };
  const root = makeTarget(SAMPLE, { hooks: { PreToolUse: [rtk] } });
  registerHooks(root);
  const kept = readSettings(root).hooks.PreToolUse.some((e) =>
    (e.hooks || []).some((h) => h.command === 'rtk hook claude')
  );
  assert.ok(kept, "another tool's hook was dropped");
  fs.rmSync(root, { recursive: true, force: true });
});

test('preserves unrelated settings keys', () => {
  const root = makeTarget(SAMPLE, { model: 'opus', theme: 'dark', permissions: { allow: ['Bash'] } });
  registerHooks(root);
  const s = readSettings(root);
  assert.strictEqual(s.model, 'opus');
  assert.strictEqual(s.theme, 'dark');
  assert.deepStrictEqual(s.permissions, { allow: ['Bash'] });
  fs.rmSync(root, { recursive: true, force: true });
});

test('a corrupt settings.json does not lose the hooks', () => {
  const root = makeTarget(SAMPLE);
  fs.writeFileSync(path.join(root, 'settings.json'), '{ this is not json');
  const r = registerHooks(root);
  assert.strictEqual(r.status, 'ok');
  assert.strictEqual(Object.keys(readSettings(root).hooks).length, 3);
  fs.rmSync(root, { recursive: true, force: true });
});

test('reports rather than throws when there is no hooks config', () => {
  const root = makeTarget(null);
  assert.strictEqual(registerHooks(root).status, 'no-hooks-config');
  assert.ok(!fs.existsSync(path.join(root, 'settings.json')), 'wrote a settings file it had nothing to put in');
  fs.rmSync(root, { recursive: true, force: true });
});

test('reports rather than throws when hooks config has no hooks key', () => {
  const root = makeTarget({ version: 1 });
  assert.strictEqual(registerHooks(root).status, 'invalid-hooks-config');
  fs.rmSync(root, { recursive: true, force: true });
});

test('requires a target root', () => {
  assert.throws(() => registerHooks(''), /targetRoot is required/);
});

test('a new settings.json is created 0600', { skip: process.platform === 'win32' ? 'POSIX modes only' : false }, () => {
  const root = makeTarget(SAMPLE);
  registerHooks(root);
  const mode = fs.statSync(path.join(root, 'settings.json')).mode & 0o777;
  assert.strictEqual(mode, 0o600, `settings.json can hold tokens; got ${mode.toString(8)}`);
  fs.rmSync(root, { recursive: true, force: true });
});

test('an existing settings.json keeps its own permissions', { skip: process.platform === 'win32' ? 'POSIX modes only' : false }, () => {
  const root = makeTarget(SAMPLE, { model: 'opus' });
  const p = path.join(root, 'settings.json');
  fs.chmodSync(p, 0o640);
  registerHooks(root);
  assert.strictEqual(fs.statSync(p).mode & 0o777, 0o640, 'installer changed the permissions of a user config');
  fs.rmSync(root, { recursive: true, force: true });
});

test('countEntries counts hooks, not entry groups', () => {
  assert.strictEqual(countEntries({ A: [{ hooks: [1, 2] }, { hooks: [3] }] }), 3);
  assert.strictEqual(countEntries({}), 0);
  assert.strictEqual(countEntries(null), 0);
});

test('THE SHIPPED hooks.json REGISTERS COMPLETELY', () => {
  // Guards the actual regression: the manifest ships 8 events, and every one of
  // them must survive the merge into settings.json.
  const repoHooks = require(path.join(__dirname, '..', '..', 'hooks', 'hooks.json'));
  const expectedEvents = Object.keys(repoHooks.hooks);
  const expectedEntries = countEntries(repoHooks.hooks);

  const root = makeTarget(repoHooks);
  const r = registerHooks(root);

  assert.strictEqual(r.events, expectedEvents.length,
    `shipped ${expectedEvents.length} events, registered ${r.events}`);
  assert.strictEqual(r.total, expectedEntries,
    `shipped ${expectedEntries} entries, registered ${r.total}`);
  assert.deepStrictEqual(Object.keys(readSettings(root).hooks).sort(), expectedEvents.sort());
  fs.rmSync(root, { recursive: true, force: true });
});

test('every script a shipped hook points at exists in the repo', () => {
  // The other half of the bug: entries registered fine but referenced
  // hooks/memory and hooks/safety scripts the installer never copied.
  const repoRoot = path.join(__dirname, '..', '..');
  const repoHooks = require(path.join(repoRoot, 'hooks', 'hooks.json'));
  const missing = [];

  for (const [event, entries] of Object.entries(repoHooks.hooks)) {
    for (const entry of entries) {
      for (const hook of entry.hooks || []) {
        const m = /\$\{CLAUDE_PLUGIN_ROOT\}\/([^"'\s]+\.(?:js|sh|py))/.exec(hook.command || '');
        if (!m) continue;
        const abs = path.join(repoRoot, m[1]);
        if (!fs.existsSync(abs)) missing.push(`${event}: ${m[1]}`);
      }
    }
  }

  assert.deepStrictEqual(missing, [], `hooks reference scripts that are not in the repo:\n  ${missing.join('\n  ')}`);
});
