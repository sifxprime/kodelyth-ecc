'use strict';

/**
 * Register ECC's hooks into a Claude-compatible settings.json.
 *
 * Why this exists
 * ---------------
 * `install.sh` copied `hooks/hooks.json` into `<target>/hooks/hooks.json` and
 * stopped there. Claude Code does not read that file — it reads `hooks` out of
 * `settings.json`. So every hook ECC ships was placed on disk and never
 * activated: memory inject (SessionStart), memory capture and correction
 * encoding (Stop), the prompt-injection guard, the token-budget enforcer.
 *
 * The only entry that ever appeared in settings.json came from RTK's own
 * installer, which writes that file for its own hook.
 *
 * A correct merge already existed in scripts/lib/install/apply.js, but the CLI
 * shells out to install.sh and never reaches it. This script is the bridge:
 * install.sh calls it, and it uses that same tested merge.
 *
 * Guarantees
 * ----------
 * - Idempotent. Re-running adds nothing; entries dedupe by content signature.
 * - Non-destructive. Hooks already in settings.json are kept, including
 *   another tool's (RTK's) and the user's own.
 * - Scoped. Only the `hooks` key is touched; every other setting is preserved.
 * - Atomic. Written via a temp file and rename, so an interrupted install
 *   cannot leave a truncated settings.json — which would break the editor.
 *
 * Usage:  node scripts/install/register-hooks.js <targetRoot> [hooksJsonPath]
 */

const fs = require('fs');
const path = require('path');

const { mergeHookEntries } = require('../lib/install/apply.js');
const { replaceFilePreservingMode } = require('../lib/safe-fs.js');

function readJsonOrNull(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} targetRoot      e.g. ~/.claude
 * @param {string} [hooksJsonPath] defaults to <targetRoot>/hooks/hooks.json
 * @returns {{status:string, events:number, added:number, total:number, settingsPath:string}}
 */
function registerHooks(targetRoot, hooksJsonPath) {
  if (!targetRoot) throw new Error('registerHooks: targetRoot is required');

  const hooksPath = hooksJsonPath || path.join(targetRoot, 'hooks', 'hooks.json');
  const config = readJsonOrNull(hooksPath);
  if (!config) {
    return { status: 'no-hooks-config', events: 0, added: 0, total: 0, settingsPath: '' };
  }

  const incoming = config.hooks && typeof config.hooks === 'object' && !Array.isArray(config.hooks)
    ? config.hooks
    : null;
  if (!incoming) {
    return { status: 'invalid-hooks-config', events: 0, added: 0, total: 0, settingsPath: '' };
  }

  const settingsPath = path.join(targetRoot, 'settings.json');
  const settings = readJsonOrNull(settingsPath) || {};
  const existing = settings.hooks && typeof settings.hooks === 'object' && !Array.isArray(settings.hooks)
    ? settings.hooks
    : {};

  const before = countEntries(existing);
  const merged = { ...existing };

  for (const [event, entries] of Object.entries(incoming)) {
    const current = Array.isArray(existing[event]) ? existing[event] : [];
    const next = Array.isArray(entries) ? entries : [];
    // targetRoot is the plugin root: hooks.json references
    // ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/... which resolves under it.
    merged[event] = mergeHookEntries(current, next, targetRoot);
  }

  const after = countEntries(merged);
  const body = JSON.stringify({ ...settings, hooks: merged }, null, 2) + '\n';

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  // Keeps the file's existing permissions when it is already there — this is a
  // user config and the installer has no business widening or narrowing it.
  // 0o600 for a new one: settings.json can carry tokens.
  replaceFilePreservingMode(settingsPath, body, 0o600);

  return {
    status: 'ok',
    events: Object.keys(merged).length,
    added: after - before,
    total: after,
    settingsPath,
  };
}

function countEntries(hooksObject) {
  let n = 0;
  for (const entries of Object.values(hooksObject || {})) {
    if (Array.isArray(entries)) {
      for (const entry of entries) n += Array.isArray(entry.hooks) ? entry.hooks.length : 1;
    }
  }
  return n;
}

module.exports = { registerHooks, countEntries };

if (require.main === module) {
  const [targetRoot, hooksJsonPath] = process.argv.slice(2);
  if (!targetRoot) {
    console.error('usage: node scripts/install/register-hooks.js <targetRoot> [hooksJsonPath]');
    process.exit(2);
  }
  try {
    const r = registerHooks(targetRoot, hooksJsonPath);
    if (r.status !== 'ok') {
      // Not fatal: a target without a hooks config is a valid configuration.
      console.error(`hooks not registered (${r.status})`);
      process.exit(0);
    }
    console.log(`${r.total} hook entries across ${r.events} events (+${r.added} new)`);
  } catch (err) {
    // An install must not die here. Report loudly and let the rest complete —
    // but exit non-zero so a caller that checks can surface it.
    console.error(`hook registration failed: ${err.message}`);
    process.exit(1);
  }
}
