// Tests for codebase-memory-mcp capability detection — scripts/codebase/index.js.
//
// The integrated binary's `--version` string proved untrustworthy: builds have
// reported 0.8.1 while exposing the CBM Lens UI, trace ingestion, and other
// v0.12 tools. ECC used to display and trust that number in `status`, `doctor`,
// and the dashboard. These tests pin the capability detection that reads what the
// binary can actually DO, and the note that flags an inconsistent version.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseCapabilities, versionNote } = require('../../scripts/codebase/index');

// A help blob from a modern build (names the newer tools + the --ui flag).
const MODERN_HELP = `
codebase-memory-mcp — code graph server

Flags:
  --ui          Launch CBM Lens (loopback UI)

Tools:
  index_repository   detect_changes   search_graph   query_graph
  get_architecture   manage_adr       ingest_traces  trace_path
Modes: cross-repo-intelligence, persistence
`;

// An old build: just the basics, no Lens, no traces, no cypher.
const OLD_HELP = `
codebase-memory-mcp

Tools:
  index_repository   search_graph   get_architecture   list_projects
`;

test('parseCapabilities detects modern capabilities', () => {
  const caps = parseCapabilities(MODERN_HELP);
  assert.equal(caps.lens, true);
  assert.equal(caps.traces, true);
  assert.equal(caps.cypher, true);
  assert.equal(caps.smart_ci, true);
  assert.equal(caps.adr, true);
  assert.equal(caps.cross_repo, true);
});

test('parseCapabilities reports an old build as lacking the new tools', () => {
  const caps = parseCapabilities(OLD_HELP);
  assert.equal(caps.lens, false);
  assert.equal(caps.traces, false);
  assert.equal(caps.cypher, false);
  assert.equal(caps.cross_repo, false);
});

test('parseCapabilities handles empty/garbage input (binary absent)', () => {
  const caps = parseCapabilities('');
  assert.equal(Object.values(caps).every(v => v === false), true);
  assert.deepEqual(parseCapabilities(null), parseCapabilities(''));
});

test('versionNote fires on the real inconsistency: old version string + new capabilities', () => {
  const caps = parseCapabilities(MODERN_HELP);
  const note = versionNote('codebase-memory-mcp 0.8.1', caps);
  assert.match(note, /version string is unreliable/);
  assert.match(note, /capability detection is authoritative/);
});

test('versionNote stays silent when version and capabilities agree', () => {
  // Modern version + modern caps → no inconsistency.
  assert.equal(versionNote('codebase-memory-mcp 0.12.1', parseCapabilities(MODERN_HELP)), null);
  // Old version + old caps → consistent, nothing to warn about.
  assert.equal(versionNote('codebase-memory-mcp 0.8.1', parseCapabilities(OLD_HELP)), null);
  // No version at all → nothing to compare.
  assert.equal(versionNote(null, parseCapabilities(MODERN_HELP)), null);
});
