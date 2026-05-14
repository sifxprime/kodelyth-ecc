#!/usr/bin/env node
// =============================================================================
// Kodelyth ECC — Memory CLI
//
// Usage:
//   node scripts/memory/cli.js list
//   node scripts/memory/cli.js search "<query>"
//   node scripts/memory/cli.js remember "<title>" --approach "<text>" --tags tag1,tag2
//   node scripts/memory/cli.js forget <id>
//   node scripts/memory/cli.js stats
//   node scripts/memory/cli.js inject [--query "<text>"]
//   node scripts/memory/cli.js extract <session.jsonl>
//   node scripts/memory/cli.js rebuild-index
// =============================================================================

'use strict';

const path = require('path');
const store   = require('./store');
const { buildContextBlock } = require('./inject');
const { extractCandidates } = require('./extract');

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd  = args[0];
  const positional = [];
  const flags = {};
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(a);
    }
  }
  return { cmd, positional, flags };
}

function help() {
  console.log(`
Kodelyth ECC — Memory CLI

Commands:
  list                              Show all stored memories
  search "<query>"                  BM25 search across memories
  remember "<title>"                Add a memory (use --approach, --tags, --language)
  forget <id>                       Mark a memory deleted
  stats                             Show memory store stats
  inject [--query "<text>"]         Print the cache-friendly context block
  extract <session.jsonl>           Extract memory candidates from a session log
  rebuild-index                     Rebuild the BM25 index from memories.jsonl

Storage: ${store.PATHS.dir}
`);
}

function fmt(memory, full = false) {
  const date = (memory.captured_at || '').slice(0, 10);
  const tags = (memory.tags || []).join(',');
  if (!full) {
    return `${memory.id}  ${date}  [${memory.language || '-'}]  ${memory.problem.slice(0, 70)}  (${tags})`;
  }
  return [
    `id:        ${memory.id}`,
    `captured:  ${memory.captured_at}`,
    `language:  ${memory.language || '-'}`,
    `tags:      ${tags || '-'}`,
    `project:   ${memory.project_path || '-'}`,
    `problem:   ${memory.problem}`,
    `approach:`,
    ...(memory.approach || '').split('\n').map(l => `  ${l}`),
    memory.gotchas?.length ? `gotchas:` : '',
    ...(memory.gotchas || []).map(g => `  - ${g}`),
  ].filter(Boolean).join('\n');
}

function main() {
  const { cmd, positional, flags } = parseArgs(process.argv);

  if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') {
    help();
    return;
  }

  switch (cmd) {
    case 'list': {
      const all = store.listAll();
      if (all.length === 0) {
        console.log('No memories yet. Add one with: memory remember "<title>" --approach "<text>"');
        return;
      }
      for (const m of all) console.log(fmt(m));
      console.log(`\n${all.length} total`);
      return;
    }

    case 'search': {
      const query = positional[0];
      if (!query) { console.error('Usage: search "<query>"'); process.exit(1); }
      const results = store.recall(query, { limit: Number(flags.limit) || 5 });
      if (results.length === 0) { console.log('No matches.'); return; }
      for (const m of results) {
        console.log(`[score ${m.score.toFixed(2)}] ${fmt(m)}`);
      }
      return;
    }

    case 'remember': {
      const title    = positional[0];
      const approach = flags.approach;
      if (!title || !approach) {
        console.error('Usage: remember "<title>" --approach "<what worked>" [--tags a,b] [--language ts]');
        process.exit(1);
      }
      const memory = store.capture({
        problem:  title,
        approach,
        tags:     (flags.tags || '').split(',').filter(Boolean),
        project:  flags.project || process.cwd(),
        language: flags.language || null,
        files:    (flags.files || '').split(',').filter(Boolean),
        gotchas:  (flags.gotchas || '').split(';').filter(Boolean),
        source:   'cli',
      });
      console.log(`Captured: ${memory.id}`);
      return;
    }

    case 'forget': {
      const id = positional[0];
      if (!id) { console.error('Usage: forget <id>'); process.exit(1); }
      const ok = store.forget(id);
      console.log(ok ? `Forgotten: ${id}` : `Not found: ${id}`);
      return;
    }

    case 'stats': {
      const s = store.stats();
      console.log(`Total memories:  ${s.total}`);
      console.log(`Storage:         ${s.storageDir}`);
      console.log(`Projects:        ${s.projects}`);
      console.log(`By language:`);
      for (const [lang, count] of Object.entries(s.byLanguage)) {
        console.log(`  ${lang.padEnd(12)} ${count}`);
      }
      console.log(`Top tags:`);
      for (const [tag, count] of s.topTags) {
        console.log(`  ${tag.padEnd(20)} ${count}`);
      }
      return;
    }

    case 'inject': {
      const block = buildContextBlock({
        projectRoot: flags.project || process.cwd(),
        query:       flags.query || null,
      });
      if (!block) { console.log(''); return; }
      console.log(block.text);
      return;
    }

    case 'extract': {
      const sessionPath = positional[0];
      if (!sessionPath) { console.error('Usage: extract <session.jsonl>'); process.exit(1); }
      const candidates = extractCandidates(path.resolve(sessionPath));
      if (candidates.length === 0) { console.log('No memory candidates found.'); return; }
      console.log(`Found ${candidates.length} candidate memories:\n`);
      candidates.forEach((c, i) => {
        console.log(`[${i + 1}] (score ${c.score})  ${c.problem}`);
        console.log(`    tags:     ${c.tags.join(', ') || '-'}`);
        console.log(`    language: ${c.language || '-'}`);
        console.log(`    approach: ${c.approach.slice(0, 200)}...`);
        console.log('');
      });
      console.log('Review and confirm with: memory remember "<problem>" --approach "<approach>"');
      return;
    }

    case 'rebuild-index': {
      const r = store.rebuildIndex();
      console.log(`Rebuilt index for ${r.count} memories.`);
      return;
    }

    default:
      console.error(`Unknown command: ${cmd}`);
      help();
      process.exit(1);
  }
}

main();
