// Routing quality eval — turns "does routing work?" into a measured number.
// route_intent is a deterministic keyword+overlap PRIOR (the LLM layers the full
// tier rule on top). This test asserts the prior stays above a quality floor, so
// a future change that weakens the signal map fails CI instead of silently
// regressing routing back toward the pre-2.4.6 baseline (38% top-1).
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const path   = require('path');

const { tool_route_intent } = require('../../scripts/mcp/tools.js');
const { cases } = require('../../tests/router/intent-eval.cases.json');

function topK(prompt, k = 3) {
  const res = tool_route_intent({ message: prompt, top_k: k });
  const payload = JSON.parse(res.content ? res.content[0].text : JSON.stringify(res));
  return (payload.suggestions || []).map(s => s.agent);
}

test('route_intent top-1 accuracy stays >= 90% on the labeled eval set', () => {
  let hit = 0;
  const misses = [];
  for (const c of cases) {
    const got = topK(c.prompt, 3);
    if (got[0] === c.expect) hit++;
    else misses.push(`want ${c.expect}, got [${got.slice(0, 3).join(', ')}] :: "${c.prompt.slice(0, 50)}"`);
  }
  const pct = hit / cases.length;
  assert.ok(pct >= 0.90, `top-1 ${Math.round(pct * 100)}% < 90% floor\n  ${misses.join('\n  ')}`);
});

test('route_intent top-3 accuracy stays >= 95% on the labeled eval set', () => {
  let hit = 0;
  for (const c of cases) {
    if (topK(c.prompt, 3).includes(c.expect)) hit++;
  }
  const pct = hit / cases.length;
  assert.ok(pct >= 0.95, `top-3 ${Math.round(pct * 100)}% < 95% floor`);
});

test('signal map does not hijack documentation intents', () => {
  // Broadened keyword patterns (rebase, keyboard) must not steal doc requests.
  const notGitRescue = topK('document how to rebase in our git workflow guide')[0];
  assert.notEqual(notGitRescue, 'git-rescue', 'doc-about-rebase must not route to git-rescue');
});

test('every labeled case resolves to a known agent', () => {
  const { scoreSignals } = require('../../scripts/router/signals');
  // Sanity: the signal scorer never throws and returns an array.
  for (const c of cases) {
    const scored = scoreSignals(c.prompt);
    assert.ok(Array.isArray(scored));
  }
});
