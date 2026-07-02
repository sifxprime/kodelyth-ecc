// =============================================================================
// Kodelyth ECC — Update check
//
// Compares the installed version (from package.json) to npm `latest`.
// Cached to ~/.kodelythecc/config.json for 24h to avoid rate-limits.
// Offline-safe: if npm registry is unreachable, silently returns unknown.
// =============================================================================

'use strict';

const fs      = require('fs');
const path    = require('path');
const https   = require('https');
const fabric  = require('../lib/fabric');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readInstalledVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
    return pkg.version || null;
  } catch { return null; }
}

async function fetchLatest() {
  return new Promise(resolve => {
    const req = https.get('https://registry.npmjs.org/kodelyth-ecc/latest', {
      timeout: 4000,
      headers: { accept: 'application/json' },
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body).version || null); }
        catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function loadCache() {
  fabric.ensureGlobal();
  return fabric.readJson(fabric.GLOBAL.config, {});
}

function saveCache(cfg) {
  fabric.writeJson(fabric.GLOBAL.config, cfg);
}

// Compare "x.y.z" strings.
function cmp(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

async function check({ force = false } = {}) {
  const installed = readInstalledVersion();
  if (!installed) return { installed: null, latest: null, upToDate: null, reason: 'no package.json' };

  const cache = loadCache();
  const now = Date.now();
  if (!force && cache.update_check && (now - cache.update_check.ts) < CACHE_TTL_MS) {
    const upToDate = cmp(installed, cache.update_check.latest) >= 0;
    return { installed, latest: cache.update_check.latest, upToDate, cached: true };
  }

  const latest = await fetchLatest();
  if (!latest) return { installed, latest: null, upToDate: null, reason: 'registry unreachable' };

  cache.update_check = { ts: now, latest };
  try { saveCache(cache); } catch {}

  const upToDate = cmp(installed, latest) >= 0;
  return { installed, latest, upToDate };
}

module.exports = { check, readInstalledVersion };
