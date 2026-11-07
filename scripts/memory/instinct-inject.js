// scripts/memory/instinct-inject.js
//
// Consume the structured instinct store (scripts/memory/instincts.js) at session
// start. That store is written by the correction-capture hook, but until now
// nothing ever READ it — all of its confidence / decay / outcome machinery ran
// and never influenced a single session. This module closes that loop: it picks
// the high-confidence, non-stale instincts relevant to the current project and
// formats them for injection into SessionStart context.
//
// Kept separate from session-start.js (which executes main() at import time) so
// the selection logic can be unit-tested without running the whole hook.
'use strict';

const DEFAULT_MAX = 6;
const DEFAULT_THRESHOLD = 0.7;

// Pure selection + formatting. Given raw instinct records, keep the ones that
// are non-stale, confident enough, and in scope for `projectPath`; rank by
// confidence; cap at `max`; render as injectable markdown. No I/O — this is the
// unit the tests exercise.
function formatStructuredInstincts(instincts, { projectPath, max = DEFAULT_MAX, threshold = DEFAULT_THRESHOLD } = {}) {
  const candidates = (Array.isArray(instincts) ? instincts : [])
    .filter(i => i && typeof i.rule === 'string' && i.rule.trim())
    .filter(i => !i.stale && (i.confidence || 0) >= threshold)
    // Global instincts always apply; project-scoped ones only in their project.
    // A record with no project_path is treated as unscoped (applies anywhere).
    .filter(i => i.scope === 'global' || !i.project_path || i.project_path === projectPath);

  if (candidates.length === 0) return '';

  const ranked = candidates
    .slice()
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, max);

  const lines = ranked.map(i => {
    const scope = i.scope === 'project' ? 'project' : 'global';
    const confidence = `${Math.round((i.confidence || 0) * 100)}%`;
    return `- [${scope} ${confidence}] ${i.rule.trim()}`;
  });

  return `Learned instincts (from past corrections):\n${lines.join('\n')}`;
}

// Read the store and format. Never throws: the structured store must not be able
// to break session start, so any failure degrades to injecting nothing.
function summarizeStructuredInstincts(projectPath, { log = () => {} } = {}) {
  try {
    const store = require('./instincts');
    const summary = formatStructuredInstincts(store.list(), { projectPath });
    if (summary) {
      const count = summary.split('\n').length - 1;
      log(`[SessionStart] Injecting ${count} learned instinct(s) from the structured store`);
    }
    return summary;
  } catch (err) {
    log(`[SessionStart] Structured instinct injection skipped: ${err && err.message}`);
    return '';
  }
}

module.exports = {
  formatStructuredInstincts,
  summarizeStructuredInstincts,
  DEFAULT_MAX,
  DEFAULT_THRESHOLD,
};
