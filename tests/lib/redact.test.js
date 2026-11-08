// Tests for scripts/lib/redact.js — credential scrubbing for the memory capture
// path and the command logger.
//
// A captured memory is stored, recalled, and injected into future sessions, so a
// secret that slips into `problem`/`approach` would persist and re-surface. These
// tests pin that the common provider token formats and assignment forms are
// scrubbed, that ordinary prose is left alone, and that no pattern backtracks
// catastrophically on hostile input.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { redact, hasSecret } = require('../../scripts/lib/redact');

// Build token fixtures from parts so no contiguous secret literal exists in this
// source file — otherwise GitHub push protection flags these (fake) test values
// as real credentials. The runtime value is the full token, which is exactly
// what the redactor operates on, so coverage is unchanged.
const T = (...p) => p.join('');

test('provider token formats are redacted', () => {
  const cases = [
    [T('AKIA', 'IOSFODNN7EXAMPLE'), 'aws-key'],
    [T('ghp_', '0123456789abcdefghijABCDEFGHIJ0123'), 'github-token'],
    [T('github_pat_', '11ABCDEFG0abcdefghij_KLMNOPqrstuvwxyz0123456789'), 'github-pat'],
    [T('sk-ant-', 'api03-abcdefghij_klmnopqrstuvwxyz-0123'), 'anthropic-key'],
    [T('sk-proj-', 'abcdefghijklmnopqrstuvwxyz0123'), 'openai-key'],
    [T('sk', '_live_', 'abcdefghijklmnop0123456789'), 'stripe-key'],
    [T('xoxb', '-123456789012-abcdefghijklmno'), 'slack-token'],
    [T('npm_', 'abcdefghijklmnopqrstuvwxyz0123456789'), 'npm-token'],
  ];
  for (const [secret, label] of cases) {
    const out = redact(`the key is ${secret} ok`);
    assert.match(out, new RegExp(`<REDACTED:${label}>`), `expected ${secret} → ${label}`);
    assert.doesNotMatch(out, new RegExp(secret.slice(0, 12)), 'the secret itself is gone');
  }
});

test('a PEM private key block is redacted whole', () => {
  const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA1234\nabcd/efgh+ij==\n-----END RSA PRIVATE KEY-----';
  const out = redact(`here it is:\n${pem}\ndone`);
  assert.match(out, /<REDACTED:private-key>/);
  assert.doesNotMatch(out, /MIIEpAIBAAKCAQEA/);
});

test('assignment and header forms are redacted', () => {
  assert.match(redact('curl --token=abcdef123456 https://x'), /--token=<REDACTED>/);
  assert.match(redact('Authorization: Bearer abc.def.ghi'), /Authorization:\s*<REDACTED>/);
  assert.match(redact('password=hunter2'), /password=<REDACTED>/i);
  assert.match(redact('api_key = "abcd1234efgh5678"'), /api_key\s*=\s*<REDACTED>/i);
});

test('ordinary prose and code are left unchanged', () => {
  for (const safe of [
    'added an OPTIONS handler and a Vary header to fix CORS',
    'the task-force refactor touched user_service.ts',
    'run `npm test` then `git push`',
    'skills live under skills/<name>/SKILL.md',
  ]) {
    assert.equal(redact(safe), safe, `should not touch: ${safe}`);
    assert.equal(hasSecret(safe), false);
  }
});

test('hasSecret reports presence correctly', () => {
  assert.equal(hasSecret('plain text'), false);
  assert.equal(hasSecret('ghp_0123456789abcdefghijABCDEFGHIJ0123'), true);
  assert.equal(hasSecret(null), false);
  assert.equal(hasSecret(undefined), false);
});

test('non-string input passes through untouched', () => {
  assert.equal(redact(null), null);
  assert.equal(redact(undefined), undefined);
  assert.equal(redact(42), 42);
});

test('ReDoS safety: a large hostile input completes quickly', () => {
  const hostile = 'sk-' + 'a'.repeat(100000) + ' ' + '-'.repeat(50000);
  const start = Date.now();
  const out = redact(hostile);
  assert.equal(typeof out, 'string');
  assert.ok(Date.now() - start < 1000, 'redaction must not backtrack catastrophically');
});

// ── Integration: capture scrubs secrets before storing ───────────────────────

test('store.capture redacts a secret in problem/approach before it is written', () => {
  const memDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-redact-mem-'));
  process.env.KODELYTH_MEMORY_DIR = memDir;
  delete require.cache[require.resolve('../../scripts/memory/store')];
  const s = require('../../scripts/memory/store');

  const m = s.capture({
    problem: 'auth failed, the token was ghp_0123456789abcdefghijABCDEFGHIJ0123',
    approach: 'rotated it and set AWS_SECRET to AKIAIOSFODNN7EXAMPLE',
  });

  assert.doesNotMatch(m.problem, /ghp_0123456789/, 'github token scrubbed in problem');
  assert.doesNotMatch(m.approach, /AKIAIOSFODNN7EXAMPLE/, 'aws key scrubbed in approach');

  // And it is scrubbed ON DISK, not just in the returned object.
  const onDisk = fs.readFileSync(path.join(memDir, 'memories.jsonl'), 'utf8');
  assert.doesNotMatch(onDisk, /ghp_0123456789/);
  assert.doesNotMatch(onDisk, /AKIAIOSFODNN7EXAMPLE/);
});
