#!/usr/bin/env node
// Kodelyth ECC — GitHub Action review runner
// Reads a PR diff + selected agents and produces a JSON findings report.
//
// Env contract:
//   ANTHROPIC_API_KEY  Anthropic API key (required for live model call; if absent, runs in dry-mode)
//   ECC_BUNDLE         indie-hacker | red-team | enterprise
//   ECC_AGENTS         comma-separated agent names (overrides bundle if set)
//   ECC_MODEL          Anthropic model id
//   ECC_MAX_FILES      max changed files per run
//   ECC_BASE_SHA       PR base
//   ECC_HEAD_SHA       PR head
//
// Outputs (set via $GITHUB_OUTPUT):
//   critical-count, high-count, medium-count, report-path

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const HOME = os.homedir();
const ECC_HOME = path.join(HOME, '.claude');
const AGENTS_DIR = path.join(ECC_HOME, 'agents');
const REPORT_PATH = path.join(os.tmpdir(), `ecc-review-${Date.now()}.json`);

// ── Bundle → agent mapping ──────────────────────────────────────────────────
const BUNDLE_AGENTS = {
  'indie-hacker': ['security-reviewer', 'code-reviewer', 'ux-reviewer', 'dependency-doctor'],
  'red-team': ['prompt-injection-hunter', 'supply-chain-auditor', 'secret-hunter', 'backdoor-hunter'],
  'enterprise': ['code-reviewer', 'security-reviewer', 'license-violation-finder', 'supply-chain-auditor', 'api-guardian'],
};

const bundle = (process.env.ECC_BUNDLE || 'red-team').trim();
const agentsOverride = (process.env.ECC_AGENTS || '').split(',').map(s => s.trim()).filter(Boolean);
const selectedAgents = agentsOverride.length > 0
  ? agentsOverride
  : (BUNDLE_AGENTS[bundle] || BUNDLE_AGENTS['red-team']);

const model = process.env.ECC_MODEL || 'claude-sonnet-4-5-20250929';
const maxFiles = parseInt(process.env.ECC_MAX_FILES || '20', 10);
const apiKey = process.env.ANTHROPIC_API_KEY || '';

// ── Setup output writer (GitHub Actions $GITHUB_OUTPUT) ─────────────────────
function setOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
  console.log(`::set-output name=${key}::${value}`);
}

function logGroup(label, fn) {
  console.log(`::group::${label}`);
  try {
    return fn();
  } finally {
    console.log('::endgroup::');
  }
}

// ── Read changed files from /tmp/ecc-changed-files.txt ──────────────────────
function readChangedFiles() {
  const listPath = '/tmp/ecc-changed-files.txt';
  if (!fs.existsSync(listPath)) {
    console.log('::warning::No changed-files list found. Skipping review.');
    return [];
  }
  return fs.readFileSync(listPath, 'utf8')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(f => fs.existsSync(f))
    .filter(f => {
      const ext = path.extname(f).toLowerCase();
      // Skip binary / vendor / large generated files
      if (['.png', '.jpg', '.gif', '.pdf', '.zip', '.tgz', '.lock'].includes(ext)) return false;
      if (f.startsWith('node_modules/') || f.includes('/.git/')) return false;
      return true;
    })
    .slice(0, maxFiles);
}

// ── Read agent playbook ─────────────────────────────────────────────────────
function readAgent(name) {
  const p = path.join(AGENTS_DIR, `${name}.md`);
  if (!fs.existsSync(p)) {
    console.log(`::warning::Agent file not found: ${p}`);
    return null;
  }
  return fs.readFileSync(p, 'utf8');
}

// ── Read file content with size cap ─────────────────────────────────────────
function readFileSafe(filePath, maxBytes = 20000) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.length > maxBytes) {
      return content.slice(0, maxBytes) + '\n\n[...truncated, file exceeds 20KB...]';
    }
    return content;
  } catch (err) {
    return `[unreadable: ${err.message}]`;
  }
}

// ── Build the review prompt ─────────────────────────────────────────────────
function buildPrompt(agentName, agentMarkdown, files) {
  const fileBlock = files.map(f => {
    const content = readFileSafe(f);
    return `### File: ${f}\n\n\`\`\`\n${content}\n\`\`\``;
  }).join('\n\n---\n\n');

  return `You are the **${agentName}** specialist. Your full playbook follows. Apply it to the changed files below and emit findings.

---

## YOUR PLAYBOOK

${agentMarkdown}

---

## CHANGED FILES IN THIS PULL REQUEST

${fileBlock}

---

## YOUR TASK

Review the changed files above using your playbook. Emit a JSON object with this exact shape (no commentary, no markdown fences, just the JSON):

\`\`\`json
{
  "agent": "${agentName}",
  "findings": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "file": "path/to/file",
      "line": 42,
      "category": "short category name",
      "title": "one-line summary",
      "description": "what's wrong, why it matters",
      "evidence": "exact code or pattern proving the finding",
      "fix": "concrete fix recommendation"
    }
  ],
  "summary": "one-paragraph overall assessment"
}
\`\`\`

If you find nothing, emit \`{"agent":"${agentName}","findings":[],"summary":"..."}\`. Be concrete — no findings without evidence.`;
}

// ── Call Anthropic API ──────────────────────────────────────────────────────
function callAnthropic(prompt) {
  return new Promise((resolve, reject) => {
    if (!apiKey) {
      // Dry-mode: emit a stub so the action still runs end-to-end without a key
      return resolve({
        agent: 'dry-mode',
        findings: [],
        summary: 'No ANTHROPIC_API_KEY set — review skipped. Set the api-key input or ANTHROPIC_API_KEY secret to enable.'
      });
    }
    const body = JSON.stringify({
      model: model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    const req = https.request({
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(chunks);
          if (parsed.error) return reject(new Error(`Anthropic API error: ${parsed.error.message}`));
          const text = parsed.content?.[0]?.text || '';
          // Strip markdown fences if present
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            return resolve({ agent: 'parse-error', findings: [], summary: `Could not parse model output: ${text.slice(0, 200)}` });
          }
          resolve(JSON.parse(jsonMatch[0]));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const files = logGroup('Read changed files', readChangedFiles);
  if (files.length === 0) {
    console.log('::notice::No reviewable files changed. Skipping ECC review.');
    setOutput('critical-count', '0');
    setOutput('high-count', '0');
    setOutput('medium-count', '0');
    setOutput('report-path', '');
    return;
  }

  console.log(`::notice::Reviewing ${files.length} files with agents: ${selectedAgents.join(', ')} (bundle=${bundle}, model=${model})`);

  const allFindings = [];
  const agentSummaries = [];

  for (const agentName of selectedAgents) {
    const playbook = readAgent(agentName);
    if (!playbook) continue;
    const prompt = buildPrompt(agentName, playbook, files);

    let result;
    try {
      console.log(`::group::Run agent: ${agentName}`);
      result = await callAnthropic(prompt);
      console.log(`::endgroup::`);
    } catch (err) {
      console.log(`::warning::Agent ${agentName} failed: ${err.message}`);
      console.log(`::endgroup::`);
      continue;
    }

    if (Array.isArray(result.findings)) {
      result.findings.forEach(f => allFindings.push({ ...f, agent: agentName }));
    }
    if (result.summary) {
      agentSummaries.push({ agent: agentName, summary: result.summary });
    }
  }

  // Tally severities
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of allFindings) {
    const sev = (f.severity || '').toLowerCase();
    if (counts[sev] != null) counts[sev]++;
  }

  // Write report
  const report = {
    bundle,
    agents: selectedAgents,
    model,
    files_reviewed: files,
    counts,
    findings: allFindings,
    agent_summaries: agentSummaries,
    base_sha: process.env.ECC_BASE_SHA || '',
    head_sha: process.env.ECC_HEAD_SHA || '',
    generated_at: new Date().toISOString(),
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`::notice::Report written: ${REPORT_PATH}`);
  console.log(`::notice::Findings: ${counts.critical} CRITICAL, ${counts.high} HIGH, ${counts.medium} MEDIUM, ${counts.low} LOW`);

  setOutput('critical-count', String(counts.critical));
  setOutput('high-count', String(counts.high));
  setOutput('medium-count', String(counts.medium));
  setOutput('report-path', REPORT_PATH);
}

main().catch(err => {
  console.error(`::error::ECC review crashed: ${err.message}`);
  console.error(err.stack);
  process.exit(2);
});
