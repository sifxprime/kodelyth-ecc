// Tests for scripts/mcp/register-self.js — MCP self-registration into the user's
// Claude config files.
//
// The bug these exist for: readJson returned null for EVERY failure and the caller
// did `readJson(file) || {}`. So a config that merely failed to parse — one
// trailing comma from a hand-edit, a half-written file — was treated as empty, and
// the merge wrote it back containing only ECC's own entry. Measured on a realistic
// config: 366 bytes in, 140 bytes out, with every other MCP server, every project
// entry and every setting gone. Silently, during an install.
//
// Everything here runs against temp files. registerAll() targets the real
// ~/.claude.json, so it is deliberately never called.
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const os     = require('node:os');
const path   = require('node:path');

const { _internals, SERVER_NAME } = require('../../scripts/mcp/register-self.js');
const { readConfig, registerInFile, unregisterInFile } = _internals;

/** A config shaped like a real one: other servers, project history, settings. */
function realisticConfig() {
  return {
    mcpServers: {
      'some-other-server': { command: 'node', args: ['x.js'] },
      github: { command: 'gh-mcp' },
    },
    projects: { '/Users/me/work': { allowedTools: ['Bash'], history: ['a', 'b'] } },
    theme: 'dark',
    autoUpdates: true,
  };
}

function withFile(contents, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-register-'));
  const file = path.join(dir, 'config.json');
  try {
    if (contents !== null) fs.writeFileSync(file, contents);
    return fn(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('readConfig distinguishes absent from unreadable', () => {
  // Collapsing these two is the entire bug: absent is safe to treat as empty,
  // unreadable is not.
  withFile(null, (f) => assert.equal(readConfig(f).state, 'absent'));
  withFile('', (f) => assert.equal(readConfig(f).state, 'absent'));
  withFile('   \n', (f) => assert.equal(readConfig(f).state, 'absent'));

  withFile(JSON.stringify(realisticConfig()), (f) => assert.equal(readConfig(f).state, 'present'));

  for (const broken of ['{"a":1,}', '{"a":', '[1,2,3]', 'null', 'not json at all']) {
    withFile(broken, (f) =>
      assert.equal(readConfig(f).state, 'unreadable', `should be unreadable: ${broken}`));
  }
});

test('registering into a valid config preserves everything else', () => {
  withFile(JSON.stringify(realisticConfig(), null, 2), (f) => {
    registerInFile(f);
    const after = JSON.parse(fs.readFileSync(f, 'utf8'));

    assert.ok(after.mcpServers[SERVER_NAME], 'ECC entry added');
    assert.ok(after.mcpServers['some-other-server'], 'other server survived');
    assert.ok(after.mcpServers.github, 'other server survived');
    assert.deepEqual(after.projects['/Users/me/work'].history, ['a', 'b'], 'project history survived');
    assert.equal(after.theme, 'dark', 'unrelated setting survived');
    assert.equal(after.autoUpdates, true, 'unrelated setting survived');
  });
});

test('registering refuses to touch a config it cannot parse', () => {
  // The regression. Each of these used to be silently replaced by a file
  // containing nothing but ECC's own server entry.
  const broken = [
    JSON.stringify(realisticConfig(), null, 2).replace(/\}\s*$/, '},}'),  // trailing comma
    JSON.stringify(realisticConfig(), null, 2).slice(0, 120),             // truncated write
    '[1,2,3]',                                                            // not an object
    'null',
  ];

  for (const contents of broken) {
    withFile(contents, (f) => {
      const before = fs.readFileSync(f, 'utf8');
      assert.throws(() => registerInFile(f), /refusing to modify/,
        `should refuse: ${contents.slice(0, 24)}…`);
      assert.equal(fs.readFileSync(f, 'utf8'), before, 'file must be byte-identical');
    });
  }
});

test('registering creates the file when it is absent or empty', () => {
  withFile(null, (f) => {
    registerInFile(f);
    assert.ok(JSON.parse(fs.readFileSync(f, 'utf8')).mcpServers[SERVER_NAME]);
  });
  withFile('', (f) => {
    registerInFile(f);
    assert.ok(JSON.parse(fs.readFileSync(f, 'utf8')).mcpServers[SERVER_NAME]);
  });
});

test('registering is idempotent', () => {
  withFile(JSON.stringify(realisticConfig(), null, 2), (f) => {
    assert.equal(registerInFile(f).action, 'added');
    const once = fs.readFileSync(f, 'utf8');
    assert.equal(registerInFile(f).action, 'unchanged');
    assert.equal(fs.readFileSync(f, 'utf8'), once, 'second run must not rewrite');
  });
});

test('unregistering also leaves an unparseable config alone', () => {
  // Same rule on the way out. Removing an entry from a file we cannot read means
  // writing a file we cannot reconstruct.
  withFile('{"a":1,}', (f) => {
    const before = fs.readFileSync(f, 'utf8');
    const r = unregisterInFile(f);
    assert.equal(r.action, 'skipped-unreadable');
    assert.equal(fs.readFileSync(f, 'utf8'), before);
  });
});

test('writing preserves the existing file mode', () => {
  // A user config may carry permissions the user chose; an install should not
  // widen them.
  withFile(JSON.stringify(realisticConfig(), null, 2), (f) => {
    fs.chmodSync(f, 0o600);
    registerInFile(f);
    assert.equal(fs.statSync(f).mode & 0o777, 0o600);
  });
});

test('a failed write leaves no temp file behind', () => {
  withFile(JSON.stringify(realisticConfig(), null, 2), (f) => {
    registerInFile(f);
    const strays = fs.readdirSync(path.dirname(f)).filter((n) => n.includes('.tmp-'));
    assert.deepEqual(strays, [], `temp files left behind: ${strays.join(', ')}`);
  });
});
