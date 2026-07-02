// =============================================================================
// Kodelyth ECC — Interactive Menu
//
// Shown when `npx kodelyth-ecc` is run in a TTY with no args. Non-TTY still
// falls through to the classic install flow so scripts and CI keep working.
// Zero deps — uses readline from Node's built-ins.
// =============================================================================

'use strict';

const readline = require('readline');
const path     = require('path');

const OPTIONS = [
  { key: '1', label: 'Check for updates',              value: 'update' },
  { key: '2', label: 'Open dashboard (v2, real data)', value: 'dashboard' },
  { key: '3', label: 'Install ECC for another IDE',    value: 'ide' },
  { key: '4', label: 'MCP doctor (verify connection)', value: 'mcp-doctor' },
  { key: '5', label: 'Run system self-test (doctor)',  value: 'doctor' },
  { key: '6', label: 'Index this repo',                value: 'index' },
  { key: '7', label: 'Show memory + savings stats',    value: 'stats' },
  { key: '8', label: 'Read the docs',                  value: 'docs' },
  { key: 'q', label: 'Quit',                            value: 'quit' },
];

async function show() {
  if (!process.stdout.isTTY) return null; // non-interactive → skip menu
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  process.stdout.write('\n');
  process.stdout.write('  Kodelyth ECC 2.0 — Elite Code Crew\n');
  process.stdout.write('  ----------------------------------\n');
  for (const o of OPTIONS) {
    process.stdout.write(`   [${o.key}] ${o.label}\n`);
  }
  process.stdout.write('\n');

  const answer = await new Promise(resolve => rl.question('  Pick one: ', resolve));
  rl.close();

  const picked = OPTIONS.find(o => o.key.toLowerCase() === String(answer || '').toLowerCase().trim());
  return picked ? picked.value : null;
}

module.exports = { show };
