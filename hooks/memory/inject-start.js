#!/usr/bin/env node
// =============================================================================
// Kodelyth ECC — Memory Inject Hook (SessionStart)
//
// Runs at the start of every Claude Code session. Reads the project root
// from the hook payload (or cwd fallback), builds the memory context block,
// and emits it as additional system context.
//
// Hook contract: prints JSON to stdout that Claude Code will merge into
// the session's system context. Exits 0 even on error — never block a
// session because memory is unavailable.
// =============================================================================

'use strict';

const path = require('path');

let payload = {};
try {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', () => {
    try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }
    main();
  });
  // Fallback: if stdin closes immediately (no piped input), proceed
  setTimeout(() => { if (!process.stdin.readableEnded) main(); }, 100);
} catch {
  main();
}

function main() {
  try {
    const projectRoot = payload.cwd || payload.project_root || process.cwd();
    const { buildContextBlock } = require(path.join(__dirname, '..', '..', 'scripts', 'memory', 'inject'));

    const block = buildContextBlock({ projectRoot });
    if (!block || !block.text) {
      process.exit(0);
    }

    // Emit as additional context — non-blocking, advisory
    const output = {
      additionalContext: block.text,
      meta: {
        source: 'kodelyth-memory',
        memoryCount: block.memoryCount,
        projectMemoryCount: block.projectMemoryCount,
        patternCount: block.patternCount,
      },
    };
    process.stdout.write(JSON.stringify(output));
    process.exit(0);
  } catch (err) {
    // Never crash a session because memory hook failed — log to stderr and continue
    process.stderr.write(`kodelyth-memory inject: ${err.message}\n`);
    process.exit(0);
  }
}
