'use strict';

// content-gen.js — Generates tweet text using Claude API (Haiku tier).
// Returns { text, type, feature, isThread, parts }

require('dotenv').config({ path: `${__dirname}/.env` });
const Anthropic = require('@anthropic-ai/sdk');
const { SYSTEM_PROMPT, pickContentType, pickFeature } = require('./soul.js');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const USER_PROMPTS = {
  feature_spotlight(feature) {
    return `Write a tweet spotlighting this Kodelyth ECC feature:

Feature: ${feature.name}
What it does: ${feature.desc}
${feature.cmd ? `Command: ${feature.cmd}` : ''}
Extra detail: ${feature.detail}

The tweet should make a developer want to try it. Be specific. End with the GitHub URL.
Max 280 characters. Single tweet, not a thread.`;
  },

  tip(feature) {
    return `Write a practical "tip" tweet for Kodelyth ECC users.

Context: ${feature.name} — ${feature.desc}
${feature.cmd ? `Command to use: ${feature.cmd}` : ''}

Format: Start with "Tip:" then the actionable insight.
Max 260 characters. Must be specific enough to be immediately useful.`;
  },

  stats_flex() {
    return `Write a punchy stats tweet for Kodelyth ECC.

Numbers to use (pick 3-5 of these):
- 70 specialist agents
- 194 skills
- 97 commands
- 22+ automation hooks
- 11 platforms (13 install targets)
- 373 tests, all passing
- Zero cloud. Zero telemetry. MIT.
- One install: npx kodelyth-ecc

Keep it under 200 characters. Raw. No fluff. End with github.com/sifxprime/kodelyth-ecc`;
  },

  pain_point(feature) {
    return `Write a tweet that opens with a developer pain point, then shows Kodelyth ECC as the solution.

Pain point relates to: ${feature.name}
ECC's answer: ${feature.desc}
${feature.cmd ? `The specific command/agent: ${feature.cmd}` : ''}

Format:
Line 1: The pain point (relatable, specific)
Line 2: blank
Line 3-4: ECC's specific solution with exact command/agent name
Line 5: github.com/sifxprime/kodelyth-ecc

Max 280 characters total.`;
  },

  comparison() {
    const scenarios = [
      'Most AI coding setups forget everything between sessions. ECC writes corrections to tasks/lessons.md and loads them automatically next session.',
      'Sequential code review (quality → security → performance) takes 60 minutes. /team-review fires all 4 agents simultaneously. 15 minutes.',
      'Starting a new project with one AI assistant means one perspective. /project-launch fires architect + pair-programmer + security-reviewer + tdd-guide + ux-reviewer. 10 minutes.',
      'Most AI tools route every message to the same general model. ECC\'s routing rules map intent to 70 specialist agents automatically — no agent name needed.',
    ];
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    return `Write a tweet based on this contrast:

${scenario}

Write it as a factual observation — no trash talk, just specifics.
End with: npx kodelyth-ecc or github.com/sifxprime/kodelyth-ecc
Max 280 characters.`;
  },
};

async function generateTweet(options = {}) {
  const type    = options.type    || pickContentType();
  const feature = options.feature || pickFeature();

  const promptFn = USER_PROMPTS[type];
  const userMsg  = typeof promptFn === 'function'
    ? promptFn(feature)
    : USER_PROMPTS.feature_spotlight(feature);

  const message = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: userMsg }],
  });

  const raw  = message.content[0].text.trim();
  const isThread = raw.includes('[THREAD BREAK]');
  const parts    = isThread
    ? raw.split('[THREAD BREAK]').map(p => p.trim()).filter(Boolean)
    : [raw];

  return { text: raw, parts, isThread, type, feature };
}

// Generate a reply comment for an engagement target tweet
async function generateComment(tweetText) {
  const message = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system:     SYSTEM_PROMPT,
    messages: [{
      role:    'user',
      content: `Someone tweeted this:

"${tweetText}"

Write a short, genuinely useful reply (1-2 sentences max). If their frustration or question
is something Kodelyth ECC directly solves, mention it naturally — include npx kodelyth-ecc.
If ECC isn't directly relevant, just add value without mentioning it.
Do NOT be promotional unless it's a direct answer to what they said.
Return ONLY the reply text.`,
    }],
  });

  return message.content[0].text.trim();
}

module.exports = { generateTweet, generateComment };

// CLI preview: node content-gen.js
if (require.main === module) {
  (async () => {
    console.log('Generating preview tweet...\n');
    const result = await generateTweet();
    console.log('Type:', result.type);
    console.log('Feature:', result.feature.name);
    console.log('\n--- TWEET ---');
    result.parts.forEach((p, i) => {
      if (result.isThread) console.log(`[${i + 1}/${result.parts.length}]`);
      console.log(p);
      console.log('Characters:', p.length);
      console.log();
    });
  })().catch(console.error);
}
