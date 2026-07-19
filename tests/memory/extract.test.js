// Tests for scripts/memory/extract.js — the transcript miner behind auto-capture.
// Regression guard: real Claude Code transcripts nest role/content/tool info
// under `.message`. Before v2.4.5 extractCandidates read flat `ev.role` and
// silently skipped every event, so auto-capture never fired.
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');

const { extractCandidates } = require('../../scripts/memory/extract');

function writeTranscript(lines) {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-tx-')), 'transcript.jsonl');
  fs.writeFileSync(p, lines.map(l => JSON.stringify(l)).join('\n') + '\n');
  return p;
}

// Real Claude Code transcript shape: role + content live under `.message`,
// tool calls are content[].type === 'tool_use'.
test('extractCandidates mines a real nested-message transcript', () => {
  const p = writeTranscript([
    { type: 'user',      message: { role: 'user',      content: 'redis connection keeps timing out in production under load' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'The unbounded connection pool was exhausting Redis. Set a max pool size of 50 and a 5s command timeout.' }] } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Edit', input: { file_path: 'src/redis.js' } }] } },
    { type: 'user',      message: { role: 'user',      content: 'that worked, thanks!' } },
  ]);
  const candidates = extractCandidates(p);
  assert.ok(candidates.length >= 1, 'must mine at least one candidate from nested-message transcript');
  const c = candidates[0];
  assert.ok(c.problem && /redis/i.test(c.problem), 'problem captured from user message');
  assert.ok(c.approach && c.approach.length > 0, 'approach captured from assistant message');
});

test('extractCandidates returns nothing without a success signal', () => {
  const p = writeTranscript([
    { type: 'user',      message: { role: 'user',      content: 'how do I center a div' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Use flexbox: display:flex; align-items:center; justify-content:center.' }] } },
    { type: 'user',      message: { role: 'user',      content: 'ok' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Anything else?' }] } },
  ]);
  const candidates = extractCandidates(p);
  assert.equal(candidates.length, 0, 'no success phrase -> no capture');
});

test('extractCandidates handles the legacy flat shape too', () => {
  // Older/synthetic transcripts with flat role+content must still work.
  const p = writeTranscript([
    { role: 'user',      content: 'webpack build fails with out of memory error on CI' },
    { role: 'assistant', content: 'Raise the heap: NODE_OPTIONS=--max-old-space-size=4096 in the CI build step.' },
    { role: 'assistant', content: 'Applied the change to the workflow file.' },
    { role: 'user',      content: 'fixed it, thank you' },
  ]);
  const candidates = extractCandidates(p);
  assert.ok(candidates.length >= 1, 'flat-shape transcript still mines candidates');
});

test('extractCandidates is safe on empty / malformed transcript', () => {
  const p = writeTranscript([]);
  assert.doesNotThrow(() => extractCandidates(p));
  assert.equal(extractCandidates(p).length, 0);
});

test('aggressive: captures on edit + passing test even without a "thanks" (v2.5.4)', () => {
  const p = writeTranscript([
    { role: 'user',      content: 'The auth middleware lets expired JWTs through — past-exp tokens still authenticate.' },
    { role: 'assistant', content: 'The verify call ignores expiry. Use jwt.verify and reject when exp < now.' },
    { role: 'assistant', content: '', tool_name: 'Edit', tool_input: { file_path: '/tmp/p/src/auth.ts' } },
    { role: 'user',      content: 'PASS src/auth.test.ts (12 tests) — exit code 0, all tests passed' },
    { role: 'assistant', content: 'Fixed — expired tokens are now rejected.' },
  ]);
  const candidates = extractCandidates(p);
  assert.ok(candidates.length >= 1, 'edit + passing test should yield a candidate without a user thanks');
  assert.ok(/jwt|auth|expir/i.test(candidates[0].problem + candidates[0].approach));
});

test('aggressive capture can be disabled with KODELYTH_CAPTURE_AGGRESSIVE=0', () => {
  const prev = process.env.KODELYTH_CAPTURE_AGGRESSIVE;
  process.env.KODELYTH_CAPTURE_AGGRESSIVE = '0';
  const p = writeTranscript([
    { role: 'user',      content: 'flaky test fails 1 in 50 runs due to a timing assumption' },
    { role: 'assistant', content: 'Replace the fixed sleep with an explicit wait-for condition.' },
    { role: 'assistant', content: '', tool_name: 'Edit', tool_input: { file_path: '/tmp/p/spec.ts' } },
    { role: 'user',      content: 'exit code 0, all tests passed' },
  ]);
  const candidates = extractCandidates(p);
  if (prev === undefined) delete process.env.KODELYTH_CAPTURE_AGGRESSIVE; else process.env.KODELYTH_CAPTURE_AGGRESSIVE = prev;
  assert.equal(candidates.length, 0, 'with aggressive off + no thanks, nothing is captured');
});
