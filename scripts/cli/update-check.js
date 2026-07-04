// scripts/cli/update-check.js
// Poll npm for the latest kodelyth-ecc version. Cached for 24h to avoid spam.
// Zero deps — uses Node's built-in https.

'use strict';

const https = require('https');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');

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
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify({ at: Date.now(), latest })); } catch {}
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

// Public: returns { current, latest, updateAvailable, cached } or nulls on failure.
async function check({ current, force = false } = {}) {
  if (!force) {
    const c = readCache();
    if (c) {
      return {
        current, latest: c.latest,
        updateAvailable: c.latest && cmpVersion(c.latest, current) > 0,
        cached: true,
      };
    }
  }
  const latest = await fetchLatest();
  if (latest) writeCache(latest);
  return {
    current, latest,
    updateAvailable: !!(latest && cmpVersion(latest, current) > 0),
    cached: false,
  };
}

module.exports = { check, cmpVersion };
