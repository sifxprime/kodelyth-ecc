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
