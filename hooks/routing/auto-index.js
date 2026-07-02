#!/usr/bin/env node
// =============================================================================
// Kodelyth ECC — Auto-Index (SessionStart hook)
//
// On session start, check if the current project has a fresh Kodelyth graph
// at <project>/.kodelythecc/graph.json. If missing or stale (manifest mismatch),
// kick a background indexer. Always non-blocking, ≤300ms budget on the caller.
// =============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const fabric    = require('../../scripts/lib/fabric');
const telemetry = require('../../scripts/lib/telemetry');

let payload = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { payload += chunk; });
process.stdin.on('end', main);
setTimeout(() => { if (!process.stdin.readableEnded) main(); }, 200);

function main() {
  try {
    const data = payload ? safeJson(payload) : {};
    const projectRoot = data.cwd || process.cwd();

    fabric.ensureGlobal();

    const paths = fabric.project(projectRoot);
    const graphExists = fs.existsSync(paths.graph);
    const manifestExists = fs.existsSync(paths.graphManifest);

    // Trigger conditions:
    //   - No graph yet → full index
    //   - Graph older than 7 days → refresh
    //   - Manifest missing → refresh (something got corrupt)
    let shouldIndex = false;
    let reason = '';
    if (!graphExists) { shouldIndex = true; reason = 'no-graph'; }
    else if (!manifestExists) { shouldIndex = true; reason = 'no-manifest'; }
    else {
      try {
        const st = fs.statSync(paths.graph);
        const ageDays = (Date.now() - st.mtimeMs) / (1000 * 60 * 60 * 24);
        if (ageDays > 7) { shouldIndex = true; reason = `stale-${Math.round(ageDays)}d`; }
      } catch {}
    }

    telemetry.record('session.start', { project: projectRoot, session_id: data.session_id || null });

    if (!shouldIndex) return exit0();

    // Kick a detached background process — never block session start.
    const script = path.join(__dirname, '..', '..', 'scripts', 'indexer', 'cli.js');
    if (!fs.existsSync(script)) return exit0();

    const child = spawn(process.execPath, [script, 'index', projectRoot], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, KODELYTH_INDEX_REASON: reason },
    });
    child.unref();

    telemetry.record('index.kickoff', { project: projectRoot, reason });

    process.stdout.write(JSON.stringify({
      message: `Kodelyth: indexing repo in background (${reason}) — first-time or stale`,
    }));

    return exit0();
  } catch (err) {
    process.stderr.write(`kodelyth-ecc auto-index: ${err.message}\n`);
    return exit0();
  }
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }
function exit0() { process.exit(0); }
