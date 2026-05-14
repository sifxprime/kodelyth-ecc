// =============================================================================
// Kodelyth ECC — MCP Resources
// Exposes every agent, skill, command, rule, and bundle as an MCP resource.
// URI scheme:
//   kodelyth://agents/<name>
//   kodelyth://skills/<name>
//   kodelyth://commands/<name>
//   kodelyth://rules/<name>
//   kodelyth://bundles/<name>
// =============================================================================

'use strict';

const catalog = require('./catalog');

const SCHEME = 'kodelyth';

function buildList() {
  const out = [];

  for (const a of catalog.loadAgents()) {
    out.push({
      uri: `${SCHEME}://agents/${a.name}`,
      name: `Agent: ${a.name}`,
      description: a.description,
      mimeType: 'text/markdown',
    });
  }
  for (const s of catalog.loadSkills()) {
    out.push({
      uri: `${SCHEME}://skills/${s.name}`,
      name: `Skill: ${s.name}`,
      description: s.description,
      mimeType: 'text/markdown',
    });
  }
  for (const c of catalog.loadCommands()) {
    out.push({
      uri: `${SCHEME}://commands/${c.name}`,
      name: `Command: /${c.name}`,
      description: c.description,
      mimeType: 'text/markdown',
    });
  }
  for (const r of catalog.loadAllRules()) {
    out.push({
      uri: `${SCHEME}://rules/${r.name}`,
      name: `Rule: ${r.name}`,
      description: `ECC rule file (${r.relpath})`,
      mimeType: 'text/markdown',
    });
  }
  for (const b of catalog.loadBundles()) {
    out.push({
      uri: `${SCHEME}://bundles/${b.name}`,
      name: `Bundle: ${b.name}`,
      description: `Power bundle cheat sheet (${b.relpath})`,
      mimeType: 'text/markdown',
    });
  }
  return out;
}

function readResource(uri) {
  const m = /^kodelyth:\/\/(agents|skills|commands|rules|bundles)\/([^/]+)$/.exec(uri || '');
  if (!m) {
    throw new Error(`Unknown resource URI: ${uri}`);
  }
  const kind = m[1];
  const name = decodeURIComponent(m[2]);

  let body = null;
  if (kind === 'agents')   { const a = catalog.findAgent(name);   if (a) body = `# Agent: ${a.name}\n\n${a.description}\n\n---\n\n${a.body}`; }
  if (kind === 'skills')   { const s = catalog.findSkill(name);   if (s) body = `# Skill: ${s.name}\n\n${s.description}\n\n---\n\n${s.body}`; }
  if (kind === 'commands') { const c = catalog.findCommand(name); if (c) body = `# Command: /${c.name}\n\n${c.description}\n\n---\n\n${c.body}`; }
  if (kind === 'rules')    { const r = catalog.loadRule(name);    if (r) body = r.body; }
  if (kind === 'bundles')  {
    const b = catalog.loadBundles().find(x => x.name === name);
    if (b) body = b.body;
  }

  if (body === null) {
    throw new Error(`Resource not found: ${uri}`);
  }
  return {
    contents: [{
      uri,
      mimeType: 'text/markdown',
      text: body,
    }],
  };
}

module.exports = { SCHEME, buildList, readResource };
