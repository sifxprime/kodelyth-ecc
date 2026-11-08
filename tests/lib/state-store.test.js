// Tests for the optional SQLite layer — scripts/lib/state-store/index.js.
//
// sql.js was required at module top but never declared as a dependency, so
// importing state-store threw "Cannot find module 'sql.js'" on every install —
// before any caller's try/catch could run. It is now an OPTIONAL dependency,
// loaded lazily, and a missing module becomes a clean, catchable error. These
// tests pin that import never crashes and that the available/unavailable paths
// behave consistently, whether or not sql.js happens to be installed.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// The whole point: this require must not throw even when sql.js is absent.
const stateStore = require('../../scripts/lib/state-store');

test('importing state-store never throws, with or without sql.js', () => {
  assert.equal(typeof stateStore.createStateStore, 'function');
  assert.equal(typeof stateStore.isSqliteAvailable, 'function');
});

test('isSqliteAvailable() returns a boolean probe', () => {
  assert.equal(typeof stateStore.isSqliteAvailable(), 'boolean');
});

test('createStateStore matches the availability probe', async () => {
  const available = stateStore.isSqliteAvailable();
  if (available) {
    // sql.js is installed (e.g. CI with optional deps) — the store must open.
    const store = await stateStore.createStateStore({ dbPath: ':memory:' });
    assert.ok(store && typeof store.close === 'function');
    store.close();
  } else {
    // sql.js is absent — must reject with the clean, coded error, NOT a raw
    // MODULE_NOT_FOUND, so callers can degrade on purpose.
    await assert.rejects(
      stateStore.createStateStore({ dbPath: ':memory:' }),
      (err) => {
        assert.equal(err.code, 'ECC_SQLITE_UNAVAILABLE');
        assert.match(err.message, /optional dependency "sql\.js" is not installed/);
        return true;
      },
    );
  }
});
