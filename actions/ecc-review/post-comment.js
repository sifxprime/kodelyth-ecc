#!/usr/bin/env node
// Kodelyth ECC — GitHub Action PR comment poster
// Reads the JSON report and posts a formatted PR comment via GitHub API.
//
// Env contract:
//   GITHUB_TOKEN   Provided by github.token
//   REPORT_PATH    JSON report file
//   PR_NUMBER      PR number
//   REPO           owner/repo

'use strict';

const fs = require('fs');
const https = require('https');

const reportPath = process.env.REPORT_PATH;
const prNumber = process.env.PR_NUMBER;
const repo = process.env.REPO;
const token = process.env.GITHUB_TOKEN;

if (!reportPath || !fs.existsSync(reportPath)) {
  console.log('::warning::No report found, skipping PR comment.');
  process.exit(0);
}
if (!prNumber || !repo || !token) {
  console.log('::warning::Missing PR_NUMBER, REPO, or GITHUB_TOKEN. Skipping comment.');
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// ── Format PR comment ───────────────────────────────────────────────────────
function severityEmoji(sev) {
  const s = (sev || '').toLowerCase();
  if (s === 'critical') return '🔴';
  if (s === 'high') return '🟠';
  if (s === 'medium') return '🟡';
  if (s === 'low') return '🔵';
  return '⚪';
}

function buildComment() {
  const c = report.counts || { critical: 0, high: 0, medium: 0, low: 0 };
  const total = (c.critical || 0) + (c.high || 0) + (c.medium || 0) + (c.low || 0);
  const verdict = total === 0
    ? '✅ **Clean.** No issues found by the selected agents.'
    : `**${total}** finding${total === 1 ? '' : 's'} across ${(report.agents || []).length} agents.`;

  const summaryTable = `
| Severity | Count |
|---|---|
| 🔴 Critical | ${c.critical || 0} |
| 🟠 High | ${c.high || 0} |
| 🟡 Medium | ${c.medium || 0} |
| 🔵 Low | ${c.low || 0} |
`.trim();

  const findings = (report.findings || []).slice(0, 30); // cap to first 30 to fit comment limits
  const findingsBlock = findings.length === 0 ? '' : `

## Findings

${findings.map((f, i) => {
  const emoji = severityEmoji(f.severity);
  const loc = f.line ? `\`${f.file}:${f.line}\`` : `\`${f.file || 'unknown'}\``;
  return `### ${i + 1}. ${emoji} ${(f.severity || 'unknown').toUpperCase()} — ${f.title || '(no title)'}
**Agent:** \`${f.agent || 'unknown'}\` &nbsp;·&nbsp; **Location:** ${loc} &nbsp;·&nbsp; **Category:** ${f.category || 'general'}

${f.description || ''}

${f.evidence ? `<details><summary>Evidence</summary>\n\n\`\`\`\n${(f.evidence || '').slice(0, 1000)}\n\`\`\`\n\n</details>` : ''}

**Recommended fix:** ${f.fix || '(none provided)'}
`;
}).join('\n---\n')}
${(report.findings || []).length > 30 ? `\n_…and ${(report.findings || []).length - 30} more findings (see full report artifact)._\n` : ''}`;

  return `## 🦞 Kodelyth ECC — Devil Mode Review

${verdict}

**Bundle:** \`${report.bundle || 'red-team'}\` &nbsp;·&nbsp; **Agents:** ${(report.agents || []).map(a => `\`${a}\``).join(', ')} &nbsp;·&nbsp; **Files reviewed:** ${(report.files_reviewed || []).length}

${summaryTable}
${findingsBlock}

---

<sub>Powered by [Kodelyth ECC](https://github.com/sifxprime/kodelyth-ecc) · [Configure this action](https://github.com/sifxprime/kodelyth-ecc/tree/main/actions/ecc-review)</sub>`;
}

// ── Find existing comment from this action (for upsert) ─────────────────────
function listComments() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${repo}/issues/${prNumber}/comments?per_page=100`,
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'kodelyth-ecc-action',
        'Accept': 'application/vnd.github+json',
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function upsertComment(body, existingId) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ body });
    const opts = existingId ? {
      hostname: 'api.github.com',
      path: `/repos/${repo}/issues/comments/${existingId}`,
      method: 'PATCH',
    } : {
      hostname: 'api.github.com',
      path: `/repos/${repo}/issues/${prNumber}/comments`,
      method: 'POST',
    };
    opts.headers = {
      'Authorization': `token ${token}`,
      'User-Agent': 'kodelyth-ecc-action',
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`GitHub API ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  try {
    const body = buildComment();
    let comments = [];
    try {
      comments = await listComments();
    } catch (err) {
      console.log(`::warning::Could not list existing comments (${err.message}); will create new.`);
    }
    const existing = Array.isArray(comments)
      ? comments.find(c => c.body && c.body.includes('Kodelyth ECC — Devil Mode Review'))
      : null;
    const result = await upsertComment(body, existing ? existing.id : null);
    console.log(`::notice::PR comment ${existing ? 'updated' : 'created'}: ${result.html_url || ''}`);
  } catch (err) {
    console.log(`::error::Failed to post PR comment: ${err.message}`);
    process.exit(1);
  }
})();
