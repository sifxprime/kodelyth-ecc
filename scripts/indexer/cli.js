#!/usr/bin/env node
// =============================================================================
// Kodelyth ECC — Indexer CLI (background-callable)
//
// Usage:
//   node scripts/indexer/cli.js index <projectRoot>
//   node scripts/indexer/cli.js search <projectRoot> <name> [--kind X]
//   node scripts/indexer/cli.js callers <projectRoot> <name>
//   node scripts/indexer/cli.js callees <projectRoot> <fromRel>
//   node scripts/indexer/cli.js architecture <projectRoot>
// =============================================================================

'use strict';

const indexer = require('./index');

const [, , cmd, root, ...rest] = process.argv;

if (!cmd) {
  process.stderr.write('usage: cli.js <index|search|callers|callees|architecture> <projectRoot> [args...]\n');
  process.exit(1);
}

try {
  switch (cmd) {
    case 'index': {
      const result = indexer.indexRepo(root || process.cwd());
      process.stdout.write(JSON.stringify(result.stats, null, 2) + '\n');
      break;
    }
    case 'search': {
      const [name, ...flags] = rest;
      let kind = null;
      for (let i = 0; i < flags.length; i++) {
        if (flags[i] === '--kind') kind = flags[++i];
      }
      const results = indexer.searchGraph(root, { name, kind });
      process.stdout.write(JSON.stringify(results, null, 2) + '\n');
      break;
    }
    case 'callers': {
      const [name] = rest;
      process.stdout.write(JSON.stringify(indexer.callersOf(root, name), null, 2) + '\n');
      break;
    }
    case 'callees': {
      const [fromRel] = rest;
      process.stdout.write(JSON.stringify(indexer.calleesOf(root, fromRel), null, 2) + '\n');
      break;
    }
    case 'architecture': {
      process.stdout.write(JSON.stringify(indexer.architecture(root), null, 2) + '\n');
      break;
    }
    default:
      process.stderr.write(`unknown command: ${cmd}\n`);
      process.exit(1);
  }
} catch (err) {
  process.stderr.write(`indexer error: ${err.stack || err.message}\n`);
  process.exit(1);
}
