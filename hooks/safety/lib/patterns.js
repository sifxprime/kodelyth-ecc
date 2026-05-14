// =============================================================================
// Kodelyth ECC — Safety Pattern Catalog
//
// Shared detection patterns for prompt-injection-guard and any other safety
// hook. Each pattern: { id, severity, regex, why }.
//
// Severity tiers:
//   critical — strong override / system-prompt extraction / exfiltration
//   high     — clear injection markers (likely malicious in untrusted input)
//   medium   — suspicious context (could be legitimate, worth surfacing)
//
// Detection is regex-based + a couple of decoded checks. No LLM calls.
// =============================================================================

'use strict';

// ── Regex catalog ────────────────────────────────────────────────────────────
const PATTERNS = [
  // ── Critical: instruction override / system-prompt extraction ──────────────
  {
    id: 'override-prior-instructions',
    severity: 'critical',
    regex: /\b(ignore|disregard|forget)\s+(all|any|the|your|my|all\s+(?:prior|previous|above|earlier))?\s*(prior|previous|above|earlier|prev|preceding)?\s*(instructions?|rules?|prompt|system\s*prompt|directives?)\b/i,
    why:   'Classic instruction-override prompt injection.',
  },
  {
    id: 'system-prompt-leak',
    severity: 'critical',
    regex: /\b(reveal|print|show|repeat|output|dump|leak|expose)\s+(your|the|all|any)?\s*(system\s*prompt|hidden\s*prompt|initial\s*(prompt|instructions?)|original\s*(prompt|instructions?)|first\s*(message|prompt|instruction))/i,
    why:   'Explicit attempt to extract the system prompt.',
  },
  {
    id: 'role-rebind',
    severity: 'critical',
    regex: /\b(you\s+are\s+now|act\s+as|pretend\s+to\s+be|from\s+now\s+on\s+you\s+are|new\s+role:|switch\s+to\s+(?:dan|dev\s*mode|jailbreak|sudo|root|admin))\b/i,
    why:   'Role-rebinding attempt (DAN, dev-mode, jailbreak personas).',
  },
  {
    id: 'sudo-prefix',
    severity: 'critical',
    regex: /^\s*(?:sudo\s+|root:\s*|admin:\s*|override:\s*|jailbreak:\s*)/im,
    why:   'Prefix attempting elevation/override.',
  },
  {
    id: 'exfiltration-channel',
    severity: 'critical',
    regex: /\b(send|post|upload|exfiltrate|leak|forward)\s+(?:the\s+)?(secrets?|api[\s_-]?keys?|credentials?|env(?:ironment)?\s*(?:vars?|variables?)?|tokens?|sessions?|cookies?|chat\s+history|conversation)\s+(?:to|via|using)\b/i,
    why:   'Tries to direct the model to exfiltrate sensitive data.',
  },

  // ── High: clear injection markers ──────────────────────────────────────────
  {
    id: 'hidden-system-marker',
    severity: 'high',
    regex: /(\[\[\s*(SYSTEM|INSTRUCTION|IMPORTANT|ADMIN|OVERRIDE)\s*[:>\]]|<\|\s*(system|im_start|admin|override)\s*\|>|^###\s*(SYSTEM|NEW\s+INSTRUCTIONS?|IMPORTANT|OVERRIDE)\b)/im,
    why:   'Hidden-system markers commonly used in indirect injection.',
  },
  {
    id: 'tool-call-hijack',
    severity: 'high',
    regex: /\b(call|invoke|run|execute)\s+(?:the\s+)?(tool|function|mcp|command|shell)\s+["'`]?(rm|curl|wget|fetch|bash|sh|exec|eval|delete_|drop_|exfil_|send_|post_|leak_)/i,
    why:   'Attempts to hijack tool/function calls.',
  },
  {
    id: 'jailbreak-canary',
    severity: 'high',
    regex: /\b(do\s+anything\s+now|dan|developer\s+mode\s+enabled|aim\s+mode|opposite\s+day|in\s+a\s+world\s+with\s+no\s+restrictions)\b/i,
    why:   'Known jailbreak canary phrases.',
  },
  {
    id: 'unrestricted-output',
    severity: 'high',
    regex: /\b(no\s+(filter|restrictions?|rules|safety|policies)|without\s+(any\s+)?(filter|restriction|safety|warning|disclaimer)|unfiltered\s+(answer|response))\b/i,
    why:   'Demands an unrestricted / unfiltered response.',
  },

  // ── Medium: suspicious context (often false-positive in safe content) ──────
  {
    id: 'instructions-keyword',
    severity: 'medium',
    regex: /\b(new\s+instructions?|updated\s+instructions?|special\s+instructions?\s+for\s+you)\b/i,
    why:   'Suspicious instruction-channel hijack attempt.',
  },
  {
    id: 'invisible-character',
    severity: 'medium',
    regex: /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/,
    why:   'Invisible / bidi-override Unicode characters.',
  },
  {
    id: 'huge-base64',
    severity: 'medium',
    regex: /[A-Za-z0-9+/=]{200,}/,
    why:   'Large base64-looking blob — possible encoded payload.',
  },
];

// ── Decoded payload checks ───────────────────────────────────────────────────
// Decode any base64 substring >= 16 chars, search for jailbreak phrases inside.
const DECODE_PROBE = /\b[A-Za-z0-9+/]{16,}={0,2}\b/g;
const DECODED_RED_FLAGS = [
  /ignore\s+(?:all\s+)?(?:prior|previous|above)\s+instructions/i,
  /system\s*prompt/i,
  /you\s+are\s+now/i,
  /developer\s+mode/i,
];

function checkDecoded(text) {
  const findings = [];
  if (typeof text !== 'string' || text.length < 16) return findings;
  let m;
  let count = 0;
  DECODE_PROBE.lastIndex = 0;
  while ((m = DECODE_PROBE.exec(text)) !== null && count < 20) {
    count++;
    const blob = m[0];
    let decoded;
    try { decoded = Buffer.from(blob, 'base64').toString('utf8'); }
    catch { continue; }
    // Skip random binary garbage — require >= 60% printable to look like text.
    let printable = 0;
    for (let i = 0; i < decoded.length; i++) {
      const c = decoded.charCodeAt(i);
      if ((c >= 0x20 && c <= 0x7e) || c === 0x09 || c === 0x0a) printable++;
    }
    if (decoded.length === 0 || printable / decoded.length < 0.6) continue;

    for (const rx of DECODED_RED_FLAGS) {
      if (rx.test(decoded)) {
        findings.push({
          id: 'decoded-payload',
          severity: 'critical',
          why: `Base64-decoded blob contains jailbreak phrase (${rx.source.slice(0, 40)}…).`,
          excerpt: decoded.slice(0, 120),
        });
        break;
      }
    }
  }
  return findings;
}

// ── Public API ───────────────────────────────────────────────────────────────
function scan(text, { maxFindings = 10 } = {}) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const findings = [];
  for (const p of PATTERNS) {
    if (findings.length >= maxFindings) break;
    const m = p.regex.exec(text);
    if (m) {
      findings.push({
        id: p.id,
        severity: p.severity,
        why: p.why,
        excerpt: text.slice(Math.max(0, m.index - 20), m.index + m[0].length + 40),
      });
    }
  }
  for (const f of checkDecoded(text)) {
    if (findings.length >= maxFindings) break;
    findings.push(f);
  }
  return findings;
}

function maxSeverity(findings) {
  if (!findings || findings.length === 0) return 'none';
  if (findings.some(f => f.severity === 'critical')) return 'critical';
  if (findings.some(f => f.severity === 'high'))     return 'high';
  if (findings.some(f => f.severity === 'medium'))   return 'medium';
  return 'none';
}

module.exports = {
  PATTERNS,
  scan,
  checkDecoded,
  maxSeverity,
};
