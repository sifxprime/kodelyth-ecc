// Tests for the RTK name-collision guard — scripts/rtk/index.js.
//
// reachingforthejack/rtk (Rust Type Kit) ships a binary also called `rtk`. ECC
// used to treat any `rtk --version` success as "RTK installed", so it would wire
// its hooks into, and read a `gain` ledger from, the wrong binary. The guard
// below distinguishes Rust Token Killer (the only `rtk` with a `gain`
// subcommand) from the collision. `looksLikeRealRtk` is the pure decision the
// guard makes from two probes, so it is tested here without spawning anything.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { looksLikeRealRtk } = require('../../scripts/rtk/index');

// The real `rtk --help` output, captured from Rust Token Killer 0.42.4.
const REAL_RTK_HELP = `A high-performance CLI proxy designed to filter and summarize system outputs before they reach your LLM context.

Usage: rtk [OPTIONS] <COMMAND>

Commands:
  git            Git commands with compact output
  init           Initialize rtk instructions for assistant CLI usage
  gain           Show token savings summary and history
  wget           Download with compact output (strips progress bars)`;

// A plausible Rust Type Kit (the collision) help — no `gain`, no proxy framing.
const TYPE_KIT_HELP = `rtk — a Rust type-generation toolkit.

Usage: rtk <COMMAND>

Commands:
  generate   Generate Rust types from a schema
  check      Validate a schema
  init       Scaffold a new project`;

test('gain --help exit 0 is sufficient proof of Rust Token Killer', () => {
  // The primary probe: if `rtk gain --help` exits 0, it is the token killer and
  // help text is irrelevant.
  assert.equal(looksLikeRealRtk({ gainHelpOk: true, helpText: '' }), true);
  assert.equal(looksLikeRealRtk({ gainHelpOk: true, helpText: TYPE_KIT_HELP }), true);
});

test('real RTK is recognized from help text when gain probe is unavailable', () => {
  assert.equal(looksLikeRealRtk({ gainHelpOk: false, helpText: REAL_RTK_HELP }), true);
});

test('regression: the Rust Type Kit collision is rejected', () => {
  // This is the whole point — a different `rtk` on PATH must NOT be wired.
  assert.equal(looksLikeRealRtk({ gainHelpOk: false, helpText: TYPE_KIT_HELP }), false);
});

test('no probe data at all is rejected (fail closed)', () => {
  assert.equal(looksLikeRealRtk({ gainHelpOk: false, helpText: '' }), false);
  assert.equal(looksLikeRealRtk({}), false);
  assert.equal(looksLikeRealRtk(), false);
});

test('help that names gain but lacks the proxy/LLM framing is still rejected', () => {
  // Defense in depth: a tool that merely has a `gain` command but is clearly not
  // an LLM-output proxy should not pass on the help-text path.
  const ambiguous = `rtk — ledger tool\n\nCommands:\n  gain   Record a financial gain`;
  assert.equal(looksLikeRealRtk({ gainHelpOk: false, helpText: ambiguous }), false);
});
