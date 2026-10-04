// scripts/cli/update-check.js
// Poll npm for the latest kodelyth-ecc version. Cached for 24h to avoid spam.
// Zero deps — uses Node's built-in https.

'use strict';

const https = require('https');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');
const safeFs = require('../lib/safe-fs.js');

const CACHE_DIR  = path.join(os.homedir(), '.kodelythecc');
const CACHE_FILE = path.join(CACHE_DIR, 'update-check.json');
const CACHE_TTL  = 24 * 60 * 60 * 1000; // 24h

function readCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (Date.now() - raw.at < CACHE_TTL) return raw;
  } catch { /* no cache or corrupt */ }
  return null;
}

function writeCache(latest) {
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch {}
  try { safeFs.replaceFilePreservingMode(CACHE_FILE, JSON.stringify({ at: Date.now(), latest })); } catch {}
}

function fetchLatest() {
  return new Promise((resolve) => {
    const req = https.get('https://registry.npmjs.org/kodelyth-ecc/latest', {
      timeout: 2500,
      headers: { accept: 'application/json' },
    }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body).version || null); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function cmpVersion(a, b) {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

/**
 * Where to read what actually changed in a given version.
 *
 * "update available: v2.23.2" is a nag — it tells you a number and no reason.
 * A link to the release notes turns the same notice into something worth acting
 * on, which is the whole point of owning a monthly touchpoint.
 */
function releaseNotesUrl(version) {
  if (!version) return null;
  return `https://github.com/sifxprime/kodelyth-ecc/releases/tag/v${version}`;
}

// Public: returns { current, latest, updateAvailable, cached, releaseNotes } or nulls on failure.
async function check({ current, force = false } = {}) {
  if (!force) {
    const c = readCache();
    if (c) {
      return {
        current, latest: c.latest,
        updateAvailable: c.latest && cmpVersion(c.latest, current) > 0,
        cached: true,
        releaseNotes: releaseNotesUrl(c.latest),
      };
    }
  }
  const latest = await fetchLatest();
  if (latest) writeCache(latest);
  return {
    current, latest,
    updateAvailable: !!(latest && cmpVersion(latest, current) > 0),
    cached: false,
    releaseNotes: releaseNotesUrl(latest),
  };
}

/**
 * Cache-only read. No network, no promise, no timeout — safe to call from a
 * synchronous command.
 *
 * doctor uses this rather than check(): it is the command people run when
 * something is already wrong, so it must never wait on the registry. The cache
 * is warmed by the interactive menu, which does hit the network. A cold cache
 * simply yields null and the version row does not appear, which is correct —
 * "I could not reach npm" is not a fact about the health of your install.
 */
function cachedCheck(current) {
  const c = readCache();
  if (!c || !c.latest) return null;
  return {
    current,
    latest: c.latest,
    updateAvailable: cmpVersion(c.latest, current) > 0,
    cached: true,
    releaseNotes: releaseNotesUrl(c.latest),
  };
}

module.exports = { check, cachedCheck, cmpVersion, releaseNotesUrl };
