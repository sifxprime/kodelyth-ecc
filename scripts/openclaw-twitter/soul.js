'use strict';

// soul.js — KLAW persona constants, content calendar, and topic bank.
// Used by content-gen.js to build Claude prompts.

const SYSTEM_PROMPT = `\
You are KLAW — the autonomous voice of Kodelyth ECC on X (Twitter).

## Character
Former staff engineer. Built ECC because fragmented, forgetful, expensive AI coding
setups were costing hours per week. You tweet about AI coding tools the way someone
who actually builds systems every day would — specific, direct, data-backed.

## Voice rules
- One idea per tweet. No preamble. Start with the point.
- Use exact numbers: 70 agents, 194 skills, 97 commands, 22+ hooks, 11 platforms, 373 tests
- "npx kodelyth-ecc" — always lowercase
- No emojis used decoratively. ⚡ or → sparingly if it aids scannability.
- Never: "game-changer", "exciting", "huge", "🚀🔥💡", rhetorical questions without substance
- Max 280 characters for a single tweet. Threads max 5 parts.
- Always end posts that introduce ECC with: github.com/sifxprime/kodelyth-ecc

## Tone examples
GOOD: "70 specialist agents. 194 skills. 97 commands. Zero cloud. Zero telemetry.
One install: npx kodelyth-ecc
github.com/sifxprime/kodelyth-ecc"

BAD: "So excited to share this amazing AI coding toolkit that will revolutionize your workflow! 🚀🔥"

## Output format
Return ONLY the tweet text — no explanation, no quotes around it, no JSON.
If writing a thread, separate parts with [THREAD BREAK] on its own line.`;

const ECC_FEATURES = [
  {
    name:    'Compound Learning',
    desc:    'Corrections write to tasks/lessons.md. Every next session auto-loads them. Claude never repeats the same mistake.',
    cmd:     '/lessons',
    detail:  'capture-correction.js + read-lessons.js hooks. Zero manual effort.',
  },
  {
    name:    'Parallel Agents / /team-review',
    desc:    '4 specialist agents fire simultaneously: code-reviewer, security-reviewer, performance-optimizer, api-guardian.',
    cmd:     '/team-review',
    detail:  '15 min instead of 60. System-prompted cached across all 4.',
  },
  {
    name:    'Parallel Agents / /project-launch',
    desc:    '5 agents: architect, pair-programmer, security-reviewer, tdd-guide, ux-reviewer — all in the first 10 minutes of a new project.',
    cmd:     '/project-launch',
    detail:  'Catch architecture mistakes before you write a single line.',
  },
  {
    name:    'Devil Mode',
    desc:    '8 adversarial agents: prompt-injection-hunter, supply-chain-auditor, secret-hunter, backdoor-hunter, and 4 more.',
    cmd:     '/devil-mode',
    detail:  '--pre-public flag for open-source release sweeps. --all for full 8-agent sweep.',
  },
  {
    name:    'Semantic Routing',
    desc:    'Paste a stack trace → routes to debug-detective. Paste code → routes to code-reviewer. No agent names needed.',
    cmd:     null,
    detail:  '14 always-on rules. 10 priority tiers. 70 specialists available.',
  },
  {
    name:    'MCP Server',
    desc:    '16 tools, 6 prompts, 377 resources. Works with Claude Desktop, LangGraph, AutoGen, CrewAI, OpenAI Agents SDK.',
    cmd:     'npx kodelyth-ecc mcp',
    detail:  'Stdio JSON-RPC. Zero telemetry. Zero cloud.',
  },
  {
    name:    'Local Memory (BM25)',
    desc:    'Every session captures solutions to ~/.kodelythecc/memory/. BM25 recall surfaces relevant past solutions automatically.',
    cmd:     'use kodelyth-memory',
    detail:  'Cross-project. Cross-IDE. One shared store.',
  },
  {
    name:    'debug-detective agent',
    desc:    'Evidence-first root cause analysis. Never patches symptoms. Asks for exact error, minimal repro, what changed last.',
    cmd:     'use debug-detective',
    detail:  'Routes automatically when you paste a stack trace.',
  },
  {
    name:    '11 platforms',
    desc:    'Claude Code, Windsurf, Cursor, Codex CLI, Antigravity, OpenCode, Cline, Roo Code, Aider, Kimi, Gemini CLI.',
    cmd:     'npx kodelyth-ecc',
    detail:  '13 install targets. Same agents, same skills, same hooks.',
  },
  {
    name:    'Zero cost',
    desc:    'MIT license. All local files. No cloud. No telemetry. No subscription.',
    cmd:     'npx kodelyth-ecc',
    detail:  '100% auditable. Everything in ~/.claude/ or equivalent.',
  },
  {
    name:    '/debug-blitz',
    desc:    'Fires debug-detective + silent-failure-hunter + env-debugger simultaneously. For bugs that resisted 30+ min of investigation.',
    cmd:     '/debug-blitz',
    detail:  'Three orthogonal perspectives on the same bug, in parallel.',
  },
  {
    name:    '/security-audit',
    desc:    'security-reviewer + dependency-doctor + api-guardian all at once.',
    cmd:     '/security-audit',
    detail:  'Full threat surface in one command. Use before any public API exposure.',
  },
];

const ENGAGEMENT_SEARCH_QUERIES = [
  '"Claude Code"',
  '"AI coding assistant"',
  '"cursor IDE" coding',
  '"windsurf IDE"',
  '"AI agents" developer',
  'developer productivity AI',
  '"code review" AI agent',
  '"GitHub Copilot" alternative',
  'aider AI coding',
  'cline AI vscode',
];

const CONTENT_TYPES = [
  'feature_spotlight',  // highlight one ECC feature
  'tip',                // one actionable tip using ECC
  'stats_flex',         // just the numbers
  'pain_point',         // problem → ECC solution
  'comparison',         // vague comparison (no names), ECC advantage
];

// Returns a rotating content type based on the current UTC hour + day
function pickContentType() {
  const d = new Date();
  const slot = (d.getUTCDay() * 4 + Math.floor(d.getUTCHours() / 6)) % CONTENT_TYPES.length;
  return CONTENT_TYPES[slot];
}

// Returns a random feature
function pickFeature() {
  return ECC_FEATURES[Math.floor(Math.random() * ECC_FEATURES.length)];
}

module.exports = {
  SYSTEM_PROMPT,
  ECC_FEATURES,
  ENGAGEMENT_SEARCH_QUERIES,
  CONTENT_TYPES,
  pickContentType,
  pickFeature,
};
