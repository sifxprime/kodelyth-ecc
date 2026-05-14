// =============================================================================
// Kodelyth ECC — MCP Prompts
// Exposes ECC's intent routing rule, handoff chains, and parallel commands
// as MCP prompts that any compatible client can summon by name.
// =============================================================================

'use strict';

const catalog = require('./catalog');

// Each prompt definition:
//   { name, description, arguments?: [{ name, description, required }] }
const PROMPT_DEFINITIONS = [
  {
    name: 'routing-rule',
    description: 'The full ECC intent routing rule — 10-tier priority system mapping user intent to specialist agents.',
    arguments: [],
    handler: () => {
      const r = catalog.loadRule('agent-intent-routing');
      if (!r) throw new Error('Routing rule not found.');
      return {
        description: 'ECC intent routing rule',
        messages: [{
          role: 'user',
          content: { type: 'text', text: r.body },
        }],
      };
    },
  },
  {
    name: 'agents-overview',
    description: 'A compact overview of every ECC agent (name + one-line description). Useful for orientation.',
    arguments: [],
    handler: () => {
      const lines = catalog.loadAgents().map(a =>
        `- **${a.name}** — ${a.description.replace(/\s+/g, ' ').trim().slice(0, 200)}`
      );
      return {
        description: 'ECC agents overview',
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `# Kodelyth ECC — Agents (${lines.length})\n\n${lines.join('\n')}\n`,
          },
        }],
      };
    },
  },
  {
    name: 'skills-overview',
    description: 'A compact overview of every ECC skill (name + one-line description).',
    arguments: [],
    handler: () => {
      const lines = catalog.loadSkills().map(s =>
        `- **${s.name}** — ${s.description.replace(/\s+/g, ' ').trim().slice(0, 200)}`
      );
      return {
        description: 'ECC skills overview',
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `# Kodelyth ECC — Skills (${lines.length})\n\n${lines.join('\n')}\n`,
          },
        }],
      };
    },
  },
  {
    name: 'commands-overview',
    description: 'A compact overview of every ECC slash command.',
    arguments: [],
    handler: () => {
      const lines = catalog.loadCommands().map(c => {
        const hint = c.argumentHint ? ` _(args: ${c.argumentHint})_` : '';
        return `- **/${c.name}**${hint} — ${c.description.replace(/\s+/g, ' ').trim().slice(0, 200)}`;
      });
      return {
        description: 'ECC commands overview',
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `# Kodelyth ECC — Commands (${lines.length})\n\n${lines.join('\n')}\n`,
          },
        }],
      };
    },
  },
  {
    name: 'handoff-chains',
    description: 'Standard ECC multi-agent handoff chains for common workflows (new feature, bug fix, refactor, incident, etc.).',
    arguments: [],
    handler: () => {
      const skill = catalog.findSkill('agent-handoff');
      const text = skill
        ? `# Skill: agent-handoff\n\n${skill.description}\n\n---\n\n${skill.body}`
        : '# Handoff chains\n\n(agent-handoff skill not found — fall back to README)';
      return {
        description: 'ECC handoff chains',
        messages: [{
          role: 'user',
          content: { type: 'text', text },
        }],
      };
    },
  },
  {
    name: 'devil-mode',
    description: 'The /devil-mode adversarial parallel command — fires the red-team crew at a target.',
    arguments: [],
    handler: () => {
      const cmd = catalog.findCommand('devil-mode');
      const text = cmd
        ? `# Command: /devil-mode\n\n${cmd.description}\n\n---\n\n${cmd.body}`
        : '# /devil-mode\n\n(devil-mode command not found)';
      return {
        description: 'ECC /devil-mode parallel command',
        messages: [{
          role: 'user',
          content: { type: 'text', text },
        }],
      };
    },
  },
];

const PROMPT_HANDLERS = Object.fromEntries(
  PROMPT_DEFINITIONS.map(p => [p.name, p.handler])
);

module.exports = { PROMPT_DEFINITIONS, PROMPT_HANDLERS };
