// =============================================================================
// Kodelyth ECC — MCP Tools
// Pure-function tool handlers. No SDK imports here so we can unit-test directly.
// Each handler: (args) => { content: [{type, text}], isError?: bool }
// =============================================================================

'use strict';

const path  = require('path');
const catalog = require('./catalog');
const memoryStore = require('../memory/store');

// ── Token utilities (shared with route_intent) ───────────────────────────────
const STOP = new Set([
  'the','a','an','and','or','but','if','then','else','for','to','of','in','on',
  'is','are','was','were','be','been','being','have','has','had','do','does',
  'did','will','would','should','can','could','may','might','must','this','that',
  'these','those','it','its','as','at','by','from','with','about','i','you','we',
  'they','he','she','my','your','our','their','use','using','used','help','need',
  'want','make','please','some','any','all','very','really','just','also','here',
  'there','when','what','which','who','how','why','code','codebase','project',
]);

function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9_\-/.\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2 && t.length <= 40 && !STOP.has(t));
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

// ── Wrap result text in MCP content shape ────────────────────────────────────
function ok(text) { return { content: [{ type: 'text', text }] }; }
function err(text) { return { content: [{ type: 'text', text }], isError: true }; }

function toJSON(obj) { return ok(JSON.stringify(obj, null, 2)); }

// =============================================================================
// TOOL: route_intent
// =============================================================================
// Suggests the best ECC agent for a user message. Uses simple token overlap
// against agent name + description. This is intentionally thin — the heavy
// routing rule lives in rules/common/agent-intent-routing.md (also exposed
// as an MCP prompt). Clients should layer their own LLM judgment on top.
function tool_route_intent({ message, top_k = 3 } = {}) {
  if (!message || typeof message !== 'string') {
    return err('route_intent: `message` is required (string).');
  }
  const k = Math.max(1, Math.min(20, Number(top_k) || 3));

  const queryTokens = new Set(tokens(message));
  if (queryTokens.size === 0) {
    return err('route_intent: message had no usable tokens after normalization.');
  }

  // Curated signal prior — "TypeError" → debug-detective even though that word
  // isn't in the agent description. Dominates token-overlap when it fires.
  const { scoreSignals } = require('../router/signals');
  const signalByAgent = {};
  for (const s of scoreSignals(message)) signalByAgent[s.agent] = s.signalScore;

  const agents = catalog.loadAgents();
  const scored = agents.map(a => {
    const haystack = `${a.name} ${a.description}`;
    const aTokens = new Set(tokens(haystack));
    // Boost name-match heavily — direct mention of an agent name should dominate.
    const nameTokens = new Set(tokens(a.name));
    const nameHits = [...queryTokens].filter(t => nameTokens.has(t)).length;
    const overlap = jaccard(queryTokens, aTokens) + nameHits * 0.5;
    // Signal weight is scaled so a single strong signal (weight 4-5) outranks
    // any pure token-overlap score (which is < 1 in practice).
    const signal = (signalByAgent[a.name] || 0);
    const score = overlap + signal;
    return { agent: a.name, score, signal, overlap: Number(overlap.toFixed(3)), description: a.description.slice(0, 200) };
  })
  .filter(r => r.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, k);

  return toJSON({
    message,
    suggestions: scored,
    routing_rule: 'rules/common/agent-intent-routing.md',
    note: 'These are token-overlap suggestions only. Read the full routing rule (exposed as MCP prompt `routing-rule`) for tier-based intent matching.',
  });
}

// =============================================================================
// TOOL: list_agents / list_skills / list_commands / list_rules / list_bundles
// =============================================================================
function tool_list_agents() {
  const agents = catalog.loadAgents().map(a => ({
    name: a.name,
    description: a.description,
    relpath: a.relpath,
  }));
  return toJSON({ count: agents.length, agents });
}

function tool_list_skills() {
  const skills = catalog.loadSkills().map(s => ({
    name: s.name,
    description: s.description,
    origin: s.origin,
    relpath: s.relpath,
  }));
  return toJSON({ count: skills.length, skills });
}

function tool_list_commands() {
  const cmds = catalog.loadCommands().map(c => ({
    name: c.name,
    description: c.description,
    argument_hint: c.argumentHint,
    relpath: c.relpath,
  }));
  return toJSON({ count: cmds.length, commands: cmds });
}

function tool_list_rules() {
  const rules = catalog.loadAllRules().map(r => ({
    name: r.name,
    relpath: r.relpath,
    bytes: r.body.length,
  }));
  return toJSON({ count: rules.length, rules });
}

function tool_list_bundles() {
  const bundles = catalog.loadBundles().map(b => ({
    name: b.name,
    relpath: b.relpath,
    bytes: b.body.length,
  }));
  return toJSON({ count: bundles.length, bundles });
}

// =============================================================================
// TOOL: get_agent / get_skill / get_command / get_rule / get_bundle
// =============================================================================
function tool_get_agent({ name } = {}) {
  if (!name) return err('get_agent: `name` is required.');
  const a = catalog.findAgent(name);
  if (!a) return err(`get_agent: agent "${name}" not found.`);
  return ok(`# Agent: ${a.name}\n\n**Description:** ${a.description}\n\n---\n\n${a.body}`);
}

function tool_get_skill({ name } = {}) {
  if (!name) return err('get_skill: `name` is required.');
  const s = catalog.findSkill(name);
  if (!s) return err(`get_skill: skill "${name}" not found.`);
  return ok(`# Skill: ${s.name}\n\n**Description:** ${s.description}\n\n---\n\n${s.body}`);
}

function tool_get_command({ name } = {}) {
  if (!name) return err('get_command: `name` is required.');
  const c = catalog.findCommand(name);
  if (!c) return err(`get_command: command "${name}" not found.`);
  const hint = c.argumentHint ? `\n**Arguments:** ${c.argumentHint}` : '';
  return ok(`# Command: /${c.name}\n\n**Description:** ${c.description}${hint}\n\n---\n\n${c.body}`);
}

function tool_get_rule({ name } = {}) {
  if (!name) return err('get_rule: `name` is required.');
  const r = catalog.loadRule(name);
  if (!r) return err(`get_rule: rule "${name}" not found.`);
  return ok(r.body);
}

function tool_get_bundle({ name } = {}) {
  if (!name) return err('get_bundle: `name` is required.');
  const b = catalog.loadBundles().find(x => x.name === name);
  if (!b) return err(`get_bundle: bundle "${name}" not found.`);
  return ok(b.body);
}

// =============================================================================
// TOOL: recall_memory
// =============================================================================
function tool_recall_memory({ query, project_root, limit = 5 } = {}) {
  if (!query || typeof query !== 'string') {
    return err('recall_memory: `query` is required (string).');
  }
  const lim = Math.max(1, Math.min(50, Number(limit) || 5));
  let results;
  if (project_root) {
    results = memoryStore.recallForProject(project_root, query, { limit: lim });
  } else {
    results = memoryStore.recall(query, { limit: lim });
  }
  return toJSON({
    query,
    project_root: project_root || null,
    count: results.length,
    memories: results.map(m => ({
      id: m.id,
      problem: m.problem,
      approach: m.approach,
      tags: m.tags || [],
      language: m.language || null,
      project_path: m.project_path || null,
      score: m.score || 0,
      captured_at: m.captured_at || null,
    })),
  });
}

// =============================================================================
// TOOL: capture_memory
// =============================================================================
function tool_capture_memory({
  problem, approach, tags = [], language = null, project_root = null,
  files = [], gotchas = [],
} = {}) {
  if (!problem || !approach) {
    return err('capture_memory: both `problem` and `approach` are required.');
  }
  try {
    const memory = memoryStore.capture({
      problem,
      approach,
      tags: Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.trim()).filter(Boolean),
      language: language || null,
      project: project_root || null,
      files: Array.isArray(files) ? files : [],
      gotchas: Array.isArray(gotchas) ? gotchas : [],
      source: 'mcp',
    });
    return toJSON({
      ok: true,
      id: memory.id,
      problem: memory.problem,
      captured_at: memory.captured_at,
    });
  } catch (e) {
    return err(`capture_memory: ${e.message}`);
  }
}

// =============================================================================
// TOOL: memory_stats
// =============================================================================
function tool_memory_stats() {
  try {
    return toJSON(memoryStore.stats());
  } catch (e) {
    return err(`memory_stats: ${e.message}`);
  }
}

// =============================================================================
// TOOL: catalog_stats
// =============================================================================
function tool_catalog_stats() {
  return toJSON(catalog.stats());
}

// =============================================================================
// TOOL: audit_skill_match
// =============================================================================
// Given a description of work, surface skills whose description or body
// overlaps. Useful for clients deciding which skills to attach as context.
function tool_audit_skill_match({ task, top_k = 5 } = {}) {
  if (!task || typeof task !== 'string') {
    return err('audit_skill_match: `task` is required (string).');
  }
  const k = Math.max(1, Math.min(20, Number(top_k) || 5));
  const queryTokens = new Set(tokens(task));
  if (queryTokens.size === 0) {
    return err('audit_skill_match: task had no usable tokens after normalization.');
  }
  const skills = catalog.loadSkills();
  const scored = skills.map(s => {
    // Cap body slice to keep matching cheap on large skill files.
    const haystack = `${s.name} ${s.description} ${s.body.slice(0, 2000)}`;
    const sTokens = new Set(tokens(haystack));
    const score = jaccard(queryTokens, sTokens);
    return { skill: s.name, score, description: s.description.slice(0, 200) };
  })
  .filter(r => r.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, k);

  return toJSON({ task, suggestions: scored });
}

// =============================================================================
// Tool definitions (exported for SDK registration)
// =============================================================================
const TOOL_DEFINITIONS = [
  {
    name: 'route_intent',
    description: 'Suggest the best ECC agent for a user message via token-overlap scoring. Read the full routing rule via the `routing-rule` MCP prompt for tier-based intent matching.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The user message or task description.' },
        top_k:   { type: 'integer', description: 'How many agents to return (1-20, default 3).', default: 3 },
      },
      required: ['message'],
    },
    handler: tool_route_intent,
  },
  {
    name: 'list_agents',
    description: 'List all ECC agents (name, description, relative path).',
    inputSchema: { type: 'object', properties: {} },
    handler: tool_list_agents,
  },
  {
    name: 'list_skills',
    description: 'List all ECC skills (name, description, origin, relative path).',
    inputSchema: { type: 'object', properties: {} },
    handler: tool_list_skills,
  },
  {
    name: 'list_commands',
    description: 'List all ECC slash commands.',
    inputSchema: { type: 'object', properties: {} },
    handler: tool_list_commands,
  },
  {
    name: 'list_rules',
    description: 'List all ECC rule files in rules/common/.',
    inputSchema: { type: 'object', properties: {} },
    handler: tool_list_rules,
  },
  {
    name: 'list_bundles',
    description: 'List ECC power bundles (indie-hacker, red-team, enterprise).',
    inputSchema: { type: 'object', properties: {} },
    handler: tool_list_bundles,
  },
  {
    name: 'get_agent',
    description: 'Fetch the full markdown body of a single agent.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Agent name (e.g. "debug-detective").' } },
      required: ['name'],
    },
    handler: tool_get_agent,
  },
  {
    name: 'get_skill',
    description: 'Fetch the full markdown body of a single skill.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Skill name (e.g. "agentic-engineering").' } },
      required: ['name'],
    },
    handler: tool_get_skill,
  },
  {
    name: 'get_command',
    description: 'Fetch the full markdown body of a single slash command.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Command name with or without leading slash (e.g. "code-review" or "/code-review").' } },
      required: ['name'],
    },
    handler: tool_get_command,
  },
  {
    name: 'get_rule',
    description: 'Fetch the full markdown body of a single ECC rule file.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Rule name (e.g. "agent-intent-routing").' } },
      required: ['name'],
    },
    handler: tool_get_rule,
  },
  {
    name: 'get_bundle',
    description: 'Fetch the cheat sheet for a power bundle (indie-hacker, red-team, enterprise).',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Bundle name (e.g. "indie-hacker").' } },
      required: ['name'],
    },
    handler: tool_get_bundle,
  },
  {
    name: 'recall_memory',
    description: 'BM25 search across the local Kodelyth memory store. Returns top-N matching memories.',
    inputSchema: {
      type: 'object',
      properties: {
        query:        { type: 'string', description: 'Search query.' },
        project_root: { type: 'string', description: 'Optional absolute path to scope to a project first.' },
        limit:        { type: 'integer', description: 'Max results (1-50, default 5).', default: 5 },
      },
      required: ['query'],
    },
    handler: tool_recall_memory,
  },
  {
    name: 'capture_memory',
    description: 'Append a new memory entry to the local Kodelyth memory store.',
    inputSchema: {
      type: 'object',
      properties: {
        problem:      { type: 'string', description: 'Short problem description.' },
        approach:     { type: 'string', description: 'How the problem was solved or the lesson learned.' },
        tags:         { type: 'array', items: { type: 'string' }, description: 'Optional tags.' },
        language:     { type: 'string', description: 'Optional primary language (e.g. "typescript").' },
        project_root: { type: 'string', description: 'Optional project absolute path.' },
        files:        { type: 'array', items: { type: 'string' }, description: 'Optional related files.' },
        gotchas:      { type: 'array', items: { type: 'string' }, description: 'Optional gotchas.' },
      },
      required: ['problem', 'approach'],
    },
    handler: tool_capture_memory,
  },
  {
    name: 'memory_stats',
    description: 'Summary of the local Kodelyth memory store (counts, projects, etc.).',
    inputSchema: { type: 'object', properties: {} },
    handler: tool_memory_stats,
  },
  {
    name: 'catalog_stats',
    description: 'Summary of how many ECC agents, skills, commands, rules, and bundles are loaded.',
    inputSchema: { type: 'object', properties: {} },
    handler: tool_catalog_stats,
  },
  {
    name: 'audit_skill_match',
    description: 'Suggest ECC skills whose description/body overlap a task. Use to decide which skills to attach as context.',
    inputSchema: {
      type: 'object',
      properties: {
        task:  { type: 'string', description: 'The task or work description.' },
        top_k: { type: 'integer', description: 'Max skills to return (1-20, default 5).', default: 5 },
      },
      required: ['task'],
    },
    handler: tool_audit_skill_match,
  },
];

const TOOL_HANDLERS = Object.fromEntries(
  TOOL_DEFINITIONS.map(t => [t.name, t.handler])
);

module.exports = {
  TOOL_DEFINITIONS,
  TOOL_HANDLERS,
  // Exposed individually for tests:
  tool_route_intent,
  tool_list_agents,
  tool_list_skills,
  tool_list_commands,
  tool_list_rules,
  tool_list_bundles,
  tool_get_agent,
  tool_get_skill,
  tool_get_command,
  tool_get_rule,
  tool_get_bundle,
  tool_recall_memory,
  tool_capture_memory,
  tool_memory_stats,
  tool_catalog_stats,
  tool_audit_skill_match,
};
