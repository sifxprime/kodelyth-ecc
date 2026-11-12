'use strict';

/**
 * Tests for hooks/memory/capture-correction.js
 *
 * Specifically covers v2.31.5's fix: compaction summaries and other
 * system-generated turns (which arrive as type: "user" events) must NEVER be
 * written to tasks/lessons.md as corrections. Before the fix, every /compact
 * polluted lessons.md with the "This session is being continued…" summary.
 */

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  isSystemMessage,
  extractText,
  extractCorrections,
  SYSTEM_MESSAGE_PATTERNS,
  CORRECTION_SIGNALS,
} = require('../../hooks/memory/capture-correction.js');

// ── Helpers ────────────────────────────────────────────────────────────────

function writeTempJsonl(events) {
  const file = path.join(
    os.tmpdir(),
    `ecc-capture-correction-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`
  );
  fs.writeFileSync(file, events.map(e => JSON.stringify(e)).join('\n'));
  return file;
}

function cleanup(file) {
  try { fs.unlinkSync(file); } catch {}
}

// Canonical compaction-summary text that Claude Code injects after /compact.
// Matches the exact shape that polluted v2.31.4's tasks/lessons.md.
const COMPACT_SUMMARY_TEXT =
  'This session is being continued from a previous conversation that ran out of context. '
  + 'The summary below covers the earlier portion of the conversation. '
  + 'Summary: 1. Primary Request and Intent: User asked to always use pnpm instead of npm '
  + 'and stop using yarn. We prefer pnpm.';

// ── isSystemMessage: compaction summary text ───────────────────────────────

test('isSystemMessage — flags compaction summary prefix', () => {
  assert.equal(isSystemMessage(COMPACT_SUMMARY_TEXT, {}), true);
});

test('isSystemMessage — flags compaction summary with leading whitespace', () => {
  assert.equal(isSystemMessage('  ' + COMPACT_SUMMARY_TEXT, {}), true);
});

test('isSystemMessage — flags compaction summary with leading newline', () => {
  assert.equal(isSystemMessage('\n' + COMPACT_SUMMARY_TEXT, {}), true);
});

// ── isSystemMessage: event-level flags (primary signal) ────────────────────

test('isSystemMessage — respects isCompactSummary flag on event', () => {
  // Even if the text looks like a normal correction, the event flag wins.
  assert.equal(isSystemMessage('always use pnpm not npm', { isCompactSummary: true }), true);
});

test('isSystemMessage — respects isMeta flag', () => {
  assert.equal(isSystemMessage('please use pnpm', { isMeta: true }), true);
});

test('isSystemMessage — respects isSidechain flag', () => {
  assert.equal(isSystemMessage('we always use pnpm', { isSidechain: true }), true);
});

test('isSystemMessage — respects isVisibleInTranscriptOnly flag', () => {
  assert.equal(isSystemMessage('never do that', { isVisibleInTranscriptOnly: true }), true);
});

// ── isSystemMessage: synthetic tag prefixes ───────────────────────────────

test('isSystemMessage — flags <system-reminder> block', () => {
  assert.equal(
    isSystemMessage('<system-reminder>\nAlways use pnpm not npm.\n</system-reminder>', {}),
    true
  );
});

test('isSystemMessage — flags <command-name>', () => {
  assert.equal(isSystemMessage('<command-name>/compact</command-name>', {}), true);
});

test('isSystemMessage — flags <command-message>', () => {
  assert.equal(isSystemMessage('<command-message>please stop doing X</command-message>', {}), true);
});

test('isSystemMessage — flags <local-command-stdout>', () => {
  assert.equal(isSystemMessage('<local-command-stdout>never use npm</local-command-stdout>', {}), true);
});

test('isSystemMessage — flags <user-prompt-submit-hook>', () => {
  assert.equal(
    isSystemMessage('<user-prompt-submit-hook>we always use pnpm</user-prompt-submit-hook>', {}),
    true
  );
});

test('isSystemMessage — flags <ide_selection>', () => {
  assert.equal(isSystemMessage('<ide_selection>stop using npm</ide_selection>', {}), true);
});

// ── isSystemMessage: genuine user input passes through ────────────────────

test('isSystemMessage — returns false for genuine user correction', () => {
  assert.equal(isSystemMessage("no, please use pnpm not npm", {}), false);
});

test('isSystemMessage — returns false for empty text', () => {
  assert.equal(isSystemMessage('', {}), false);
});

test('isSystemMessage — returns false for undefined event', () => {
  assert.equal(isSystemMessage('no, we always use pnpm', undefined), false);
});

test('isSystemMessage — returns false when text merely MENTIONS "system-reminder" mid-sentence', () => {
  // Only leading-position tags count — a user talking about system-reminders
  // in prose should still be classifiable as a correction.
  assert.equal(
    isSystemMessage('no, stop writing system-reminder blocks in output', {}),
    false
  );
});

// ── extractCorrections: integration tests against a real JSONL file ───────

test('extractCorrections — ignores compaction summary (type: user, isCompactSummary: true)', () => {
  // Reproduces the exact v2.31.4 bug: a type: "user" event with
  // isCompactSummary: true gets treated as a correction and polluted lessons.md.
  const file = writeTempJsonl([
    {
      type: 'user',
      isCompactSummary: true,
      isSidechain: false,
      message: { role: 'user', content: COMPACT_SUMMARY_TEXT },
    },
  ]);
  try {
    assert.deepEqual(extractCorrections(file), []);
  } finally {
    cleanup(file);
  }
});

test('extractCorrections — ignores compaction summary even when isCompactSummary flag is missing (text fallback)', () => {
  // Defensive: if Claude Code ever stops setting isCompactSummary, the text
  // prefix still catches it.
  const file = writeTempJsonl([
    {
      type: 'user',
      message: { role: 'user', content: COMPACT_SUMMARY_TEXT },
    },
  ]);
  try {
    assert.deepEqual(extractCorrections(file), []);
  } finally {
    cleanup(file);
  }
});

test('extractCorrections — ignores <system-reminder> block as user content', () => {
  const file = writeTempJsonl([
    {
      type: 'user',
      message: {
        role: 'user',
        content: '<system-reminder>\nAlways use pnpm not npm.\n</system-reminder>',
      },
    },
  ]);
  try {
    assert.deepEqual(extractCorrections(file), []);
  } finally {
    cleanup(file);
  }
});

test('extractCorrections — ignores sidechain user turn', () => {
  // Subagent context should never leak into project lessons.
  const file = writeTempJsonl([
    {
      type: 'user',
      isSidechain: true,
      message: { role: 'user', content: 'we always use pnpm not npm' },
    },
  ]);
  try {
    assert.deepEqual(extractCorrections(file), []);
  } finally {
    cleanup(file);
  }
});

test('extractCorrections — still captures a genuine user correction', () => {
  const file = writeTempJsonl([
    {
      type: 'user',
      message: { role: 'user', content: 'no, please use pnpm not npm — we never use yarn' },
    },
  ]);
  try {
    const result = extractCorrections(file);
    assert.equal(result.length, 1);
    assert.match(result[0], /use pnpm not npm/);
  } finally {
    cleanup(file);
  }
});

test('extractCorrections — mixed stream: skips summary, keeps real correction', () => {
  // The regression scenario: a compacted session followed by real work. The
  // summary must be dropped and the real correction must survive.
  const file = writeTempJsonl([
    { type: 'user', isCompactSummary: true, message: { role: 'user', content: COMPACT_SUMMARY_TEXT } },
    { type: 'assistant', message: { content: 'Understood.' } },
    { type: 'user', message: { role: 'user', content: 'actually, we always use bun now' } },
  ]);
  try {
    const result = extractCorrections(file);
    assert.equal(result.length, 1, `expected 1 correction, got ${result.length}: ${JSON.stringify(result)}`);
    assert.match(result[0], /bun/);
    // The pollution shape must never appear:
    assert.ok(
      !result[0].startsWith('This session is being continued'),
      'compaction summary leaked into corrections'
    );
  } finally {
    cleanup(file);
  }
});

test('extractCorrections — ignores non-user event types', () => {
  const file = writeTempJsonl([
    { type: 'assistant', message: { content: 'we always use pnpm not npm' } },
    { type: 'system', message: { content: 'please use pnpm not npm' } },
  ]);
  try {
    assert.deepEqual(extractCorrections(file), []);
  } finally {
    cleanup(file);
  }
});

test('extractCorrections — handles content-array shape (list of text blocks)', () => {
  const file = writeTempJsonl([
    {
      type: 'user',
      message: {
        role: 'user',
        content: [
          { type: 'text', text: 'no, please' },
          { type: 'text', text: 'use pnpm not npm' },
        ],
      },
    },
  ]);
  try {
    const result = extractCorrections(file);
    assert.equal(result.length, 1);
    assert.match(result[0], /use pnpm not npm/);
  } finally {
    cleanup(file);
  }
});

test('extractCorrections — handles content-array shape with isCompactSummary (regression)', () => {
  // Compaction summary delivered as a content array must still be filtered.
  const file = writeTempJsonl([
    {
      type: 'user',
      isCompactSummary: true,
      message: {
        role: 'user',
        content: [{ type: 'text', text: COMPACT_SUMMARY_TEXT }],
      },
    },
  ]);
  try {
    assert.deepEqual(extractCorrections(file), []);
  } finally {
    cleanup(file);
  }
});

test('extractCorrections — skips question-shaped user turn', () => {
  const file = writeTempJsonl([
    { type: 'user', message: { role: 'user', content: 'should I use pnpm or npm?' } },
  ]);
  try {
    assert.deepEqual(extractCorrections(file), []);
  } finally {
    cleanup(file);
  }
});

test('extractCorrections — deduplicates identical corrections', () => {
  const file = writeTempJsonl([
    { type: 'user', message: { role: 'user', content: 'we always use pnpm' } },
    { type: 'user', message: { role: 'user', content: 'we always use pnpm' } },
  ]);
  try {
    const result = extractCorrections(file);
    assert.equal(result.length, 1);
  } finally {
    cleanup(file);
  }
});

// ── Pattern sanity ────────────────────────────────────────────────────────

test('SYSTEM_MESSAGE_PATTERNS — matches both markdown-emphasised and plain summaries', () => {
  // The two shapes seen in the v2.31.4 pollution, byte-for-byte.
  const bolded =
    'This session is being continued from a previous conversation that ran out of context. '
    + 'The summary below covers the earlier portion of the conversation. '
    + 'Summary: 1. **Primary Request and Intent:** User messages in this window...';
  const plain =
    'This session is being continued from a previous conversation that ran out of context. '
    + 'The summary below covers the earlier portion of the conversation. '
    + 'Summary: 1. Primary Request and Intent: The conversation is an extended multi-session effort...';
  assert.ok(SYSTEM_MESSAGE_PATTERNS.some(p => p.test(bolded)));
  assert.ok(SYSTEM_MESSAGE_PATTERNS.some(p => p.test(plain)));
});

test('CORRECTION_SIGNALS — still matches the canonical correction shape', () => {
  // Sanity: the v2.31.5 guard didn't disable the underlying matcher.
  assert.ok(CORRECTION_SIGNALS.some(p => p.test('no, we always use pnpm not npm')));
});

// ── extractText ──────────────────────────────────────────────────────────

test('extractText — reads string content', () => {
  assert.equal(extractText({ message: { content: 'hello' } }), 'hello');
});

test('extractText — reads array content', () => {
  const t = extractText({
    message: { content: [{ type: 'text', text: 'alpha' }, { type: 'text', text: 'beta' }] },
  });
  // extractText joins with a single space and trims; whitespace collapsing
  // happens downstream in extractCorrections, not here.
  assert.equal(t, 'alpha beta');
});

test('extractText — returns empty string for missing content', () => {
  assert.equal(extractText({}), '');
});
